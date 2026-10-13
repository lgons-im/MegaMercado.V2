import { PRODUCTOS, CATEGORIAS } from '../config/productos.js';
import { pintarTarjetas, enlazarTarjetas } from './tarjetas.js';
import { normalizar, escapar } from '../config/utils.js';

const params = new URLSearchParams(location.search);
const grid = document.getElementById('gridCatalogo');
const contador = document.getElementById('contadorResultados');
const listaCats = document.getElementById('listaCategorias');
const orden = document.getElementById('orden');
const busqueda = params.get('q') || '';

let categoria = CATEGORIAS.some((c) => c.id === params.get('cat')) ? params.get('cat') : 'todas';

listaCats.innerHTML = CATEGORIAS.map((c) => `
  <label><input type="radio" name="categoria" value="${c.id}" ${c.id === categoria ? 'checked' : ''}> ${escapar(c.nombre)}</label>`).join('');

function ordenar(lista) {
  const l = [...lista];
  switch (orden.value) {
    case 'precio-asc': return l.sort((a, b) => a.precio - b.precio);
    case 'precio-desc': return l.sort((a, b) => b.precio - a.precio);
    case 'nombre': return l.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    default: return l;
  }
}

function pintar() {
  let lista = PRODUCTOS;
  if (categoria === 'ofertas') lista = lista.filter((p) => p.antes);
  else if (categoria !== 'todas') lista = lista.filter((p) => p.categoria === categoria);
  if (busqueda) lista = lista.filter((p) => normalizar(p.nombre + ' ' + p.presentacion).includes(normalizar(busqueda)));
  lista = ordenar(lista);

  const nombreCat = CATEGORIAS.find((c) => c.id === categoria).nombre;
  contador.textContent = `${lista.length} ${lista.length === 1 ? 'producto' : 'productos'} · ${nombreCat}${busqueda ? ` · «${busqueda}»` : ''}`;
  if (!lista.length) {
    grid.innerHTML = `<div class="vacio"><p>No encontramos productos con esos filtros.</p><a class="btn" href="catalogo.html">Ver todo el catálogo</a></div>`;
    return;
  }
  pintarTarjetas(grid, lista);
}

listaCats.addEventListener('change', (e) => { categoria = e.target.value; pintar(); });
orden.addEventListener('change', pintar);
if (busqueda) document.getElementById('q').value = busqueda;
enlazarTarjetas(grid);
pintar();
