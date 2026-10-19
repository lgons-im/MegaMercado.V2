import { sql } from '../config/neon-config.js';
import { exigirSesion } from '../auth/auth.js';
import { PRODUCTOS } from '../config/productos.js';
import { formatearSoles, redondear } from '../registro/tarifario.js';

const usuario = exigirSesion();

const NOMBRES_METODO = {
  tarjeta_debito: 'Tarjeta de débito', tarjeta_credito: 'Tarjeta de crédito',
  billetera: 'Billetera electrónica', efectivo: 'Efectivo', pos: 'Tarjeta en POS'
};

const contenedor = document.querySelector('#comprobante');
const op = new URLSearchParams(location.search).get('op');

const filas = await sql`
  SELECT p.codigo_operacion, p.canal, p.metodo, p.proveedor_billetera, p.marca_tarjeta, p.referencia,
         p.monto, p.monto_recibido, p.vuelto, p.fecha_pago, p.id_usuario,
         r.codigo_seguimiento, r.detalle_pedido, r.peso_kg, r.incluye_congelados,
         u.nombre AS cliente, c.nombre AS cajero
  FROM pagos p
  JOIN pedidos_delivery_megamercado r ON r.id = p.id_registro
  LEFT JOIN usuarios u ON u.id = p.id_usuario
  LEFT JOIN usuarios c ON c.id = p.id_cajero
  WHERE p.codigo_operacion = ${op} AND p.estado = 'aprobado';
`;
const pago = filas[0];

function el(tag, texto, clase) {
  const e = document.createElement(tag);
  if (texto !== undefined) e.textContent = texto;
  if (clase) e.className = clase;
  return e;
}

function datoMeta(dl, etiqueta, valor) {
  dl.append(el('dt', etiqueta), el('dd', valor ?? '—'));
}

function fila(tbody, celdas, clase) {
  const tr = el('tr', undefined, clase);
  for (const c of celdas) tr.append(el('td', c));
  tbody.append(tr);
}

function tabla(encabezados) {
  const t = el('table');
  const thead = el('thead');
  const tr = el('tr');
  for (const h of encabezados) tr.append(el('th', h));
  thead.append(tr);
  const tbody = el('tbody');
  t.append(thead, tbody);
  return { t, tbody };
}

function leerProductos(detalle) {
  const [parteItems] = String(detalle ?? '').split(' | Subtotal productos:');
  const items = parteItems.split('; ').map((t) => {
    const m = /^(\d+) x (.+) \((.+)\)$/.exec(t.trim());
    if (!m) return null;
    const p = PRODUCTOS.find((x) => x.nombre === m[2] && x.presentacion === m[3]);
    return { cant: Number(m[1]), nombre: m[2], presentacion: m[3], precio: p ? p.precio : null };
  });
  return items.every(Boolean) && items.length ? items : null;
}

