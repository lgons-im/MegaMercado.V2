import { sql } from '../config/neon-config.js';
import { exigirSesion } from '../auth/auth.js';
import { leerFormulario, validarPedido, mostrarErrores, llenarFormulario, mostrarToast } from '../config/utils.js';
import { calcularMontoServicio, formatearSoles } from '../registro/tarifario.js';

const usuario = exigirSesion(['cliente']);

export async function obtenerMiRegistro(id) {
  const filas = await sql`
    SELECT id, codigo_seguimiento, nombre_contacto, telefono, direccion, distrito, referencia, sede_atencion,
           to_char(fecha_entrega, 'YYYY-MM-DD') AS fecha_entrega, franja_horaria, metodo_pago,
           detalle_pedido, total::float AS total, estado,
           peso_kg::float AS peso_kg, incluye_congelados, estado_pago
    FROM pedidos_delivery_megamercado
    WHERE id = ${id} AND id_usuario = ${usuario.id};
  `;
  return filas[0] || null;
}

// El monto se recalcula aquí con la misma regla que en registro.js
export async function actualizarRegistro(id, d) {
  const monto = calcularMontoServicio({ peso_kg: d.peso_kg, incluye_congelados: d.incluye_congelados ? 'on' : '' });
  const filas = await sql`
    UPDATE pedidos_delivery_megamercado
    SET nombre_contacto = ${d.nombre_contacto}, telefono = ${d.telefono}, direccion = ${d.direccion},
        distrito = ${d.distrito}, referencia = ${d.referencia || null}, sede_atencion = ${d.sede_atencion},
        fecha_entrega = ${d.fecha_entrega}, franja_horaria = ${d.franja_horaria},
        detalle_pedido = ${d.detalle_pedido},
        peso_kg = ${Number(d.peso_kg)}, incluye_congelados = ${Boolean(d.incluye_congelados)},
        total = ${monto}, monto_calculado = ${monto},
        estado_pago = ${monto === 0 ? 'exonerado' : 'pendiente'}
    WHERE id = ${id} AND id_usuario = ${usuario.id}
      AND estado = 'registrado' AND estado_pago <> 'pagado'
    RETURNING id;
  `;
  return filas.length === 1;
}

const form = document.getElementById('formPedido');
const aviso = document.getElementById('avisoError');
const bloqueo = document.getElementById('avisoEstado');
const titulo = document.getElementById('tituloCodigo');
const salidaMonto = document.getElementById('monto-estimado');
const id = Number(new URLSearchParams(location.search).get('id'));

function fallo(texto) {
  form.hidden = true;
  aviso.textContent = texto;
  aviso.hidden = false;
}

function datosTarifa() {
  return {
    peso_kg: form.elements.peso_kg.value || 0,
    incluye_congelados: form.elements.incluye_congelados.checked ? 'on' : ''
  };
}

function actualizarCotizacion() {
  salidaMonto.textContent = formatearSoles(calcularMontoServicio(datosTarifa()));
}

let original = null;
let fallido = false;
if (!Number.isInteger(id) || id <= 0) {
  fallido = true;
  fallo('No indicaste qué pedido editar. Vuelve a Mis pedidos y elige uno.');
} else {
  try {
    original = await obtenerMiRegistro(id);
  } catch (err) {
    console.error(err);
    fallido = true;
    fallo('No pudimos cargar el pedido. Inténtalo otra vez.');
  }
  if (!original && !fallido) fallo('No encontramos ese pedido en tu cuenta.');
}

if (original) {
  titulo.textContent = original.codigo_seguimiento;
  llenarFormulario(form, original);
  form.elements.peso_kg.value = original.peso_kg;
  form.elements.incluye_congelados.checked = original.incluye_congelados;
  actualizarCotizacion();

  const bloqueado = original.estado !== 'registrado' || original.estado_pago === 'pagado';
  if (bloqueado) {
    form.querySelectorAll('input, select, textarea, button[type="submit"]').forEach((el) => (el.disabled = true));
    bloqueo.textContent = original.estado_pago === 'pagado'
      ? 'Este pedido ya fue pagado y no se puede editar. Solo puedes verlo.'
      : `Este pedido está "${original.estado}" y ya no se puede editar. Solo puedes verlo.`;
    bloqueo.hidden = false;
  }
}

form.addEventListener('input', actualizarCotizacion);
form.addEventListener('change', actualizarCotizacion);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  aviso.hidden = true;
  const datos = leerFormulario(form);
  datos.peso_kg = form.elements.peso_kg.value;
  datos.incluye_congelados = form.elements.incluye_congelados.checked;
  // Campos que ya no están en el formulario pero que validarPedido puede exigir
  datos.metodo_pago = original.metodo_pago;
  datos.total = calcularMontoServicio({
    peso_kg: datos.peso_kg,
    incluye_congelados: datos.incluye_congelados ? 'on' : ''
  });

  const errores = validarPedido(datos, original.fecha_entrega);
  const peso = Number(datos.peso_kg);
  if (!(peso > 0 && peso <= 100)) errores.peso_kg = 'Ingresa un peso entre 0.1 y 100 kg.';
  mostrarErrores(form, errores);
  if (Object.keys(errores).length) return;

  const boton = form.querySelector('button[type="submit"]');
  boton.disabled = true;
  try {
    const ok = await actualizarRegistro(id, datos);
    if (!ok) throw new Error('El pedido ya fue atendido, pagado o no te pertenece');
    mostrarToast('Pedido actualizado. Si cambió el costo, págalo desde Mis pedidos.');
    setTimeout(() => (window.location.href = 'consulta.html'), 1200);
  } catch (err) {
    console.error(err);
    aviso.textContent = 'No se pudo actualizar: quizá el pedido ya fue atendido o pagado. Vuelve a Mis pedidos para verlo.';
    aviso.hidden = false;
    boton.disabled = false;
  }
});