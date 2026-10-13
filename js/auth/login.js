import { registrarUsuario, iniciarSesion, obtenerSesion } from './auth.js';

const tabs = [...document.querySelectorAll('[role="tab"]')];
const paneles = [...document.querySelectorAll('[role="tabpanel"]')];
const formLogin = document.getElementById('formLogin');
const formCuenta = document.getElementById('formCuenta');
const avisoLogin = document.getElementById('avisoLogin');
const avisoCuenta = document.getElementById('avisoCuenta');

function irARol(u) {
  window.location.href = u.rol === 'cliente' ? 'registro.html' : 'panel.html';
}
const ya = obtenerSesion();
if (ya) irARol(ya);

function activar(nombre) {
  tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === nombre)));
  paneles.forEach((p) => (p.hidden = p.id !== 'panel-' + nombre));
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => activar(t.dataset.tab));
  t.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const sig = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
    sig.focus();
    activar(sig.dataset.tab);
  });
});
document.getElementById('irACuenta').addEventListener('click', () => activar('cuenta'));
if (location.hash === '#cuenta') activar('cuenta');

function aviso(el, texto, tipo) {
  el.textContent = texto;
  el.className = 'aviso aviso--' + tipo;
  el.hidden = !texto;
}

formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  const correo = formLogin.correo.value.trim();
  const clave = formLogin.contrasena.value;
  if (!correo || !clave) return aviso(avisoLogin, 'Ingresa tu correo y tu contraseña.', 'error');
  const boton = formLogin.querySelector('button[type="submit"]');
  boton.disabled = true;
  try {
    const u = await iniciarSesion(correo, clave);
    if (!u) return aviso(avisoLogin, 'Correo o contraseña incorrectos. Revisa los datos e inténtalo otra vez.', 'error');
    irARol(u);
  } catch (err) {
    console.error(err);
    aviso(avisoLogin, 'No pudimos conectar con la base de datos. Inténtalo en unos minutos.', 'error');
  } finally {
    boton.disabled = false;
  }
});

formCuenta.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nombre = formCuenta.nombre.value.trim();
  const correo = formCuenta.correo.value.trim();
  const clave = formCuenta.contrasena.value;
  if (nombre.length < 3) return aviso(avisoCuenta, 'Escribe tu nombre completo.', 'error');
  if (clave.length < 6) return aviso(avisoCuenta, 'La contraseña debe tener al menos 6 caracteres.', 'error');
  if (clave !== formCuenta.repetir.value) return aviso(avisoCuenta, 'Las contraseñas no coinciden.', 'error');
  const boton = formCuenta.querySelector('button[type="submit"]');
  boton.disabled = true;
  try {
    await registrarUsuario(nombre, correo, clave);
    formCuenta.reset();
    activar('login');
    formLogin.correo.value = correo;
    aviso(avisoLogin, 'Cuenta creada. Ahora inicia sesión con tu correo y contraseña.', 'ok');
  } catch (err) {
    console.error(err);
    const repetido = err?.code === '23505' || /duplicate|unique/i.test(err?.message || '');
    aviso(avisoCuenta, repetido ? 'Ese correo ya tiene una cuenta. Inicia sesión.' : 'No pudimos crear la cuenta. Inténtalo otra vez.', 'error');
  } finally {
    boton.disabled = false;
  }
});
