import { sql } from '../config/neon-config.js';
import { exigirSesion } from '../auth/auth.js';
import { leerFormulario, validarPedido, mostrarErrores, llenarFormulario, mostrarToast } from '../config/utils.js';

const usuario = exigirSesion(['cliente']);

export async function obtenerMiRegistro(id) {
  const filas = await sql`
    SELECT id, codigo_seguimiento, nombre_contacto, telefono, direccion, distrito, referencia, sede_atencion,
           to_char(fecha_entrega, 'YYYY-MM-DD') AS fecha_entrega, franja_horaria, metodo_pago,
           detalle_pedido, total::float AS total, estado
    FROM pedidos_delivery_megamercado
    WHERE id = ${id} AND id_usuario = ${usuario.id};
  `;
  return filas[0] || null;
}

export async function actualizarRegistro(id, d) {
  const filas = await sql`
    UPDATE pedidos_delivery_megamercado
    SET nombre_contacto = ${d.nombre_contacto}, telefono = ${d.telefono}, direccion = ${d.direccion},
        distrito = ${d.distrito}, referencia = ${d.referencia || null}, sede_atencion = ${d.sede_atencion},
        fecha_entrega = ${d.fecha_entrega}, franja_horaria = ${d.franja_horaria},
        metodo_pago = ${d.metodo_pago}, detalle_pedido = ${d.detalle_pedido}, total = ${d.total}
    WHERE id = ${id} AND id_usuario = ${usuario.id} AND estado = 'registrado'
    RETURNING id;
  `;
  return filas.length === 1;
}

const form = document.getElementById('formPedido');
const aviso = document.getElementById('avisoError');
const bloqueo = document.getElementById('avisoEstado');
const titulo = document.getElementById('tituloCodigo');
const id = Number(new URLSearchParams(location.search).get('id'));

function fallo(texto) {
  form.hidden = true;
  aviso.textContent = texto;
  aviso.hidden = false;
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
  if (original.estado !== 'registrado') {
    form.querySelectorAll('input, select, textarea, button[type="submit"]').forEach((el) => (el.disabled = true));
    bloqueo.textContent = `Este pedido está "${original.estado}" y ya no se puede editar. Solo puedes verlo.`;
    bloqueo.hidden = false;
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  aviso.hidden = true;
  const datos = leerFormulario(form);
  const errores = validarPedido(datos, original.fecha_entrega);
  mostrarErrores(form, errores);
  if (Object.keys(errores).length) return;

  const boton = form.querySelector('button[type="submit"]');
  boton.disabled = true;
  try {
    const ok = await actualizarRegistro(id, datos);
    if (!ok) throw new Error('El pedido ya fue atendido o no te pertenece');
    mostrarToast('Pedido actualizado');
    setTimeout(() => (window.location.href = 'consulta.html'), 1200);
  } catch (err) {
    console.error(err);
    aviso.textContent = 'No se pudo actualizar: quizá el pedido ya fue atendido. Vuelve a Mis pedidos para verlo.';
    aviso.hidden = false;
    boton.disabled = false;
  }
});