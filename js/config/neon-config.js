import { neon } from 'https://esm.sh/@neondatabase/serverless@0.10.4';

const CADENA = 'postgresql://neondb_owner:npg_o21mRqwczTBC@ep-fancy-sun-b40bpqy2-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

let conexion;
function obtenerConexion() {
  if (!CADENA.startsWith('postgres')) {
    throw new Error('Falta la cadena de conexión de Neon en js/config/neon-config.js');
  }
  conexion ??= neon(CADENA);
  return conexion;
}

export const sql = (...args) => obtenerConexion()(...args);

sql.transaction = (...args) => obtenerConexion().transaction(...args);