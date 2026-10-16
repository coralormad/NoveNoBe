// Mi lista · una sola fuente de verdad para guardar películas desde cualquier parte de la SPA.
// Funciones puras para decidir; unas pocas funciones con efectos para leer, guardar y avisar.
// Cada cambio lanza un evento: todos los botones de esa película (carrusel, ficha, «Para ti»…) se sincronizan.
import { peliculas } from '../data/movies.js';
import {
  LISTA_KEY, loadLista, saveLista, loadListaObservadas, saveListaObservadas, loadFavorites, loadObserved, toggleId,
} from './storage.js';

/** Nombre del evento que avisa de cualquier cambio en Mi lista (lo escuchan los botones y «Para ti»). */
export const EVENTO_LISTA = 'novenobe:mi-lista';

// ---------- Puras ----------

/** Pura: clave de una película de TMDB. */
export const claveTmdb = (id) => `t${id}`;

/** Pura: instantánea de una Movie (lo justo para pintarla en Mi lista sin volver a pedirla). */
export const entradaDesdeMovie = (movie) => ({
  clave: claveTmdb(movie.id),
  tmdbId: movie.id,
  titulo: movie.title,
  anio: movie.releaseDate ? movie.year : '',
  poster: movie.posterPath,
  generos: movie.genreIds,
});

/** Pura: instantánea de una película del catálogo local de «Qué ver». Si tiene ficha en TMDB,
 *  comparte clave con ella: guardarla aquí o en su ficha es guardar la misma película. */
export const entradaDesdeLocal = (pelicula) => ({
  clave: pelicula.tmdbId ? claveTmdb(pelicula.tmdbId) : `l${pelicula.id}`,
  tmdbId: pelicula.tmdbId ?? null,
  titulo: pelicula.titulo,
  anio: String(pelicula.anio ?? ''),
  poster: null, // el catálogo local no trae póster: Mi lista lo pide a TMDB si hay tmdbId
  generos: [],
});

/** Pura: ¿está esta clave en la lista? */
export const tieneClave = (lista, clave) => lista.some((entrada) => entrada.clave === clave);

/** Pura: guarda la película si no está y la quita si está. Array nuevo (no muta). */
export const alternarEntrada = (lista, entrada) =>
  tieneClave(lista, entrada.clave)
    ? lista.filter(({ clave }) => clave !== entrada.clave)
    : [...lista, entrada];

/** Pura: devuelve una entrada a su posición (para «Deshacer»). Si ya está, copia sin cambios. */
export function insertarEntrada(lista, entrada, indice) {
  if (tieneClave(lista, entrada.clave)) return [...lista];
  const posicion = Number.isInteger(indice) && indice >= 0 ? Math.min(indice, lista.length) : lista.length;
  return [...lista.slice(0, posicion), entrada, ...lista.slice(posicion)];
}

/** Pura: la película del catálogo local que corresponde a una entrada (para su sinopsis y su pista), o null. */
export const localDe = (entrada, catalogo = peliculas) =>
  catalogo.find((pelicula) => entradaDesdeLocal(pelicula).clave === entrada.clave) ?? null;

/** Pura: ids locales guardados (el recomendador de «Qué ver» trabaja con su catálogo). */
export const favoritasLocales = (lista, catalogo = peliculas) =>
  catalogo.filter((pelicula) => tieneClave(lista, entradaDesdeLocal(pelicula).clave)).map(({ id }) => id);

/** Pura: convierte el formato antiguo (ids locales) al nuevo (claves), sin perder el orden ni lo visto. */
export function migrar(favoritas, observadas, catalogo = peliculas) {
  const deLocal = (id) => catalogo.find((pelicula) => pelicula.id === id);
  const lista = favoritas.map(deLocal).filter(Boolean).map(entradaDesdeLocal);
  const vistas = observadas.map(deLocal).filter(Boolean).map((pelicula) => entradaDesdeLocal(pelicula).clave);
  return { lista, observadas: vistas };
}

// ---------- Lectura y escritura (localStorage) ----------

/** Lee Mi lista. La primera vez migra lo guardado con el formato antiguo. */
export function cargarLista() {
  const guardada = loadLista();
  if (guardada !== null) return guardada;
  const { lista, observadas } = migrar(loadFavorites(), loadObserved());
  saveLista(lista);
  saveListaObservadas(observadas);
  return lista;
}

export const estaEnLista = (clave) => tieneClave(cargarLista(), clave);

/** Avisa a toda la página de que Mi lista ha cambiado. */
function avisar(clave = null) {
  document.dispatchEvent(new CustomEvent(EVENTO_LISTA, { detail: { clave } }));
}

/** Guarda o quita una película. @returns {boolean} true si se pudo guardar. */
export function alternar(entrada) {
  const ok = saveLista(alternarEntrada(cargarLista(), entrada));
  avisar(entrada.clave);
  return ok;
}

