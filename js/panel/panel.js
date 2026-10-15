import { sql } from '../config/neon-config.js';
import { exigirSesion } from '../auth/auth.js';
import { leerFormulario, validarPedido, mostrarErrores, llenarFormulario, mostrarToast, escapar, formatearMoneda, formatearFechaISO, hoyISO, normalizar } from '../config/utils.js';
import { calcularMontoServicio, formatearSoles } from '../registro/tarifario.js';

const usuario = exigirSesion(['administrador', 'empleado']);

export const turnoActual = () => { const h = new Date().getHours(); return h >= 6 && h < 14 ? 'manana' : h >= 14 && h < 22 ? 'tarde' : 'noche'; };
const TURNOS = { manana: 'mañana (6:00 a 14:00)', tarde: 'tarde (14:00 a 22:00)', noche: 'noche-madrugada (22:00 a 6:00)' };
const puedeModificar = usuario.rol === 'administrador' || usuario.turno === turnoActual();

// Adapta los datos del formulario al formato que espera tarifario.js
const tarifa = (d) => ({ peso_kg: d.peso_kg, incluye_congelados: d.incluye_congelados ? 'on' : '' });

export async function listarTodos() {
  return await sql`
    SELECT p.id, p.codigo_seguimiento, p.id_usuario, u.nombre AS cliente,
           p.nombre_contacto, p.telefono, p.direccion, p.distrito, p.referencia, p.sede_atencion,
           to_char(p.fecha_entrega, 'YYYY-MM-DD') AS fecha_entrega, p.franja_horaria, p.metodo_pago,
           p.detalle_pedido, p.total::float AS total, p.estado,
           p.monto_calculado::float AS monto, p.estado_pago, p.canal_pago,
           p.peso_kg::float AS peso_kg, p.incluye_congelados,
           to_char(p.fecha_registro, 'DD/MM/YYYY HH24:MI') AS fecha_txt
    FROM pedidos_delivery_megamercado p
    LEFT JOIN usuarios u ON u.id = p.id_usuario
    ORDER BY p.fecha_registro DESC, p.id DESC;
  `;
}

export async function crearRegistro(d) {
  const codigo = 'COD-' + Date.now().toString().slice(-8);
  const monto = calcularMontoServicio(tarifa(d));
  await sql`
    INSERT INTO pedidos_delivery_megamercado
      (codigo_seguimiento, nombre_contacto, telefono, direccion, distrito, referencia, sede_atencion,
       fecha_entrega, franja_horaria, metodo_pago, detalle_pedido,
       peso_kg, incluye_congelados, total, monto_calculado, estado_pago, estado)
    VALUES
      (${codigo}, ${d.nombre_contacto}, ${d.telefono}, ${d.direccion}, ${d.distrito}, ${d.referencia || null}, ${d.sede_atencion},
       ${d.fecha_entrega}, ${d.franja_horaria}, 'pendiente', ${d.detalle_pedido},
       ${Number(d.peso_kg)}, ${Boolean(d.incluye_congelados)}, ${monto}, ${monto},
       ${monto === 0 ? 'exonerado' : 'pendiente'}, ${d.estado || 'registrado'});
  `;
  return codigo;   // el cliente presencial paga luego en caja.html buscando este código
}

// Si el pedido ya está pagado NO se tocan peso, congelados ni monto: el pago ya los respalda.
// El panel nunca modifica estado_pago a mano.
export async function actualizarComoPanel(id, d, yaPagado) {
  if (yaPagado) {
    await sql`
      UPDATE pedidos_delivery_megamercado
      SET nombre_contacto = ${d.nombre_contacto}, telefono = ${d.telefono}, direccion = ${d.direccion},
          distrito = ${d.distrito}, referencia = ${d.referencia || null}, sede_atencion = ${d.sede_atencion},
          fecha_entrega = ${d.fecha_entrega}, franja_horaria = ${d.franja_horaria},
          detalle_pedido = ${d.detalle_pedido}, estado = ${d.estado}
      WHERE id = ${id};
    `;
    return true;
  }
  const monto = calcularMontoServicio(tarifa(d));
  const filas = await sql`
    UPDATE pedidos_delivery_megamercado
    SET nombre_contacto = ${d.nombre_contacto}, telefono = ${d.telefono}, direccion = ${d.direccion},
        distrito = ${d.distrito}, referencia = ${d.referencia || null}, sede_atencion = ${d.sede_atencion},
        fecha_entrega = ${d.fecha_entrega}, franja_horaria = ${d.franja_horaria},
        detalle_pedido = ${d.detalle_pedido}, estado = ${d.estado},
        peso_kg = ${Number(d.peso_kg)}, incluye_congelados = ${Boolean(d.incluye_congelados)},
        total = ${monto}, monto_calculado = ${monto},
        estado_pago = ${monto === 0 ? 'exonerado' : 'pendiente'}
    WHERE id = ${id} AND estado_pago <> 'pagado'
    RETURNING id;
  `;
  return filas.length === 1;   // false: se pagó mientras se editaba
}

export async function eliminarRegistro(id) {
  try {
    await sql`DELETE FROM pedidos_delivery_megamercado WHERE id = ${id};`;
    return { ok: true };
  } catch (error) {
    // 23503 = llave foránea: el pedido tiene pagos (aprobados o rechazados)
    if (error.code === '23503') {
      return { ok: false, mensaje: 'No se puede eliminar: tiene historial de pagos. Cambia su estado a "rechazado".' };
    }
    throw error;
  }
}

