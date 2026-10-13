const CLAVE = 'mm_carrito';

export function leerCarrito() {
  try { return JSON.parse(localStorage.getItem(CLAVE)) || {}; } catch { return {}; }
}
function guardar(c) {
  localStorage.setItem(CLAVE, JSON.stringify(c));
  window.dispatchEvent(new Event('carrito:cambio'));
}
export function cambiarCantidad(id, delta) {
  const c = leerCarrito();
  const nueva = (c[id] || 0) + delta;
  if (nueva <= 0) delete c[id]; else c[id] = nueva;
  guardar(c);
}
export function vaciarCarrito() { guardar({}); }
export function totalUnidades() {
  return Object.values(leerCarrito()).reduce((a, n) => a + n, 0);
}
