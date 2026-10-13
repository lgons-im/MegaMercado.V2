import { buscarProducto } from '../config/productos.js';
import { leerCarrito, cambiarCantidad } from './carrito.js';
import { escapar, formatearMoneda } from '../config/utils.js';

export const descuento = (p) => (p.antes ? Math.round((1 - p.precio / p.antes) * 100) : 0);

export function fotoHTML(p, clase = '') {
  return `<img class="${clase}" src="${escapar(p.img)}" alt="${escapar(p.nombre)}" loading="lazy">`;
}

function accionHTML(p) {
  const cant = leerCarrito()[p.id] || 0;
  if (!cant) return `<button type="button" class="btn btn--bloque" data-accion="agregar" data-id="${p.id}">Agregar</button>`;
  return `<div class="cantidad" role="group" aria-label="Cantidad de ${escapar(p.nombre)}">
    <button type="button" data-accion="restar" data-id="${p.id}" aria-label="Quitar una unidad de ${escapar(p.nombre)}">−</button>
    <span aria-live="polite">${cant}</span>
    <button type="button" data-accion="sumar" data-id="${p.id}" aria-label="Agregar una unidad de ${escapar(p.nombre)}">+</button>
  </div>`;
}

export function tarjetaHTML(p) {
  const d = descuento(p);
  return `<article class="tarjeta${d ? ' tarjeta--oferta' : ''}">
    ${d ? `<span class="tarjeta__descuento">-${d}%</span>` : ''}
    <div class="tarjeta__foto">${fotoHTML(p)}</div>
    <p class="tarjeta__cat">${escapar(p.categoria === 'frutas' ? 'Frutas y verduras' : p.categoria.charAt(0).toUpperCase() + p.categoria.slice(1))}</p>
    <h3 class="tarjeta__nombre">${escapar(p.nombre)}</h3>
    <p class="tarjeta__pres">${escapar(p.presentacion)}</p>
    <div class="tarjeta__precios">
      <span class="precio${d ? ' precio--oferta' : ''}">${formatearMoneda(p.precio)}</span>
      ${d ? `<span class="precio-antes"><span class="sr-only">Antes </span>${formatearMoneda(p.antes)}</span>` : ''}
    </div>
    <div class="tarjeta__accion">${accionHTML(p)}</div>
  </article>`;
}

export function pintarTarjetas(contenedor, lista) {
  contenedor.innerHTML = lista.map(tarjetaHTML).join('');
  const vigia = new IntersectionObserver((entradas, obs) => entradas.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
  }), { threshold: 0.15 });
  contenedor.querySelectorAll('.tarjeta').forEach((tarjeta) => { tarjeta.classList.add('oculta'); vigia.observe(tarjeta); });
}

export function activarRespaldoImagenes(contenedor) {
  contenedor.addEventListener('error', (e) => {
    if (e.target.tagName !== 'IMG' || e.target.dataset.respaldo) return;
    e.target.dataset.respaldo = '1';
    e.target.src = 'img/placeholder.svg';
  }, true);
}

export function enlazarTarjetas(contenedor) {
  activarRespaldoImagenes(contenedor);
  contenedor.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-accion]');
    if (!b) return;
    const id = Number(b.dataset.id);
    cambiarCantidad(id, b.dataset.accion === 'restar' ? -1 : 1);
    const zona = b.closest('.tarjeta__accion');
    zona.innerHTML = accionHTML(buscarProducto(id));
    zona.querySelector('button')?.focus();
  });
}
