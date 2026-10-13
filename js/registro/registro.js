import { sql } from '../config/neon-config.js';
import { exigirRol } from '../auth/auth.js';
import { calcularMontoServicio, formatearSoles, marcado } from './tarifario.js';

const usuario = exigirRol('cliente');

const form = document.querySelector('#form-registro');
const salidaMonto = document.querySelector('#monto-estimado');

document.querySelector('#fecha_entrega').min =
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

const leerFormulario = () => Object.fromEntries(new FormData(form));

function actualizarCotizacion() {
  salidaMonto.textContent = formatearSoles(calcularMontoServicio(leerFormulario()));
}
form.addEventListener('input', actualizarCotizacion);
form.addEventListener('change', actualizarCotizacion);
actualizarCotizacion();

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!form.checkValidity()) { form.reportValidity(); return; }

  const datos = leerFormulario();
  const monto = calcularMontoServicio(datos);
  const estadoPago = monto === 0 ? 'exonerado' : 'pendiente';
  const codigo = 'SOL-' + Date.now().toString().slice(-8);
  const boton = form.querySelector('button[type="submit"]');
  boton.disabled = true;

  try {
    const filas = await sql`
      INSERT INTO pedidos_delivery_megamercado
        (codigo_seguimiento, nombre_contacto, telefono, direccion, distrito, referencia,
         sede_atencion, fecha_entrega, franja_horaria, metodo_pago, detalle_pedido,
         peso_kg, incluye_congelados, total, monto_calculado, estado_pago,
         estado, id_usuario)
      VALUES
        (${codigo}, ${datos.nombre_contacto}, ${datos.telefono}, ${datos.direccion},
         ${datos.distrito}, ${datos.referencia || null}, ${datos.sede_atencion},
         ${datos.fecha_entrega}, ${datos.franja_horaria}, 'pendiente', ${datos.detalle_pedido},
         ${Number(datos.peso_kg)}, ${marcado(datos.incluye_congelados)}, ${monto}, ${monto},
         ${estadoPago}, 'registrado', ${usuario.id})
      RETURNING id;
    `;
    if (estadoPago === 'pendiente') {
      window.location.href = `pago.html?id=${filas[0].id}`;
    } else {
      alert(`Pedido ${codigo} registrado. Tu delivery está exonerado de pago.`);
      window.location.href = 'consulta.html';
    }
  } catch (error) {
    console.error(error);
    alert('No se pudo registrar el pedido. Revisa los datos e intenta nuevamente.');
    boton.disabled = false;
  }
});