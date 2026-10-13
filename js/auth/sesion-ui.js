import { obtenerSesion, cerrarSesion } from './auth.js';
import { totalUnidades } from '../registro/carrito.js';

const usuario = obtenerSesion();
const cuenta = document.getElementById('enlaceCuenta');
const salir = document.getElementById('botonSalir');

if (usuario && cuenta) {
  cuenta.href = usuario.rol === 'cliente' ? 'consulta.html' : 'panel.html';
  cuenta.querySelector('.cuenta__saludo').textContent = 'Hola, ' + usuario.nombre.split(' ')[0];
  cuenta.querySelector('.cuenta__accion').textContent = usuario.rol === 'cliente' ? 'Mis pedidos' : 'Ir al panel';
  if (salir) {
    salir.hidden = false;
    salir.addEventListener('click', () => {
      cerrarSesion();
      window.location.href = 'index.html';
    });
  }
}

const contador = document.getElementById('contadorCarrito');
function pintarContador() { if (contador) contador.textContent = totalUnidades(); }
pintarContador();
window.addEventListener('carrito:cambio', pintarContador);
