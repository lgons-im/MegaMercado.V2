import { sql } from '../config/neon-config.js';
import { exigirRol } from '../auth/auth.js';
import { buscarProducto } from '../config/productos.js';
import { leerCarrito, cambiarCantidad, vaciarCarrito } from './carrito.js';
import { escapar, formatearMoneda } from '../config/utils.js';
import { calcularMontoServicio, formatearSoles, marcado, redondear } from './tarifario.js';
import { pesoCarritoKg } from './peso.js';

const usuario = exigirRol('cliente');

const form = document.getElementById('formRegistro');
const aviso = document.getElementById('avisoRegistro');
const listaCarrito = document.getElementById('listaCarrito');
const carritoVacio = document.getElementById('carritoVacio');
const subtotalEl = document.getElementById('subtotalProductos');
const salidaProductos = document.getElementById('cotiz-productos');
const salidaMonto = document.getElementById('monto-estimado');
const salidaTotal = document.getElementById('total-estimado');
const salidaAhora = document.getElementById('pagas-ahora');
const botonEnviar = document.getElementById('botonEnviar');
const pesoInput = form.elements.peso_kg;
const pesoEstimadoEl = document.getElementById('pesoEstimado');
let pesoManual = false;   // true si el cliente escribió su propio peso

function mostrarAviso(texto, tipo = 'error') {
  aviso.textContent = texto;
  aviso.className = `aviso aviso--${tipo}`;
  aviso.hidden = !texto;
  if (texto) aviso.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ---------- Productos del carrito (precio y descripción salen de productos.js) ----------
function lineasCarrito() {
  return Object.entries(leerCarrito())
    .map(([id, cant]) => ({ p: buscarProducto(Number(id)), cant }))
    .filter((l) => l.p);
}
const subtotalDe = (lineas) => redondear(lineas.reduce((a, l) => a + l.p.precio * l.cant, 0));

function pintarCarrito() {
  const lineas = lineasCarrito();
  carritoVacio.hidden = lineas.length > 0;
  botonEnviar.disabled = lineas.length === 0;
  subtotalEl.textContent = formatearMoneda(subtotalDe(lineas));
  sincronizarPeso(lineas);
  listaCarrito.innerHTML = lineas.map(({ p, cant }) => `
    <li class="linea">
      <img src="${escapar(p.img.trim())}" alt="" width="56" height="56" loading="lazy">
      <div class="linea__datos">
        <strong>${escapar(p.nombre)}</strong>
        <span>${escapar(p.presentacion)} · ${formatearMoneda(p.precio)} c/u</span>
      </div>
      <div class="cantidad" role="group" aria-label="Cantidad de ${escapar(p.nombre)}">
        <button type="button" data-accion="restar" data-id="${p.id}" aria-label="Quitar una unidad de ${escapar(p.nombre)}">−</button>
        <span aria-live="polite">${cant}</span>
        <button type="button" data-accion="sumar" data-id="${p.id}" aria-label="Agregar una unidad de ${escapar(p.nombre)}">+</button>
      </div>
      <span class="linea__importe">${formatearMoneda(p.precio * cant)}</span>
    </li>`).join('');
}

listaCarrito.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-accion]');
  if (!b) return;
  cambiarCantidad(Number(b.dataset.id), b.dataset.accion === 'restar' ? -1 : 1);
});
window.addEventListener('carrito:cambio', pintarCarrito);

// ---------- Peso estimado según los productos ----------
function sincronizarPeso(lineas = lineasCarrito()) {
  const kg = pesoCarritoKg(lineas);
  pesoEstimadoEl.textContent = `${kg.toFixed(1)} kg`;
  if (!pesoManual) pesoInput.value = kg > 0 ? kg : '';
  actualizarCotizacion();
}
pesoInput.addEventListener('input', () => { pesoManual = true; });
document.getElementById('usarEstimado').addEventListener('click', () => {
  pesoManual = false;
  sincronizarPeso();
});

// ---------- Cotizador en vivo: productos + delivery = total ----------
const leerFormulario = () => Object.fromEntries(new FormData(form));

function actualizarCotizacion() {
  const delivery = calcularMontoServicio(leerFormulario());
  const productos = subtotalDe(lineasCarrito());
  salidaProductos.textContent = formatearSoles(productos);
  salidaMonto.textContent = formatearSoles(delivery);
  salidaTotal.textContent = formatearSoles(redondear(productos + delivery));   // total del pedido
  salidaAhora.textContent = formatearSoles(delivery);                           // lo que se paga ahora
}
form.addEventListener('input', actualizarCotizacion);
form.addEventListener('change', actualizarCotizacion);

form.elements.fecha_entrega.min = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

// ---------- Registrar el pedido ----------
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  mostrarAviso('');

  const lineas = lineasCarrito();
  if (lineas.length === 0) return mostrarAviso('Tu pedido no tiene productos. Agrégalos desde el catálogo.');
  if (!form.checkValidity()) {
    form.reportValidity();
    return mostrarAviso('Revisa los campos marcados: hay datos incompletos o inválidos.');
  }

  const datos = leerFormulario();
  // Todo se recalcula aquí: no se confía en lo que muestra la pantalla
  const delivery = calcularMontoServicio(datos);
  const subtotal = subtotalDe(lineas);
  const total = redondear(subtotal + delivery);
  const detalle = lineas.map((l) => `${l.cant} x ${l.p.nombre} (${l.p.presentacion})`).join('; ')
    + ` | Subtotal productos: ${formatearSoles(subtotal)}`;
  const codigo = 'SOL-' + Date.now().toString().slice(-8);

  botonEnviar.disabled = true;
  botonEnviar.textContent = 'Registrando...';
  try {
    const filas = await sql`
      INSERT INTO pedidos_delivery_megamercado
        (codigo_seguimiento, nombre_contacto, telefono, direccion, distrito, referencia,
         sede_atencion, fecha_entrega, franja_horaria, metodo_pago, detalle_pedido,
         peso_kg, incluye_congelados, subtotal_productos, costo_delivery,
         total, monto_calculado, estado_pago, estado, id_usuario)
      VALUES
        (${codigo}, ${datos.nombre_contacto.trim()}, ${datos.telefono}, ${datos.direccion.trim()},
         ${datos.distrito.trim()}, ${datos.referencia?.trim() || null}, ${datos.sede_atencion},
         ${datos.fecha_entrega}, ${datos.franja_horaria}, 'pendiente', ${detalle},
         ${Number(datos.peso_kg)}, ${marcado(datos.incluye_congelados)}, ${subtotal}, ${delivery},
         ${total}, ${total}, 'pendiente', 'registrado', ${usuario.id})
      RETURNING id;
    `;
    vaciarCarrito();
    window.location.href = `pago.html?id=${filas[0].id}`;
  } catch (error) {
    console.error(error);
    mostrarAviso(`No se pudo registrar el pedido. Detalle: ${error.message ?? 'error desconocido'}`);
    botonEnviar.disabled = false;
    botonEnviar.textContent = 'Registrar y pagar';
  }
});

pintarCarrito();
actualizarCotizacion();
