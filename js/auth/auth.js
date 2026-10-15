import { sql } from '../config/neon-config.js';

export async function registrarUsuario(nombre, correo, contrasena) {
  await sql`
    INSERT INTO usuarios (nombre, correo, contrasena)
    VALUES (${nombre}, ${correo.toLowerCase()}, ${contrasena});
  `;
}

export async function iniciarSesion(correo, contrasena) {
  const filas = await sql`
    SELECT id, nombre, rol, turno FROM usuarios
    WHERE correo = ${correo.toLowerCase()} AND contrasena = ${contrasena};
  `;
  if (filas.length === 0) return null;
  sessionStorage.setItem('usuario', JSON.stringify(filas[0]));
  return filas[0];
}

export function cerrarSesion() {
  sessionStorage.removeItem('usuario');
  sessionStorage.removeItem('volver_a');
  window.location.href = 'login.html';
}

export function obtenerSesion() {
  try { return JSON.parse(sessionStorage.getItem('usuario')); } catch { return null; }
}

export function rutaInicioSegunRol(rol) {
  const rutas = {
    cliente: 'registro.html',
    administrador: 'panel.html',
    empleado: 'panel.html',
    cajero: 'caja.html'
  };
  return rutas[rol] ?? 'index.html';
}

export function exigirSesion(rolesPermitidos = null) {
  const u = obtenerSesion();
  if (!u) {
    sessionStorage.setItem('volver_a', location.pathname.split('/').pop() + location.search);
    window.location.replace('login.html?aviso=sesion');
    throw new Error('Sesión requerida');
  }
  if (rolesPermitidos && !rolesPermitidos.includes(u.rol)) {
    window.location.replace(rutaInicioSegunRol(u.rol));
    throw new Error('Rol no permitido en esta página');
  }
  return u;
}

export const exigirRol = (...roles) => exigirSesion(roles);