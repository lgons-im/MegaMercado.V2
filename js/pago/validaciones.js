    export const soloDigitos = (t) => String(t ?? '').replace(/\D/g, '');

export function validarLuhn(numero) {
  const d = soloDigitos(numero);
  if (d.length < 13 || d.length > 19) return false;
  let suma = 0, duplicar = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = Number(d[i]);
    if (duplicar) { n *= 2; if (n > 9) n -= 9; }
    suma += n;
    duplicar = !duplicar;
  }
  return suma % 10 === 0;
}

export function detectarMarca(numero) {
  const n = soloDigitos(numero);
  if (/^4/.test(n)) return 'Visa';
  if (/^(5[1-5]|222[1-9]|22[3-9]\d|2[3-6]\d{2}|27[01]\d|2720)/.test(n)) return 'Mastercard';
  if (/^3[47]/.test(n)) return 'American Express';
  return null;
}

const LONGITUDES = { 'Visa': [13, 16, 19], 'Mastercard': [16], 'American Express': [15] };
export const longitudValida = (numero, marca) =>
  (LONGITUDES[marca] ?? []).includes(soloDigitos(numero).length);

export const formatearNumeroTarjeta = (v) =>
  soloDigitos(v).slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');

export function formatearVencimiento(v) {
  const d = soloDigitos(v).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

export function validarVencimiento(texto, hoy = new Date()) {
  const m = /^(\d{2})\/(\d{2})$/.exec(texto ?? '');
  if (!m) return null;
  const mes = Number(m[1]);
  const anio = 2000 + Number(m[2]);
  if (mes < 1 || mes > 12) return null;
  return new Date(anio, mes, 1) > hoy ? { mes, anio } : null;
}

export function validarCVV(cvv, marca) {
  const largo = marca === 'American Express' ? 4 : 3;
  return new RegExp(`^\\d{${largo}}$`).test(cvv ?? '');
}

export const validarTitular = (n) => /^[A-Za-zÁÉÍÓÚÑáéíóúñ ]{5,60}$/.test((n ?? '').trim());
export const validarCelular = (c) => /^9\d{8}$/.test(soloDigitos(c));
export const validarCodigoAprobacion = (c) => /^\d{6}$/.test(c ?? '');

export const enmascararTarjeta = (n) => '**** ' + soloDigitos(n).slice(-4);
export const enmascararCelular = (c) => '*** *** ' + soloDigitos(c).slice(-3);

export function generarCodigoOperacion(prefijo = 'OP') {
  const aleatorio = Math.floor(Math.random() * 900 + 100);
  return `${prefijo}-${Date.now().toString().slice(-8)}${aleatorio}`;
}

export function validarFormularioTarjeta({ numero, vencimiento, cvv, titular }) {
  const errores = {};
  const marca = detectarMarca(numero);
  if (!marca) errores.numero = 'Marca de tarjeta no reconocida.';
  else if (!longitudValida(numero, marca)) errores.numero = `Una tarjeta ${marca} no tiene esa cantidad de dígitos.`;
  else if (!validarLuhn(numero)) errores.numero = 'El número de tarjeta no es válido.';

  const venc = validarVencimiento(vencimiento);
  if (!venc) errores.vencimiento = 'Fecha inválida o tarjeta vencida (formato MM/AA).';

  if (!validarCVV(cvv, marca)) {
    errores.cvv = marca === 'American Express' ? 'El CVV tiene 4 dígitos.' : 'El CVV tiene 3 dígitos.';
  }
  if (!validarTitular(titular)) errores.titular = 'Escribe el nombre como figura en la tarjeta.';

  return { valido: Object.keys(errores).length === 0, errores, marca, venc };
}