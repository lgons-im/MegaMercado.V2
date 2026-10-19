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
let pesoManual = false;

function mostrarAviso(texto, tipo = 'error') {
  aviso.textContent = texto;
  aviso.className = `aviso aviso--${tipo}`;
  aviso.hidden = !texto;
  if (texto) aviso.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function lineasCarrito() {
  return Object.entries(leerCarrito())
    .map(([id, cant]) => ({ p: buscarProducto(Number(id)), cant: Number(cant) || 0 }))
    .filter((l) => l.p);
}

const subtotalDe = (lineas) => redondear(lineas.reduce((a, l) => a + (Number(l.p.precio) || 0) * l.cant, 0));

function pintarCarrito() {
  const lineas = lineasCarrito();
  const subtotal = subtotalDe(lineas);

  carritoVacio.hidden = lineas.length > 0;
  botonEnviar.disabled = lineas.length === 0;
  
  if (subtotalEl) {
    subtotalEl.textContent = formatearMoneda(subtotal);
  }

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

window.addEventListener('carrito:cambio', () => {
  pintarCarrito();
  actualizarCotizacion();
});

function sincronizarPeso(lineas = lineasCarrito()) {
  const kg = pesoCarritoKg(lineas);
  if (pesoEstimadoEl) {
    pesoEstimadoEl.textContent = `${kg.toFixed(1)} kg`;
  }
  if (!pesoManual && pesoInput) {
    pesoInput.value = kg > 0 ? kg : '';
  }
  actualizarCotizacion();
}

if (pesoInput) {
  pesoInput.addEventListener('input', () => { pesoManual = true; });
}

const botonUsarEstimado = document.getElementById('usarEstimado');
if (botonUsarEstimado) {
  botonUsarEstimado.addEventListener('click', () => {
    pesoManual = false;
    sincronizarPeso();
  });
}

const leerFormulario = () => Object.fromEntries(new FormData(form));

function actualizarCotizacion() {
  const delivery = Number(calcularMontoServicio(leerFormulario())) || 0;
  const productos = Number(subtotalDe(lineasCarrito())) || 0;
  const total = redondear(productos + delivery);

  if (salidaProductos) salidaProductos.textContent = formatearSoles(productos);
  if (salidaMonto) salidaMonto.textContent = formatearSoles(delivery);
  if (salidaTotal) salidaTotal.textContent = formatearSoles(total);
  if (salidaAhora) salidaAhora.textContent = formatearSoles(delivery);
}

form.addEventListener('input', actualizarCotizacion);
form.addEventListener('change', actualizarCotizacion);

if (form.elements.fecha_entrega) {
  form.elements.fecha_entrega.min = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
}

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
  const delivery = Number(calcularMontoServicio(datos)) || 0;
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
         peso_kg, incluye_congelados,
         total, monto_calculado, estado_pago, estado, id_usuario)
      VALUES
        (${codigo}, ${datos.nombre_contacto.trim()}, ${datos.telefono}, ${datos.direccion.trim()},
         ${datos.distrito.trim()}, ${datos.referencia?.trim() || null}, ${datos.sede_atencion},
         ${datos.fecha_entrega}, ${datos.franja_horaria}, 'pendiente', ${detalle},
         ${Number(datos.peso_kg)}, ${marcado(datos.incluye_congelados)},
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
