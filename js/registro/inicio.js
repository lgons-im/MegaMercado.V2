import { PRODUCTOS, buscarProducto } from '../config/productos.js';
import { pintarTarjetas, enlazarTarjetas, fotoHTML, activarRespaldoImagenes } from './tarjetas.js';

const SLIDES = [
  { clase: 'amarillo', titulo: 'Ofertas semanales', texto: 'Hasta 20 % de descuento en abarrotes y limpieza.', boton: 'Ver ofertas', enlace: 'catalogo.html?cat=ofertas', ids: [1, 2, 10] },
  { clase: 'rojo', titulo: 'Delivery en el día', texto: 'Haz tu pedido y sigue su estado con tu código de seguimiento.', boton: 'Solicitar delivery', enlace: 'registro.html', ids: [5, 13, 14] },
  { clase: 'verde', titulo: 'Frutas frescas', texto: 'Plátano, manzana y naranja para toda la semana.', boton: 'Ver frutas', enlace: 'catalogo.html?cat=frutas', ids: [7, 6, 8] },
];
const pista = document.getElementById('heroPista');
const puntos = document.getElementById('heroPuntos');
pista.innerHTML = SLIDES.map((s, i) => `
  <article class="slide slide--${s.clase}" role="group" aria-roledescription="diapositiva" aria-label="${i + 1} de ${SLIDES.length}">
    <div>
      <h2>${s.titulo}</h2>
      <p>${s.texto}</p>
      <a class="btn ${s.clase === 'amarillo' ? 'btn--primario' : ''}" href="${s.enlace}">${s.boton}</a>
    </div>
    <div class="slide__fotos">${s.ids.map((id) => fotoHTML(buscarProducto(id))).join('')}</div>
  </article>`).join('');
puntos.innerHTML = SLIDES.map((_, i) => `<button type="button" aria-label="Ir a la diapositiva ${i + 1}"></button>`).join('');
activarRespaldoImagenes(pista);

let actual = 0;
let temporizador = null;
function ir(i) {
  actual = (i + SLIDES.length) % SLIDES.length;
  pista.style.transform = `translateX(-${actual * 100}%)`;
  [...puntos.children].forEach((b, n) => b.setAttribute('aria-current', String(n === actual)));
  [...pista.children].forEach((s, n) => (s.inert = n !== actual));
}
function iniciar() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  detener();
  temporizador = setInterval(() => ir(actual + 1), 5500);
}
function detener() { clearInterval(temporizador); }
document.getElementById('heroPrev').addEventListener('click', () => { ir(actual - 1); detener(); });
document.getElementById('heroNext').addEventListener('click', () => { ir(actual + 1); detener(); });
[...puntos.children].forEach((b, n) => b.addEventListener('click', () => { ir(n); detener(); }));
const hero = document.querySelector('.hero');
hero.addEventListener('mouseenter', detener);
hero.addEventListener('mouseleave', iniciar);
hero.addEventListener('focusin', detener);
ir(0);
iniciar();

const ofertas = document.getElementById('gridOfertas');
const frutas = document.getElementById('gridFrutas');
pintarTarjetas(ofertas, PRODUCTOS.filter((p) => p.antes).slice(0, 5));
pintarTarjetas(frutas, PRODUCTOS.filter((p) => p.categoria === 'frutas'));
enlazarTarjetas(ofertas);
enlazarTarjetas(frutas);
