import { sql } from '../config/neon-config.js';
import { exigirSesion } from '../auth/auth.js';
import { leerFormulario, validarPedido, mostrarErrores, llenarFormulario, mostrarToast, escapar, formatearMoneda, formatearFechaISO, hoyISO, normalizar } from '../config/utils.js';

const usuario = exigirSesion(['administrador', 'empleado']);

export const turnoActual = () => { const h = new Date().getHours(); return h >= 6 && h < 14 ? 'manana' : h >= 14 && h < 22 ? 'tarde' : 'noche'; };
const TURNOS = { manana: 'mañana (6:00 a 14:00)', tarde: 'tarde (14:00 a 22:00)', noche: 'noche-madrugada (22:00 a 6:00)' };
const puedeModificar = usuario.rol === 'administrador' || usuario.turno === turnoActual();

export async function listarTodos() {
  return await sql`
    SELECT p.id, p.codigo_seguimiento, p.id_usuario, u.nombre AS cliente,
           p.nombre_contacto, p.telefono, p.direccion, p.distrito, p.referencia, p.sede_atencion,
           to_char(p.fecha_entrega, 'YYYY-MM-DD') AS fecha_entrega, p.franja_horaria, p.metodo_pago,
           p.detalle_pedido, p.total::float AS total, p.estado,
           to_char(p.fecha_registro, 'DD/MM/YYYY HH24:MI') AS fecha_txt
    FROM pedidos_delivery_megamercado p
    LEFT JOIN usuarios u ON u.id = p.id_usuario
    ORDER BY p.fecha_registro DESC, p.id DESC;
  `;
}

export async function crearRegistro(d) {
  const codigo = 'COD-' + Date.now().toString().slice(-8);
  await sql`
    INSERT INTO pedidos_delivery_megamercado
      (codigo_seguimiento, nombre_contacto, telefono, direccion, distrito, referencia, sede_atencion,
       fecha_entrega, franja_horaria, metodo_pago, detalle_pedido, total, estado)
    VALUES
      (${codigo}, ${d.nombre_contacto}, ${d.telefono}, ${d.direccion}, ${d.distrito}, ${d.referencia || null}, ${d.sede_atencion},
       ${d.fecha_entrega}, ${d.franja_horaria}, ${d.metodo_pago}, ${d.detalle_pedido}, ${d.total}, ${d.estado || 'registrado'});
  `;
  return codigo;
}

export async function actualizarComoPanel(id, d) {
  await sql`
    UPDATE pedidos_delivery_megamercado
    SET nombre_contacto = ${d.nombre_contacto}, telefono = ${d.telefono}, direccion = ${d.direccion},
        distrito = ${d.distrito}, referencia = ${d.referencia || null}, sede_atencion = ${d.sede_atencion},
        fecha_entrega = ${d.fecha_entrega}, franja_horaria = ${d.franja_horaria}, metodo_pago = ${d.metodo_pago},
        detalle_pedido = ${d.detalle_pedido}, total = ${d.total}, estado = ${d.estado}
    WHERE id = ${id};
  `;
}

export async function eliminarRegistro(id) {
  await sql`DELETE FROM pedidos_delivery_megamercado WHERE id = ${id};`;
}

const cuerpo = document.getElementById('tablaCuerpo');
const buscar = document.getElementById('buscar');
const filtroEstado = document.getElementById('filtroEstado');
const avisoError = document.getElementById('avisoError');
const dlgRegistro = document.getElementById('dlgRegistro');
const dlgEliminar = document.getElementById('dlgEliminar');
const form = document.getElementById('formRegistro');
const tituloDialogo = document.getElementById('tituloDialogo');
let registros = [];
let editandoId = null;
let eliminandoId = null;

document.getElementById('rolUsuario').textContent = usuario.rol;
const avisoTurno = document.getElementById('avisoTurno');
avisoTurno.textContent = usuario.rol === 'administrador' ? 'Administrador: puedes gestionar todos los pedidos en cualquier horario.'
  : puedeModificar ? `Turno ${TURNOS[usuario.turno]}: puedes crear, editar, cambiar estados y eliminar.`
    : `Tu turno es ${TURNOS[usuario.turno]}. Ahora corresponde el turno ${TURNOS[turnoActual()]}: puedes consultar, pero no modificar.`;
avisoTurno.classList.toggle('aviso-turno--bloqueado', !puedeModificar);
document.getElementById('btnNuevo').disabled = !puedeModificar;
document.getElementById('nombreUsuario').textContent = usuario.nombre;
form.fecha_entrega.min = '';

function pintarCifras() {
  const cuenta = (e) => registros.filter((r) => r.estado === e).length;
  document.getElementById('cifraTotal').textContent = registros.length;
  document.getElementById('cifraRegistrado').textContent = cuenta('registrado');
  document.getElementById('cifraAtendido').textContent = cuenta('atendido');
  document.getElementById('cifraRechazado').textContent = cuenta('rechazado');
}