const cuerpo = document.getElementById('tablaCuerpo');
const buscar = document.getElementById('buscar');
const filtroEstado = document.getElementById('filtroEstado');
const avisoError = document.getElementById('avisoError');
const dlgRegistro = document.getElementById('dlgRegistro');
const dlgEliminar = document.getElementById('dlgEliminar');
const form = document.getElementById('formRegistro');
const tituloDialogo = document.getElementById('tituloDialogo');
const salidaMonto = document.getElementById('monto-estimado');
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

const ETIQUETA_PAGO = { pendiente: 'Pendiente', pagado: 'Pagado', exonerado: 'Exonerado' };
const ETIQUETA_CANAL = { pasarela: 'En línea', caja: 'Ventanilla' };

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
    cuerpo.innerHTML = `<tr><td colspan="10" class="vacio">No hay pedidos con esos filtros.</td></tr>`;
    return;
  }
  cuerpo.innerHTML = visibles.map((r) => `
    <tr>
      <td><strong>${escapar(r.codigo_seguimiento)}</strong><span class="sec">${escapar(r.fecha_txt)}</span></td>
      <td>${r.cliente ? escapar(r.cliente) : '<span class="presencial">Atención presencial / telefónica</span>'}</td>
      <td>${escapar(r.nombre_contacto)}<span class="sec">${escapar(r.telefono)}</span></td>
      <td>${escapar(r.direccion)}<span class="sec">${escapar(r.distrito)} · ${escapar(r.sede_atencion)}</span></td>
      <td>${formatearFechaISO(r.fecha_entrega)}<span class="sec">${escapar(r.franja_horaria)}</span></td>
      <td class="detalle">${escapar(r.detalle_pedido)}<span class="sec">${escapar(String(r.peso_kg))} kg${r.incluye_congelados ? ' · congelados' : ''}</span></td>
      <td><strong>${formatearMoneda(r.monto)}</strong></td>
      <td><span class="estado estado--${escapar(r.estado_pago)}">${escapar(ETIQUETA_PAGO[r.estado_pago] ?? r.estado_pago)}</span>${r.canal_pago ? `<span class="sec">${escapar(ETIQUETA_CANAL[r.canal_pago] ?? r.canal_pago)}</span>` : ''}</td>
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

function datosTarifaForm() {
  return { peso_kg: form.elements.peso_kg.value || 0, incluye_congelados: form.elements.incluye_congelados.checked };
}
function actualizarCotizacion() {
  salidaMonto.textContent = formatearSoles(calcularMontoServicio(tarifa(datosTarifaForm())));
}
form.addEventListener('input', actualizarCotizacion);
form.addEventListener('change', actualizarCotizacion);

function abrirFormulario(registro = null) {
  editandoId = registro ? registro.id : null;
  form.reset();
  mostrarErrores(form, {});
  const pagado = registro?.estado_pago === 'pagado';
  form.elements.peso_kg.disabled = pagado;
  form.elements.incluye_congelados.disabled = pagado;
  document.getElementById('avisoPagado').hidden = !pagado;
  tituloDialogo.textContent = registro ? `Editar ${registro.codigo_seguimiento}` : 'Nuevo pedido (atención presencial o telefónica)';
  if (registro) {
    llenarFormulario(form, registro);
    form.elements.peso_kg.value = registro.peso_kg;
    form.elements.incluye_congelados.checked = registro.incluye_congelados;
  } else {
    form.fecha_entrega.value = hoyISO();
    form.estado.value = 'registrado';
  }
  actualizarCotizacion();
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
  const actual = editandoId ? registros.find((r) => r.id === editandoId) : null;
  const yaPagado = actual?.estado_pago === 'pagado';

  const datos = leerFormulario(form);
  datos.peso_kg = yaPagado ? actual.peso_kg : form.elements.peso_kg.value;
  datos.incluye_congelados = yaPagado ? actual.incluye_congelados : form.elements.incluye_congelados.checked;
  // Campos que ya no están en el formulario pero que validarPedido puede exigir
  datos.metodo_pago = actual?.metodo_pago ?? 'pendiente';
  datos.total = yaPagado ? actual.monto : calcularMontoServicio(tarifa(datos));

  const errores = validarPedido(datos, actual?.fecha_entrega ?? null);
  const peso = Number(datos.peso_kg);
  if (!(peso > 0 && peso <= 100)) errores.peso_kg = 'Ingresa un peso entre 0.1 y 100 kg.';
  mostrarErrores(form, errores);
  if (Object.keys(errores).length) return;

  const boton = form.querySelector('button[type="submit"]');
  boton.disabled = true;
  try {
    if (editandoId) {
      const ok = await actualizarComoPanel(editandoId, datos, yaPagado);
      if (!ok) { mostrarToast('El pedido se pagó mientras lo editabas. Vuelve a abrirlo.', 'error'); dlgRegistro.close(); await recargar(); return; }
      mostrarToast('Pedido actualizado');
    } else {
      const c = await crearRegistro(datos);
      mostrarToast('Pedido creado: ' + c);
    }
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
    const resultado = await eliminarRegistro(eliminandoId);
    dlgEliminar.close();
    if (resultado.ok) {
      mostrarToast('Pedido eliminado');
      await recargar();
    } else {
      mostrarToast(resultado.mensaje, 'error');
    }
  } catch (err) {
    console.error(err);
    mostrarToast('No se pudo eliminar el pedido', 'error');
  } finally {
    boton.disabled = false;
  }
});

await recargar();