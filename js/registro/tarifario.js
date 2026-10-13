// js/registro/tarifario.js
// Función PURA: recibe datos y devuelve un número. No toca el DOM ni la base de datos.

export function redondear(valor) {
  return Math.round(valor * 100) / 100;
}

export function formatearSoles(monto) {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(monto);
}

// Un checkbox marcado llega en FormData como 'on'; si no está marcado, NO llega
export const marcado = (valor) => valor === 'on';

// MegaMercado: S/ 8.00 base (hasta 5 kg) + S/ 1.50 por kg adicional + S/ 5.00 si incluye congelados
export function calcularMontoServicio(d) {
  const extra = Math.max(0, (Number(d.peso_kg) || 0) - 5);
  return redondear(8.00 + 1.50 * extra + (marcado(d.incluye_congelados) ? 5.00 : 0));
}