function pintarTabla() {
  const q = normalizar(buscar.value);
  const visibles = registros.filter((r) =>
    (!filtroEstado.value || r.estado === filtroEstado.value) &&
    (!q || normalizar([r.codigo_seguimiento, r.nombre_contacto, r.cliente, r.distrito, r.detalle_pedido].join(' ')).includes(q)));
  document.getElementById('conteoTabla').textContent = `${visibles.length} de ${registros.length} pedidos`;
  if (!visibles.length) {
    cuerpo.innerHTML = `<tr><td colspan="8" class="vacio">No hay pedidos con esos filtros.</td></tr>`;
    return;
  }
  cuerpo.innerHTML = visibles.map((r) => `
    <tr>
      <td><strong>${escapar(r.codigo_seguimiento)}</strong><span class="sec">${escapar(r.fecha_txt)}</span></td>
      <td>${r.cliente ? escapar(r.cliente) : '<span class="presencial">Atención presencial / telefónica</span>'}</td>
      <td>${escapar(r.nombre_contacto)}<span class="sec">${escapar(r.telefono)}</span></td>
      <td>${escapar(r.direccion)}<span class="sec">${escapar(r.distrito)} · ${escapar(r.sede_atencion)}</span></td>
      <td>${formatearFechaISO(r.fecha_entrega)}<span class="sec">${escapar(r.franja_horaria)}</span></td>
      <td class="detalle">${escapar(r.detalle_pedido)}</td>
      <td><strong>${formatearMoneda(r.total)}</strong><span class="sec">${escapar(r.metodo_pago)}</span></td>
      <td><span class="estado estado--${r.estado}">${escapar(r.estado)}</span></td>
      <td class="acciones">
        <button type="button" class="btn btn--chico btn--borde" data-accion="editar" data-id="${r.id}" ${puedeModificar ? '' : 'disabled'} aria-label="Editar ${escapar(r.codigo_seguimiento)}">Editar</button>
        <button type="button" class="btn btn--chico btn--peligro" data-accion="eliminar" data-id="${r.id}" ${puedeModificar ? '' : 'disabled'} aria-label="Eliminar ${escapar(r.codigo_seguimiento)}">Eliminar</button>
      </td>
    </tr>`).join('');
}

async function recargar() {
  try {
    registros = await listarTodos();
    avisoError.hidden = true;
    pintarCifras();
    pintarTabla();
  } catch (err) {
    console.error(err);
    avisoError.textContent = 'No pudimos cargar los pedidos. Actualiza la página o revisa la conexión a Neon.';
    avisoError.hidden = false;
  }
}

function abrirFormulario(registro = null) {
  editandoId = registro ? registro.id : null;
  form.reset();
  mostrarErrores(form, {});
  tituloDialogo.textContent = registro ? `Editar ${registro.codigo_seguimiento}` : 'Nuevo pedido (atención presencial o telefónica)';
  if (registro) llenarFormulario(form, registro);
  else { form.fecha_entrega.value = hoyISO(); form.estado.value = 'registrado'; }
  dlgRegistro.showModal();
}

document.getElementById('btnNuevo').addEventListener('click', () => abrirFormulario());
document.getElementById('btnCancelar').addEventListener('click', () => dlgRegistro.close());
buscar.addEventListener('input', pintarTabla);
filtroEstado.addEventListener('change', pintarTabla);

cuerpo.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-accion]');
  if (!b) return;
  const r = registros.find((x) => x.id === Number(b.dataset.id));
  if (!r) return;
  if (b.dataset.accion === 'editar') return abrirFormulario(r);
  eliminandoId = r.id;
  document.getElementById('textoEliminar').textContent = `¿Eliminar el pedido ${r.codigo_seguimiento} de ${r.nombre_contacto}? Esta acción no se puede deshacer.`;
  dlgEliminar.showModal();
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!puedeModificar) return mostrarToast('Fuera de tu turno no puedes modificar pedidos', 'error');
  const datos = leerFormulario(form);
  const errores = validarPedido(datos, editandoId ? registros.find((r) => r.id === editandoId)?.fecha_entrega : null);
  mostrarErrores(form, errores);
  if (Object.keys(errores).length) return;
  const boton = form.querySelector('button[type="submit"]');
  boton.disabled = true;
  try {
    if (editandoId) { await actualizarComoPanel(editandoId, datos); mostrarToast('Pedido actualizado'); }
    else { const c = await crearRegistro(datos); mostrarToast('Pedido creado: ' + c); }
    dlgRegistro.close();
    await recargar();
  } catch (err) {
    console.error(err);
    mostrarToast('No se pudo guardar el pedido', 'error');
  } finally {
    boton.disabled = false;
  }
});

document.getElementById('btnNoEliminar').addEventListener('click', () => dlgEliminar.close());
document.getElementById('btnSiEliminar').addEventListener('click', async () => {
  const boton = document.getElementById('btnSiEliminar');
  if (!puedeModificar) { dlgEliminar.close(); return mostrarToast('Fuera de tu turno no puedes eliminar pedidos', 'error'); }
  boton.disabled = true;
  try {
    await eliminarRegistro(eliminandoId);
    dlgEliminar.close();
    mostrarToast('Pedido eliminado');
    await recargar();
  } catch (err) {
    console.error(err);
    mostrarToast('No se pudo eliminar el pedido', 'error');
  } finally {
    boton.disabled = false;
  }
});

await recargar();