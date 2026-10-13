export const escapar = (t) =>
  String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const formatearMoneda = (n) => 'S/ ' + Number(n).toFixed(2);

export const normalizar = (t) =>
  String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export const hoyISO = () => new Date().toLocaleDateString('en-CA');

export function formatearFechaISO(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

export function mostrarToast(mensaje, tipo = 'ok') {
  let zona = document.getElementById('toast');
  if (!zona) {
    zona = document.createElement('div');
    zona.id = 'toast';
    zona.setAttribute('role', 'status');
    document.body.append(zona);
  }
  const t = document.createElement('p');
  t.className = 'toast exito' + (tipo === 'error' ? ' toast--error' : '');
  t.style.margin = '0';
  t.textContent = mensaje;
  zona.append(t);
  setTimeout(() => t.remove(), 3500);
}

export function leerFormulario(form) {
  const d = Object.fromEntries(new FormData(form));
  for (const k in d) if (typeof d[k] === 'string') d[k] = d[k].trim();
  if ('total' in d) d.total = Number(d.total);
  return d;
}

export function validarPedido(d, fechaOriginal = null) {
  const e = {};
  if (!d.nombre_contacto || d.nombre_contacto.length < 3) e.nombre_contacto = 'Escribe el nombre de quien recibe (mínimo 3 letras).';
  if (!/^9\d{8}$/.test(d.telefono || '')) e.telefono = 'Ingresa un celular de 9 dígitos que empiece con 9.';
  if (!d.direccion || d.direccion.length < 5) e.direccion = 'Escribe la dirección de entrega completa.';
  if (!d.distrito) e.distrito = 'Indica el distrito.';
  if (!d.sede_atencion) e.sede_atencion = 'Elige la sede que atenderá el pedido.';
  if (!d.fecha_entrega) e.fecha_entrega = 'Elige la fecha de entrega.';
  else if (d.fecha_entrega < hoyISO() && d.fecha_entrega !== fechaOriginal) e.fecha_entrega = 'La fecha de entrega no puede ser anterior a hoy.';
  if (!d.franja_horaria) e.franja_horaria = 'Elige una franja horaria.';
  if (!d.metodo_pago) e.metodo_pago = 'Elige cómo vas a pagar.';
  if (!d.detalle_pedido || d.detalle_pedido.length < 5) e.detalle_pedido = 'Escribe qué productos necesitas.';
  if (!(d.total > 0)) e.total = 'El total debe ser mayor a S/ 0.00.';
  return e;
}

export function mostrarErrores(form, errores) {
  for (const el of form.elements) {
    if (!el.name) continue;
    const msg = errores[el.name];
    const p = form.querySelector(`[data-error-for="${el.name}"]`);
    if (p) p.textContent = msg || '';
    el.setAttribute('aria-invalid', msg ? 'true' : 'false');
  }
  const primero = Object.keys(errores)[0];
  if (primero) form.elements[primero]?.focus();
}

export function llenarFormulario(form, r) {
  for (const el of form.elements) {
    if (el.name && r[el.name] !== undefined && r[el.name] !== null) el.value = r[el.name];
  }
}