/* ---------- construir la boleta ---------- */
if (!pago || (usuario.rol === 'cliente' && pago.id_usuario !== usuario.id)) {
  contenedor.textContent = 'Comprobante no encontrado.';
} else {
  const monto = Number(pago.monto);

  
  const marca = el('div', undefined, 'boleta__marca');
  const h1 = el('h1', 'Mega');
  h1.append(el('span', 'Mercado'));
  marca.append(h1, el('p', 'MegaMercado Perú · Cadena de supermercados'),
    el('p', 'Documento generado en una simulación académica'));
  contenedor.append(marca,
    el('p', 'BOLETA DE PAGO ELECTRÓNICA', 'boleta__tipo'),
    el('p', `N.° ${pago.codigo_operacion}`, 'boleta__numero'),
    el('span', 'PAGO APROBADO', 'boleta__estado'));

  const dl = el('dl');
  datoMeta(dl, 'Fecha y hora', new Date(pago.fecha_pago).toLocaleString('es-PE', { timeZone: 'America/Lima' }));
  datoMeta(dl, 'Cliente', pago.cliente ?? 'Atención presencial');
  datoMeta(dl, 'Pedido', pago.codigo_seguimiento);
  datoMeta(dl, 'Canal', pago.canal === 'pasarela' ? 'Pago en línea' : 'Ventanilla');
  datoMeta(dl, 'Medio de pago', `${NOMBRES_METODO[pago.metodo]} ${pago.marca_tarjeta ?? pago.proveedor_billetera ?? ''} ${pago.referencia ?? ''}`.trim());
  if (pago.cajero) datoMeta(dl, 'Atendido por', pago.cajero);
  contenedor.append(dl);

  contenedor.append(el('h2', 'Productos del pedido'));
  let subtotalProductos = null;
  const items = leerProductos(pago.detalle_pedido);
  if (items) {
    const { t, tbody } = tabla(['Cant.', 'Descripción', 'P. unit.', 'Importe']);
    let subtotal = 0;
    for (const i of items) {
      const importe = i.precio !== null ? redondear(i.precio * i.cant) : null;
      if (importe !== null) subtotal += importe;
      fila(tbody, [String(i.cant), `${i.nombre} (${i.presentacion})`,
        i.precio !== null ? formatearSoles(i.precio) : '—', importe !== null ? formatearSoles(importe) : '—']);
    }
    subtotalProductos = redondear(subtotal);
    fila(tbody, ['', 'Subtotal de productos', '', formatearSoles(subtotalProductos)], 'subtotal');
    contenedor.append(t, el('p', 'Los productos se cancelan según tu sede, al recibir tu pedido.', 'nota'));
  } else {
    contenedor.append(el('p', pago.detalle_pedido ?? '—'));
  }

  contenedor.append(el('h2', 'Servicio de delivery (pagado)'));
  const { t: tDel, tbody: bDel } = tabla(['Cant.', 'Concepto', '', 'Importe']);
  const peso = Number(pago.peso_kg) || 0;
  const extraKg = Math.max(0, peso - 5);
  const lineasDelivery = [['1', 'Delivery base (hasta 5 kg)', 8.00]];
  if (extraKg > 0) lineasDelivery.push([String(redondear(extraKg)), 'Kg adicional a S/ 1.50 c/u', redondear(extraKg * 1.5)]);
  if (pago.incluye_congelados) lineasDelivery.push(['1', 'Recargo por productos congelados', 5.00]);
  const sumaLineas = redondear(lineasDelivery.reduce((a, l) => a + l[2], 0));
  if (sumaLineas === monto) {
    for (const [c, d, imp] of lineasDelivery) fila(bDel, [c, d, '', formatearSoles(imp)]);
  } else {
    fila(bDel, ['1', 'Servicio de delivery', '', formatearSoles(monto)]);   // datos de prueba con otro monto
  }
  fila(bDel, ['', `Peso del pedido: ${peso} kg`, '', formatearSoles(monto)], 'subtotal');
  contenedor.append(tDel);

  if (pago.metodo === 'efectivo') {
    const dlEf = el('dl');
    datoMeta(dlEf, 'Monto recibido', formatearSoles(Number(pago.monto_recibido)));
    datoMeta(dlEf, 'Vuelto', formatearSoles(Number(pago.vuelto)));
    contenedor.append(dlEf);
  }

  if (subtotalProductos !== null) {
    const granTotal = redondear(subtotalProductos + monto);
    const total = el('div', undefined, 'boleta__total');
    total.append(el('span', 'Total del pedido'), el('strong', formatearSoles(granTotal)));
    const { t: tRes, tbody: bRes } = tabla(['', 'Resumen de pago', '', 'Importe']);
    fila(bRes, ['', 'Productos', '', formatearSoles(subtotalProductos)]);
    fila(bRes, ['', 'Delivery', '', formatearSoles(monto)]);
    fila(bRes, ['', 'Pagado ahora (delivery)', '', formatearSoles(monto)], 'pagado');
    fila(bRes, ['', 'Por pagar al recibir (productos)', '', formatearSoles(subtotalProductos)], 'pagado');
    contenedor.append(total, tRes);
  } else {
    const total = el('div', undefined, 'boleta__total');
    total.append(el('span', 'Total pagado'), el('strong', formatearSoles(monto)));
    contenedor.append(total);
  }

  contenedor.append(el('p', 'Gracias por su compra. Conserve esta boleta como constancia de pago.', 'boleta__pie'));
}

document.querySelector('#imprimir').addEventListener('click', () => window.print());