/** Quita una película. @returns {{ entrada: object, indice: number } | null} lo necesario para deshacer. */
export function quitar(clave) {
  const lista = cargarLista();
  const indice = lista.findIndex((entrada) => entrada.clave === clave);
  if (indice === -1) return null;
  const entrada = lista[indice];
  const ok = saveLista(lista.filter((item) => item.clave !== clave));
  avisar(clave);
  return ok ? { entrada, indice } : null;
}

/** Deshace un «Quitar»: la película vuelve a su sitio. */
export function reinsertar(entrada, indice) {
  const ok = saveLista(insertarEntrada(cargarLista(), entrada, indice));
  avisar(entrada.clave);
  return ok;
}

export const cargarObservadas = () => loadListaObservadas();

/** Marca una película como vista o por descubrir. @returns {string[]} las observadas tras el cambio */
export function alternarObservada(clave) {
  const observadas = toggleId(loadListaObservadas(), clave);
  saveListaObservadas(observadas);
  return observadas;
}

// ---------- El botón: una cápsula reutilizable ----------

// botón → instantánea de su película. WeakMap: si el botón desaparece, su entrada también (sin fugas)
const ENTRADAS = new WeakMap();

const TEXTOS = Object.freeze({
  compacto: { guardar: 'Mi lista', guardada: 'En tu lista' },
  texto: { guardar: 'Guardar en mi lista', guardada: 'En tu lista' },
  ficha: { guardar: 'Guardar en Mi lista', guardada: 'En Mi lista' },
});

const SVG_NS = 'http://www.w3.org/2000/svg';

/** El icono: un «+» que, al guardar, se convierte en un visto (el CSS hace la transición). */
function crearIcono() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add('lista-icono');
  const trazos = [['lista-mas', 'M12 6v12M6 12h12'], ['lista-visto', 'M6 12.5l4 4 8-9']];
  svg.append(...trazos.map(([clase, d]) => {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('class', clase);
    path.setAttribute('d', d);
    return path;
  }));
  return svg;
}

/** Pinta el estado de un botón: texto, aria-pressed (interruptor) y una etiqueta con el título. */
function pintarBoton(boton, guardada) {
  const entrada = ENTRADAS.get(boton);
  const textos = TEXTOS[boton.dataset.variante] ?? TEXTOS.compacto;
  boton.setAttribute('aria-pressed', String(guardada));
  boton.querySelector('.lista-texto').textContent = guardada ? textos.guardada : textos.guardar;
  const etiqueta = guardada ? `Quitar «${entrada.titulo}» de Mi lista` : `Guardar «${entrada.titulo}» en Mi lista`;
  boton.setAttribute('aria-label', etiqueta);
  if (boton.dataset.variante === 'compacto') boton.title = etiqueta; // solo icono: el título sirve de pista al ratón
}

/**
 * Crea la cápsula de Mi lista para una película.
 * @param {object} entrada - instantánea (entradaDesdeMovie / entradaDesdeLocal)
 * @param {'compacto'|'texto'|'ficha'} variante - compacto (tarjetas), texto («Qué ver») o ficha
 */
export function crearBotonLista(entrada, variante = 'compacto') {
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = `lista-capsula lista-capsula--${variante}`;
  boton.dataset.listaClave = entrada.clave;
  boton.dataset.variante = variante;
  const texto = document.createElement('span');
  texto.className = 'lista-texto';
  boton.append(crearIcono(), texto);
  ENTRADAS.set(boton, entrada);
  pintarBoton(boton, estaEnLista(entrada.clave));
  return boton;
}

/** Cambia la película de un botón ya creado (la ficha reutiliza el suyo al cambiar de película). */
export function asignarBotonLista(boton, entrada) {
  ENTRADAS.set(boton, entrada);
  boton.dataset.listaClave = entrada.clave;
  pintarBoton(boton, estaEnLista(entrada.clave));
}

/** Repinta todos los botones de la página con lo guardado (una lectura para todos). */
function sincronizarBotones() {
  const lista = cargarLista();
  document.querySelectorAll('.lista-capsula[data-lista-clave]').forEach((boton) => {
    if (ENTRADAS.has(boton)) pintarBoton(boton, tieneClave(lista, boton.dataset.listaClave));
  });
}

/** Un solo listener para todos los botones de la página (delegación). Se llama una vez, al arrancar. */
export function activarMiLista() {
  document.addEventListener('click', (event) => {
    const boton = event.target.closest('.lista-capsula');
    const entrada = boton && ENTRADAS.get(boton);
    if (!entrada) return;
    if (!alternar(entrada)) return; // el navegador bloquea el almacenamiento: el botón no miente
    boton.classList.remove('lista-pulso');
    void boton.offsetWidth; // reinicia la animación aunque se pulse dos veces seguidas
    boton.classList.add('lista-pulso');
  });
  document.addEventListener(EVENTO_LISTA, sincronizarBotones);
  // Otra pestaña cambió Mi lista: esta se entera y avisa a sus botones y a «Para ti»
  window.addEventListener('storage', (event) => {
    if (event.key === LISTA_KEY) avisar();
  });
}
