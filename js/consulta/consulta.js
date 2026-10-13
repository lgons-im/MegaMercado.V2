import { sql } from '../config/neon-config.js';
import { exigirSesion } from '../auth/auth.js';
import { escapar, formatearMoneda, formatearFechaISO } from '../config/utils.js';

const usuario = exigirSesion(['cliente']);

export async function listarMisRegistros() {
  return await sql`
    SELECT r.id, r.codigo_seguimiento, r.nombre_contacto, r.direccion, r.distrito, r.sede_atencion,
           to_char(r.fecha_entrega, 'YYYY-MM-DD') AS fecha_entrega, r.franja_horaria,
           r.detalle_pedido, r.monto_calculado::float AS monto, r.estado, r.estado_pago,
           p.codigo_operacion,
           to_char(r.fecha_registro, 'DD/MM/YYYY HH24:MI') AS fecha_txt
    FROM pedidos_delivery_megamercado r
    LEFT JOIN pagos p ON p.id_registro = r.id AND p.estado = 'aprobado'
    WHERE r.id_usuario = ${usuario.id}
    ORDER BY r.fecha_registro DESC, r.id DESC;
  `;
}

const lista = document.getElementById('listaPedidos');
const filtro = document.getElementById('filtroEstado');
const aviso = document.getElementById('avisoError');
const conteo = document.getElementById('conteo');
let pedidos = [];

const ETIQUETA_PAGO = { pendiente: 'Pago pendiente', pagado: 'Pagado', exonerado: 'Exonerado' };

function accionDePago(p) {
  if (p.estado_pago === 'pendiente') {
    return `<a class="btn btn--chico" href="pago.html?id=${p.id}">Pagar</a>`;
  }
  if (p.estado_pago === 'pagado' && p.codigo_operacion) {
    return `<a class="btn btn--chico btn--borde" href="comprobante.html?op=${encodeURIComponent(p.codigo_operacion)}">Ver comprobante</a>`;
  }
  return '';
}

function tarjeta(p) {
  // Un pedido pagado ya no se edita
  const editable = p.estado === 'registrado' && p.estado_pago !== 'pagado';
  return `<article class="pedido-card pedido-card--${p.estado}">
    <div>
      <h2>${escapar(p.codigo_seguimiento)} <span class="estado estado--${p.estado}">${escapar(p.estado)}</span></h2>
      <p class="meta">Registrado el ${escapar(p.fecha_txt)} · ${escapar(p.sede_atencion)}</p>
      <p>${escapar(p.detalle_pedido)}</p>
      <p class="meta">Entrega ${formatearFechaISO(p.fecha_entrega)}, ${escapar(p.franja_horaria)} · ${escapar(p.direccion)}, ${escapar(p.distrito)}</p>
      <p class="meta">${escapar(ETIQUETA_PAGO[p.estado_pago] ?? p.estado_pago)}</p>
    </div>
    <div class="pedido-card__lado">
      <span class="pedido-card__total">${formatearMoneda(p.monto)}</span>
      ${accionDePago(p)}
      <a class="btn btn--chico btn--borde" href="actualizar.html?id=${p.id}">${editable ? 'Editar pedido' : 'Ver detalle'}</a>
    </div>
  </article>`;
}

function pintar() {
  const visibles = filtro.value ? pedidos.filter((p) => p.estado === filtro.value) : pedidos;
  conteo.textContent = `${visibles.length} ${visibles.length === 1 ? 'pedido' : 'pedidos'}`;
  if (!visibles.length) {
    lista.innerHTML = `<div class="vacio"><p>${pedidos.length ? 'No tienes pedidos con ese estado.' : 'Todavía no tienes pedidos.'}</p><a class="btn" href="registro.html">Hacer mi primer pedido</a></div>`;
    return;
  }
  lista.innerHTML = visibles.map(tarjeta).join('');
}

filtro.addEventListener('change', pintar);
try {
  pedidos = await listarMisRegistros();
  pintar();
} catch (err) {
  console.error(err);
  lista.innerHTML = '';
  aviso.textContent = 'No pudimos cargar tus pedidos. Actualiza la página o inténtalo más tarde.';
  aviso.hidden = false;
}