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
}

export function obtenerSesion() {
  try { return JSON.parse(sessionStorage.getItem('usuario')); } catch { return null; }
}


export function exigirSesion(rolesPermitidos = null) {
  const u = obtenerSesion();
  if (!u) {
    window.location.replace('login.html');
    throw new Error('Sesión requerida');
  }
  if (rolesPermitidos && !rolesPermitidos.includes(u.rol)) {
    window.location.replace(u.rol === 'cliente' ? 'registro.html' : 'panel.html');
    throw new Error('Rol no permitido en esta página');
  }
  return u;
}
