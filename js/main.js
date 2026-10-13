import { MovieCatalog } from './catalog.js';
import { searchMovies, getTrending, getGenres, discoverMovies, getMovieList, getMovieDetails, fetchCountryCoords } from './api.js';
import { Movie } from './Movie.js';
import { debounce, ratingToArc, bechdelText, BECHDEL_PREGUNTAS, avanzarBechdel, toUserMessage, filterActive, pickCast, pickCrew, pickCertification, countByGenre, groupTail, headline, sharesGenre, filterByGenre, sizeBucket, sliceIndexOf, genreHeadline, topOfGenre, genreNames, toGenreIds } from './utils.js';
import { addQuery, clearHistory, loadHistory, saveHistory, loadTheme, saveTheme, MIRADAS_KEY, loadMiradas, saveMiradas, setMirada, removeMirada } from './storage.js';
import { HeroCarousel, pickHeroMovies, buildSlides, createSlide, fillEmblem, setAmbient } from './hero.js';
import { CountryMap, toMarkers, countryName, mapLabel, mapaDisponible } from './map.js';
import { COORDENADAS_PAISES } from '../data/paises.js';
import { startRouter, movieHref } from './router.js';
import { enableCardTilt, tiltFromPointer } from './tilt.js';
import { AVISOS } from '../data/avisos.js';
import { CatalogCharts } from './charts.js';
import { GenreStage, MAX_ESCAPARATE } from './stage.js';
import { QueVer } from './que-ver.js';


const MIN_QUERY = 2;
const DEBOUNCE_MS = 400;
const MIN_VISIBLES = 12; // con un género elegido, cargar hasta tener al menos estas
const MAX_PAGINAS = 5;   // tope de páginas por clic: no saturar la API

const els = {
  btnBuscar: document.querySelector('#btn-buscar'),
  panel: document.querySelector('#panel-buscar'),
  input: document.querySelector('#buscador'),
  results: document.querySelector('#resultados-busqueda'),
  trending: document.querySelector('#fila-tendencias'),
  btnTema: document.querySelector('#btn-tema'), // NUEVO 5d
  genres: document.querySelector('#generos'),
  genreRow: document.querySelector('#fila-genero'),
};

// Ficha: referencias y estado propio de la ficha (ámbito de módulo, no globales)
const ficha = {
  vista: document.querySelector('#vista-ficha'),
  estado: document.querySelector('#ficha-estado'),
  contenido: document.querySelector('#ficha-contenido'),
  fondo: document.querySelector('#ficha-fondo'),
  poster: document.querySelector('#ficha-poster'),
  titulo: document.querySelector('#ficha-titulo'),
  original: document.querySelector('#ficha-original'),
  meta: document.querySelector('#ficha-meta'),
  nota: document.querySelector('#ficha-nota'),
  notaCifra: document.querySelector('#ficha-nota-cifra'),
  votos: document.querySelector('#ficha-votos'),
  notaPropia: document.querySelector('#ficha-nota-propia'),
  leyendaPropia: document.querySelector('#ficha-leyenda-propia'),
  generos: document.querySelector('#ficha-generos'),
  eslogan: document.querySelector('#ficha-eslogan'),
  sinopsis: document.querySelector('#ficha-sinopsis'),
  equipo: document.querySelector('#ficha-equipo'),
  nav: document.querySelector('#ficha-nav'),
  mapa: document.querySelector('#ficha-mapa'),
  ventana: document.querySelector('#ficha-ventana'),
  reparto: document.querySelector('#ficha-reparto'),
  repartoVacio: document.querySelector('#ficha-reparto-vacio'),
};

// Tu mirada: formulario de la nota propia y el cuaderno (solo visible de noche)
const mirada = {
  form: document.querySelector('#mirada'),
  rango: document.querySelector('#mirada-nota'),
  cifra: document.querySelector('#mirada-cifra'),
  texto: document.querySelector('#mirada-texto'),
  borrar: document.querySelector('#mirada-borrar'),
  estado: document.querySelector('#mirada-estado'),
  entrada: document.querySelector('#mirada-entrada'),
  fecha: document.querySelector('#mirada-fecha'),
  cita: document.querySelector('#mirada-cita'),
  piloto: document.querySelector('#mirada-piloto'),
  reescribir: document.querySelector('#mirada-reescribir'),
  enfoque: document.querySelector('#mirada-enfoque'),
  bechdel: document.querySelector('#mirada-bechdel'),
  examen: document.querySelector('#bechdel'),
  pregunta: document.querySelector('#bechdel-pregunta'),
  resultado: document.querySelector('#bechdel-resultado'),
  repetir: document.querySelector('#bechdel-repetir'),
};
const PILOTO = Object.freeze({ vacia: 'Sin calibrar', calibrando: 'Calibrando', revelada: 'Lectura revelada' });
let miradaId = null;      // id de TMDB de la película abierta
let miradaTocada = false; // ¿ha movido el enfoque? Sin moverlo, no hay nota propia
let bechdelEtapa = 0;     // pregunta del examen en pantalla (0-2)
let bechdelNivel = null;  // resultado del examen (0-3); null mientras no termina
const FECHA_MIRADA = new Intl.DateTimeFormat('es-ES', { dateStyle: 'long' });

let etiquetaTmdb = ''; // lo que la mirilla dice de día (nota pública de TMDB)

let fichaActual = null; // id de la película pintada: si solo cambia la sección, no se vuelve a pedir
let fichaController = null;
let countryMap = null; // se crea la primera vez que se abre la ventana del mapa
let fichaMarcadores = []; // países de la película abierta, listos para el mapa
let scrollInicio = 0; // para volver al mismo punto del inicio

let controller = null; // petición en curso (variable de módulo, no global)
let genreController = null; // petición de género en curso

// ---------- Tema (NUEVO 5d) ----------
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  els.btnTema.setAttribute('aria-checked', String(theme === 'oscuro'));
  etiquetarVisor(); // la mirilla cambia de función: de día enfoca la nota pública, de noche lleva a la tuya
}

const esNoche = () => document.documentElement.dataset.theme === 'oscuro';

function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'oscuro' ? 'claro' : 'oscuro';
  applyTheme(next);
  saveTheme(next);
  if (!ficha.vista.hidden && ficha.ventana.open) countryMap?.refresh();
}

// ---------- Pintado (sin innerHTML) ----------
function renderMessage(text) {
  const li = document.createElement('li');
  li.textContent = text;
  els.results.replaceChildren(li);
}

function renderResults(movies) {
  if (movies.length === 0) return renderMessage('Sin resultados.');

  const items = movies.map((movie) => {
    const li = document.createElement('li');
    li.textContent = `${movie.title} (${movie.year}) · ★ ${movie.ratingText}`;
    li.dataset.id = movie.id;
    return li;
  });
  els.results.replaceChildren(...items);
}

function createButtonItem(text, className, data) {
  const li = document.createElement('li');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = text;
  Object.assign(button.dataset, data);
  li.append(button);
  return li;
}

function renderHistory() {
  const history = loadHistory();
  if (history.length === 0) {
    els.results.replaceChildren();
    return;
  }

  const items = history.map((query) => createButtonItem(query, 'historial-item', { query }));
  const clearItem = createButtonItem('Borrar historial', 'historial-borrar', { action: 'clear-history' });
  els.results.replaceChildren(...items, clearItem);
}

// ---------- Tarjetas y filas ----------
const cardTemplate = document.querySelector('#plantilla-tarjeta');

function createCard(movie) {
  const card = cardTemplate.content.firstElementChild.cloneNode(true);
  card.dataset.id = movie.id;
  card.dataset.generos = movie.genreIds.join(' ');

  const link = card.querySelector('.tarjeta-enlace');
  link.href = movieHref(movie.id);
  link.setAttribute('aria-label', `${movie.title}, ${movie.year}. Nota ${movie.ratingText}`);

  card.querySelector('.tarjeta-img').src = movie.posterUrl;
  card.querySelector('.capsula-anio').textContent = movie.year;
  card.querySelector('.capsula-nota').textContent = `★ ${movie.ratingText}`;
  card.querySelector('.tarjeta-titulo').textContent = movie.title;

  return card;
}

function renderRowMessage(container, text) {
  const p = document.createElement('p');
  p.className = 'fila-mensaje';
  p.textContent = text;
  container.replaceChildren(p);
}

function renderRow(container, movies) {
  if (movies.length === 0) return renderRowMessage(container, 'No hay películas que mostrar.');
  container.replaceChildren(...movies.map(createCard));
}

// Carga cualquier fila: recibe dónde pintar y una función que pide los datos
async function loadRow(container, fetcher) {
  renderRowMessage(container, 'Cargando…');
  try {
    const data = await fetcher();
    const movies = Movie.fromList(data.results);
    renderRow(container, movies);
    return movies;
  } catch (error) {
    if (error.name === 'AbortError') return [];
    renderRowMessage(container, toUserMessage(error));
    return [];
  }
}

// ---------- Géneros ----------
function renderGenreChips(genres, activeId) {
  const buttons = genres.map(({ id, name }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'capsula'; // la misma cápsula que en Películas: mismo lenguaje de luz y respuesta
    button.textContent = name;
    button.dataset.genreId = id;
    button.setAttribute('aria-pressed', String(id === activeId));
    return button;
  });
  els.genres.replaceChildren(...buttons);
}

function loadGenreRow(genreId) {
  genreController?.abort();
  genreController = new AbortController();
  const { signal } = genreController;
  return loadRow(els.genreRow, () => discoverMovies({ genreId, signal }));
}

function handleGenreClick(event) {
  const button = event.target.closest('[data-genre-id]');
  if (!button || button.getAttribute('aria-pressed') === 'true') return;
  els.genres.querySelector('[aria-pressed="true"]')?.setAttribute('aria-pressed', 'false');
  button.setAttribute('aria-pressed', 'true');
  loadGenreRow(Number(button.dataset.genreId));
}

async function initGenres() {
  try {
    const genres = await getGenres();
    const firstId = genres[0]?.id;
    renderGenreChips(genres, firstId);
    return firstId ? loadGenreRow(firstId) : [];
  } catch (error) {
    if (error.name === 'AbortError') return [];
    renderRowMessage(els.genreRow, toUserMessage(error));
    return [];
  }
}

// ---------- Hero ----------
async function loadHero(hero) {
  const today = new Date();
  let picks = {};
  try {
    const [nowPlaying, upcoming] = await Promise.all([
      getMovieList('now_playing'),
      getMovieList('upcoming'),
    ]);
    const enCines = Movie.fromList(nowPlaying.results);
    setAmbient(enCines);
    picks = pickHeroMovies({
      nowPlaying: enCines,
      upcoming: Movie.fromList(upcoming.results),
      today,
    });
  } catch (error) {
    console.warn('Hero sin novedades; se muestran presentación y avisos.', error);
  }
  const slides = buildSlides({ ...picks, avisos: filterActive(AVISOS, today) });
  hero.addSlides(slides.map(createSlide));
}

function handleHeroAction(button) {
  if (button.dataset.accion === 'tema') toggleTheme();
  if (button.dataset.accion === 'buscar' && els.panel.hidden) togglePanel();
  if (button.dataset.accion === 'ficha') openFicha(button.dataset.id);
}

// ---------- Búsqueda ----------
async function handleSearch(rawQuery, { save = false } = {}) {
  const query = rawQuery.trim();
  controller?.abort();

  if (query.length < MIN_QUERY) {
    renderHistory();
    return;
  }
  
  controller = new AbortController();
  renderMessage('Buscando…');

  try {
    const data = await searchMovies(query, { signal: controller.signal });
    const movies = data.results.map((item) => new Movie(item));
    renderResults(movies);
    if (save && movies.length > 0) saveHistory(addQuery(loadHistory(), query));
  } catch (error) {
    if (error.name === 'AbortError') return;
    renderMessage(toUserMessage(error));
  }
}

const debouncedSearch = debounce((event) => handleSearch(event.target.value), DEBOUNCE_MS);

// ---------- Manejadores ----------
function togglePanel() {
  const isOpen = els.btnBuscar.getAttribute('aria-expanded') === 'true';
  els.btnBuscar.setAttribute('aria-expanded', String(!isOpen));
  els.panel.hidden = isOpen;
  if (!isOpen) els.input.focus();
}

function handleFocus() {
  if (els.input.value.trim().length < MIN_QUERY) renderHistory();
}

function handleKeydown(event) {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  debouncedSearch.cancel();
  handleSearch(els.input.value, { save: true });
}

function handleResultsClick(event) {
  const button = event.target.closest('button');
  if (!button) return;

  if (button.dataset.action === 'clear-history') {
    clearHistory();
    renderHistory();
    els.input.focus();
    return;
  }

  if (button.dataset.query) {
    els.input.value = button.dataset.query;
    handleSearch(button.dataset.query, { save: true });
  }
}

// ---------- Carrusel: selección y flechas ----------
const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;


// ---------- Navegación ----------
/** Abrir una ficha = cambiar la URL; el router hace el resto. */
function openFicha(id) {
  window.location.hash = movieHref(id);
}

function showView(nombre) {
  document.querySelectorAll('.vista').forEach((vista) => {
    vista.hidden = vista.id !== `vista-${nombre}`;
  });
}

// Mi lista usa la vista genérica de catálogo (#vista-catalogo)
const VISTA_HTML = Object.freeze({ 'mi-lista': 'catalogo' });
const TITULO_CATALOGO = Object.freeze({ 'mi-lista': 'Mi lista' });
const catalogoTitulo = document.querySelector('#catalogo-titulo');
let vistaActual = 'inicio';

/** Marca en el menú la vista actual (la ficha no tiene entrada: no marca ninguna). */
function markMenu(vista) {
  document.querySelectorAll('.menu-enlace').forEach((link) => {
    if (link.dataset.vista === vista) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

async function handleRoute(route) {
  if (route.vista === 'peliculas' && catalog.movies.length === 0) loadPeliculas(() => catalog.load('popular'));
  vistaActual = route.vista;
  markMenu(route.vista);

  if (route.vista === 'ficha') {
    showView('ficha');
    if (route.id !== fichaActual) {   // otra película → pedirla
      fichaActual = route.id;
      window.scrollTo(0, 0);
      const ok = await loadFicha(route.id);
      if (!ok) return;                // error o cancelada: no hay sección a la que ir
    }
    goToSection(route.seccion);       // misma película → solo desplazarse
    return;
  }

  fichaController?.abort();
  fichaActual = null;
  showView(VISTA_HTML[route.vista] ?? route.vista);
  if (TITULO_CATALOGO[route.vista]) catalogoTitulo.textContent = TITULO_CATALOGO[route.vista];
  if (route.vista === 'mi-lista') queVer.pintarMiLista();  // siempre con lo último guardado
  if (route.vista === 'que-ver') queVer.refrescarFavoritas(); // por si se quitó alguna desde Mi lista
  window.scrollTo(0, route.vista === 'inicio' ? scrollInicio : 0);
}

// ---------- Películas ----------
const catalog = new MovieCatalog();
const pelis = {
  pestanas: document.querySelector('#peliculas-pestanas'),
  estado: document.querySelector('#peliculas-estado'),
  rejilla: document.querySelector('#peliculas-rejilla'),
  mas: document.querySelector('#peliculas-mas'),
};

const radiografia = {
  titular: document.querySelector('#radiografia-titular'),
  escena: document.querySelector('#radiografia-escena'),
  capsulas: document.querySelector('#radiografia-capsulas'),
  genero: '', // clave del filtro: «18», o «80,53» para «Otros» ('' = todos)
  generos: [], // lista de géneros de TMDB (id → nombre), para el pie del escaparate
  filas: [],  // filas del doughnut (top 5 + Otros)
  etiqueta: '', // nombre del género elegido (para el titular)
  general: '',  // titular sin filtro, para recuperarlo al quitarlo
};
const catalogCharts = new CatalogCharts(
  document.querySelector('#grafica-generos'),
  {
    onGenreFocus: setGenreFocus,
    onGenreSelect: (fila) => elegirGenero(fila.ids.join(','), fila.label), // el anillo filtra igual que las cápsulas
  },
);

const escaparate = new GenreStage({
  marco: document.querySelector('#escaparate-marco'),
  lista: document.querySelector('#escaparate'),
  titulo: document.querySelector('#escaparate-titulo'),
  generos: document.querySelector('#escaparate-generos'),
  anterior: document.querySelector('#escaparate-anterior'),
  siguiente: document.querySelector('#escaparate-siguiente'),
});

/** El escaparate sigue al mismo filtro que la rejilla: una sola fuente de verdad. */
function renderEscaparate() {
  escaparate.render(
    topOfGenre(catalog.movies, toGenreIds(radiografia.genero), MAX_ESCAPARATE),
    (ids) => genreNames(ids, radiografia.generos),
  );
}

/** Recalcula titular, doughnut y cápsulas con TODAS las películas cargadas. */
async function updateRadiografia(movies) {
  try {
    const genreStats = countByGenre(movies, await getGenres());
    radiografia.filas = groupTail(genreStats, 5);
    radiografia.general = headline(genreStats, catalog.list);
    pintarTitular();
    catalogCharts.update({ genres: radiografia.filas });
    renderCapsulas(genreStats);
  } catch (error) {
    radiografia.titular.textContent = toUserMessage(error);
  }
}

/** Con un género elegido, titular de ese género; si no, el general. */
function pintarTitular() {
  radiografia.titular.textContent = radiografia.genero
    ? genreHeadline(radiografia.etiqueta)
    : radiografia.general;
}

/** Con un género elegido, pide páginas hasta reunir `target` películas suyas (o agotar el tope). */
async function fillGenre(target) {
  const ids = toGenreIds(radiografia.genero);
  for (let i = 0; i < MAX_PAGINAS && catalog.hasMore && filterByGenre(catalog.movies, ids).length < target; i++) {
    await catalog.loadMore();
  }
  return catalog.movies;
}

function createCapsula({ id, label, tam, value }) {
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'capsula';
  boton.dataset.genero = id;
  boton.dataset.tam = tam;
  boton.textContent = label;
  boton.setAttribute('aria-pressed', String(id === radiografia.genero));
  if (value) boton.setAttribute('aria-label', `${label}, ${value} películas`);
  return boton;
}

function renderCapsulas(stats) {
  const enfocada = document.activeElement?.closest?.('.capsula')?.dataset.genero;
  const max = stats[0]?.value ?? 0; // countByGenre ya ordena de mayor a menor
  const todos = createCapsula({ id: '', label: 'Todos', tam: 'm' });
  const generos = stats.map(({ ids: [id], label, value }) =>
    createCapsula({ id: String(id), label, tam: sizeBucket(value, max), value }));
  radiografia.capsulas.replaceChildren(todos, ...generos);
  // Si el foco estaba en una cápsula, se devuelve a la misma tras repintar
  if (enfocada !== undefined) radiografia.capsulas.querySelector(`[data-genero="${enfocada}"]`)?.focus();
}

/** La rejilla muestra solo el género elegido; la radiografía sigue viendo todo. */
function renderRejilla() {
  const ids = toGenreIds(radiografia.genero);
  const visibles = filterByGenre(catalog.movies, ids);
  pelis.rejilla.replaceChildren(...visibles.map(createCard));
  if (ids.length) pelis.estado.textContent = visibles.length ? '' : 'Ninguna película de este género por ahora.';
  renderEscaparate();
}

function renderPeliculas(movies) {
  renderRejilla();
  pelis.mas.hidden = !catalog.hasMore;
  updateRadiografia(movies);
}


/** Ilumina las películas de los géneros del foco; sin foco, todas normales. */
function setGenreFocus(ids) {
  const activo = ids.length > 0;
  pelis.rejilla.classList.toggle('con-foco', activo);
  for (const card of pelis.rejilla.children) {
    const generos = card.dataset.generos ? card.dataset.generos.split(' ').map(Number) : [];
    card.classList.toggle('en-foco', activo && sharesGenre(generos, ids));
  }
}

/** Vista previa al pasar o enfocar una cápsula: porción separada y, si no hay filtro, foco de luz. */
function previewCapsula(genero) {
  const ids = toGenreIds(genero);
  catalogCharts.highlight(ids.length ? sliceIndexOf(radiografia.filas, ids[0]) : null);
  setGenreFocus(ids.length && !radiografia.genero ? ids : []);
}

function handleCapsulaClick(event) {
  const boton = event.target.closest('.capsula');
  if (boton) elegirGenero(boton.dataset.genero, boton.textContent);
}

/** Única entrada al filtro, desde las cápsulas o desde el anillo. Repetir el mismo género lo quita. */
function elegirGenero(genero, etiqueta) {
  radiografia.genero = radiografia.genero === genero ? '' : genero;
  radiografia.etiqueta = etiqueta;
  radiografia.capsulas.querySelectorAll('.capsula').forEach((capsula) =>
    capsula.setAttribute('aria-pressed', String(capsula.dataset.genero === radiografia.genero)));
  pintarTitular();
  renderRejilla();
  previewCapsula(radiografia.genero);
  // Pocas películas de ese género: pedir más páginas automáticamente
  if (radiografia.genero && pelis.rejilla.children.length < MIN_VISIBLES) {
    loadPeliculas(() => fillGenre(MIN_VISIBLES));
  }
}

/** Ejecuta una acción del catálogo con estado de carga y errores. */
async function loadPeliculas(action, { enfocarNuevas = false } = {}) {
  const antes = pelis.rejilla.children.length;
  pelis.rejilla.setAttribute('aria-busy', 'true');
  pelis.estado.textContent = 'Subiendo la persiana…';
  try {
    const movies = await action();
    radiografia.generos = await getGenres().catch(() => []); // en caché: no repite la petición
    pelis.estado.textContent = movies.length ? '' : 'No hay películas que mostrar.';
    renderPeliculas(movies);
    if (enfocarNuevas && antes > 0) pelis.rejilla.children[antes]?.querySelector('a')?.focus(); // «Cargar más»: foco en la primera nueva
  } catch (error) {
    if (error.name === 'AbortError') return;
    pelis.estado.textContent = toUserMessage(error);
  } finally {
    pelis.rejilla.removeAttribute('aria-busy');
  }
}
function handlePestanaClick(event) {
  const boton = event.target.closest('[data-lista]');
  if (!boton || boton.getAttribute('aria-pressed') === 'true') return;
  pelis.pestanas.querySelector('[aria-pressed="true"]').setAttribute('aria-pressed', 'false');
  boton.setAttribute('aria-pressed', 'true');
  radiografia.genero = ''; // otra lista: el filtro anterior puede no tener películas
  pelis.rejilla.replaceChildren(); // otra lista: empezamos de cero
  loadPeliculas(() => catalog.load(boton.dataset.lista));
}

/** Lleva a una sección de la ficha; sin sección (o desconocida), al principio. */
function goToSection(seccion) {
  const destino = seccion && document.getElementById(`seccion-${seccion}`);
  if (!destino) {
    window.scrollTo(0, 0);
    ficha.titulo.focus({ preventScroll: true });
    return;
  }
  destino.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  destino.focus({ preventScroll: true });
}

async function loadFicha(id) {
  fichaController?.abort(); // si había otra ficha cargando, se cancela
  fichaController = new AbortController();

  ficha.contenido.hidden = true;
  ficha.estado.textContent = 'Subiendo la persiana…';

  try {
    const data = await getMovieDetails(id, { signal: fichaController.signal });
    const movie = new Movie(data);
    renderFicha(movie);
    document.title = `${movie.title} · NoveNoBé`;
    ficha.estado.textContent = '';
    ficha.contenido.hidden = false;
    ficha.titulo.focus({ preventScroll: true });

    const codes = movie.countries.map(({ iso_3166_1 }) => iso_3166_1);
    const apiCoords = await fetchCountryCoords(codes, { signal: fichaController.signal });
    const coords = { ...COORDENADAS_PAISES, ...apiCoords };
    fichaMarcadores = toMarkers(movie.countries, coords);

    // Sin coordenadas o sin Leaflet no hay nada que mirar (los países siguen en la ficha técnica)
    ficha.ventana.hidden = fichaMarcadores.length === 0 || !mapaDisponible();
    showMap();
    return true;
  } catch (error) {
    if (error.name === 'AbortError') return false;
    fichaActual = null; // para poder reintentar la misma película
    ficha.estado.textContent = error.status === 404
      ? 'Aquí no hay nada que ver: esta película no existe.'
      : toUserMessage(error);
    return false;
  }
}

/** El mapa vive plegado: solo se pinta con la ventana abierta (Leaflet necesita medir el contenedor). */
function showMap() {
  ficha.mapa.setAttribute('aria-label', mapLabel(fichaMarcadores));
  if (!ficha.ventana.open || !mapaDisponible()) return;
  countryMap ??= new CountryMap(ficha.mapa);
  countryMap.show(fichaMarcadores);
}
function renderFicha(movie) {
  ficha.fondo.src = movie.backdropUrl ?? movie.posterUrl;
  ficha.poster.src = movie.posterUrl;
  ficha.titulo.textContent = movie.title;

  ficha.original.hidden = !movie.hasOriginalTitle;
  ficha.original.textContent = `Título original: ${movie.originalTitle}`;

  ficha.meta.textContent = [movie.year, certificationText(pickCertification(movie.releaseDates)), movie.runtimeText]
    .filter(Boolean)
    .join(' · ');
  renderNota(movie);
  mirada.estado.textContent = '';
  renderMirada(movie.id);

  ficha.generos.replaceChildren(...movie.genreNames.map((name) => {
    const li = document.createElement('li');
    li.textContent = name;
    return li;
  }));



  ficha.eslogan.hidden = !movie.tagline;
  ficha.eslogan.textContent = movie.tagline;
  ficha.sinopsis.textContent = movie.overview;
  const nombres = movie.countries.map(({ iso_3166_1: code, name }) => countryName(code, name));
  renderEquipo(withOrigin(pickCrew(movie.credits.crew), nombres));
  renderReparto(pickCast(movie.credits.cast, MAX_REPARTO));

  ficha.nav.querySelectorAll('[data-seccion]').forEach((link) => {
    link.href = movieHref(movie.id, link.dataset.seccion);
  });

  ficha.mapa.setAttribute('aria-label', nombres.length
    ? `Mapa de los países de producción: ${nombres.join(', ')}`
    : 'Mapa sin países de producción');
}

/** Visor de la nota: el anillo muestra la nota real; la cifra y los votos se descubren al mirarla. */
function renderNota(movie) {
  const sinVotos = movie.voteCount === 0; // sin votos no hay nota pública que enfocar (tu mirada sí existe)
  ficha.nota.toggleAttribute('data-sin-tmdb', sinVotos);
  ficha.votos.hidden = sinVotos;
  ficha.nota.setAttribute('aria-pressed', 'false'); // cada película empieza a medio leer
  ficha.nota.style.setProperty('--arco-tmdb', ratingToArc(movie.rating));
  etiquetaTmdb = sinVotos ? 'Sin nota de TMDB' : `Nota de TMDB: ${movie.ratingText} sobre 10, ${movie.votesText}`;
  ficha.notaCifra.textContent = sinVotos ? '' : movie.ratingText;
  ficha.votos.textContent = `TMDB · ${movie.ratingText} · ${movie.votesText} · la versión oficial`;
}

/** Qué anuncia la mirilla a un lector de pantalla: depende del tema y de si ya hay nota propia. */
function etiquetarVisor() {
  if (!esNoche()) {
    ficha.nota.setAttribute('aria-label', etiquetaTmdb);
    return;
  }
  const propia = ficha.notaPropia.textContent;
  ficha.nota.setAttribute('aria-label', propia
    ? `Tu mirada: ${propia} sobre 10. Ir a tu lectura`
    : 'Aún no has calibrado tu mirada. Ir a tu lectura');
}

/** Pinta la mirada guardada de esa película (o el formulario vacío). La nota de TMDB no se toca. */
function renderMirada(id) {
  miradaId = id;
  const guardada = loadMiradas()[id] ?? null;
  const nota = guardada?.nota ?? null;

  const bechdel = guardada?.bechdel ?? null;

  miradaTocada = nota !== null;
  mirada.rango.value = nota ?? 5;
  mirada.texto.value = guardada?.texto ?? '';
  bechdelEtapa = 0;
  bechdelNivel = bechdel;
  pintarExamen(); // sin máquina de escribir: al abrir la ficha no se teclea nada
  pintarCifraPropia(nota);
  mirada.borrar.hidden = !guardada;
  setPiloto(guardada ? 'revelada' : 'vacia');

  // Revelada: la máquina muestra el resultado (fecha, enfoque y lectura) en lugar de los controles
  mirada.form.toggleAttribute('data-revelada', Boolean(guardada));
  mirada.entrada.hidden = !guardada;
  mirada.enfoque.textContent = nota === null ? '' : `Tu enfoque ${nota.toFixed(1)}`;
  mirada.bechdel.textContent = bechdel === null ? '' : `Bechdel: ${bechdelText(bechdel)}`;
  mirada.cita.textContent = guardada?.texto ?? '';
  const fecha = guardada?.fecha ? new Date(guardada.fecha) : null;
  mirada.fecha.dateTime = guardada?.fecha ?? '';
  mirada.fecha.textContent = fecha && !Number.isNaN(fecha.getTime())
    ? `Observada el ${FECHA_MIRADA.format(fecha)}`
    : '';

  pintarAroPropio(nota);
  pintarBechdel(bechdel);
}

/** El examen de Bechdel: la pregunta de la etapa o, si ha terminado, el resultado.
 *  El estado y las marcas van en atributos data-: el CSS decide qué se ve. */
function pintarExamen({ teclear = false } = {}) {
  const terminado = bechdelNivel !== null;
  mirada.examen.dataset.estado = terminado ? 'hecho' : 'examen';
  mirada.examen.dataset.marcas = String(terminado ? bechdelNivel : bechdelEtapa);
  mirada.examen.toggleAttribute('data-pasa', bechdelNivel === BECHDEL_PREGUNTAS.length);
  mirada.resultado.textContent = terminado ? bechdelText(bechdelNivel) : '';
  mirada.pregunta.textContent = terminado ? '' : BECHDEL_PREGUNTAS[bechdelEtapa];
  if (teclear) {
    const linea = terminado ? mirada.resultado : mirada.pregunta;
    linea.classList.remove('tecleando');
    void linea.offsetWidth; // reinicia la animación aunque la clase ya estuviera
    linea.classList.add('tecleando');
  }
}

/** Responder Sí / No: una función pura decide la etapa siguiente; aquí solo se pinta. */
function handleExamenClick(event) {
  const boton = event.target.closest('[data-respuesta]');
  if (!boton) return;
  ({ etapa: bechdelEtapa, nivel: bechdelNivel } = avanzarBechdel(bechdelEtapa, boton.dataset.respuesta === 'si'));
  pintarExamen({ teclear: true });
  pintarBechdel(bechdelNivel ?? bechdelEtapa); // la mirilla enciende una marca por criterio superado
  setPiloto('calibrando');
  if (bechdelNivel !== null) mirada.repetir.focus(); // Sí / No desaparecen: el foco no se pierde
}

/** Volver a empezar el examen (no se guarda hasta revelar). */
function handleExamenRepetir() {
  bechdelEtapa = 0;
  bechdelNivel = null;
  pintarExamen({ teclear: true });
  pintarBechdel(null);
  setPiloto('calibrando');
  mirada.examen.querySelector('[data-respuesta="si"]').focus();
}

/** Las marcas de la mirilla: una por cada nivel superado del test (solo de noche). */
function pintarBechdel(nivel) {
  if (nivel === null) ficha.nota.removeAttribute('data-bechdel');
  else ficha.nota.dataset.bechdel = String(nivel);
}

/** El aro interior de la mirilla: tu nota (solo de noche). Sin nota, el aro queda vacío. */
function pintarAroPropio(nota) {
  ficha.nota.toggleAttribute('data-propia', nota !== null);
  ficha.nota.style.setProperty('--arco-propia', ratingToArc(nota ?? 0));
  ficha.notaPropia.textContent = nota === null ? '' : nota.toFixed(1);
  ficha.leyendaPropia.textContent = nota === null
    ? 'Tu enfoque · sin calibrar · baja a «Lo que no se ve»'
    : `Tu enfoque · ${nota.toFixed(1)} · nuestra mirada`;
  etiquetarVisor();
}

/** El piloto de la máquina: un solo indicador con tres estados. */
function setPiloto(estado) {
  mirada.piloto.dataset.estado = estado;
  mirada.piloto.textContent = PILOTO[estado];
}

/** La cifra del enfoque: «¿Y tú?» hasta que mueves el rango; después, tu nota nítida. */
function pintarCifraPropia(nota) {
  mirada.cifra.textContent = nota === null ? '¿Y tú?' : nota.toFixed(1);
  mirada.cifra.toggleAttribute('data-vacia', nota === null);
  mirada.rango.toggleAttribute('data-vacia', nota === null);
  mirada.rango.setAttribute('aria-valuetext', nota === null ? 'Sin nota' : `${nota.toFixed(1)} sobre 10`);
}

/** Al calibrar, la mirilla de arriba responde en directo: la máquina y la lente son el mismo mecanismo. */
function handleMiradaInput() {
  miradaTocada = true;
  const nota = Number(mirada.rango.value);
  pintarCifraPropia(nota);
  pintarAroPropio(nota); // vista previa: no se guarda hasta revelar
  setPiloto('calibrando');
}

function handleMiradaSubmit(event) {
  event.preventDefault(); // sin recargar la página
  if (miradaId === null) return;
  const nueva = {
    nota: miradaTocada ? mirada.rango.value : null,
    texto: mirada.texto.value,
    bechdel: bechdelNivel,
    fecha: new Date().toISOString(),
  };
  if (nueva.nota === null && !nueva.texto.trim() && nueva.bechdel === null) {
    mirada.estado.textContent = 'Escribe lo que viste, termina el test o calibra tu enfoque antes de revelar.';
    return;
  }
  const ok = saveMiradas(setMirada(loadMiradas(), miradaId, nueva));
  mirada.estado.textContent = ok
    ? 'Tu lectura queda guardada en este navegador.'
    : 'No se ha podido guardar: el navegador bloquea el almacenamiento.';
  if (ok) {
    mirada.entrada.hidden = true;  // se oculta y vuelve a aparecer: la persiana se repite
    void mirada.entrada.offsetWidth; // fuerza al navegador a aplicar el cambio antes de mostrarla
    renderMirada(miradaId);
  }
}

/** Volver a escribir: la máquina se reabre con lo guardado, listo para cambiarlo. */
function handleMiradaReescribir() {
  mirada.form.removeAttribute('data-revelada');
  mirada.estado.textContent = '';
  setPiloto('calibrando');
  mirada.texto.focus(); // el botón desaparece: el foco va a la placa
}

function handleMiradaBorrar() {
  if (miradaId === null) return;
  const ok = saveMiradas(removeMirada(loadMiradas(), miradaId));
  mirada.estado.textContent = ok ? 'Mirada borrada.' : 'No se ha podido borrar.';
  if (ok) {
    renderMirada(miradaId);
    mirada.texto.focus(); // el botón Borrar desaparece: el foco no se pierde
  }
}

/** De día, tocar o pulsar el visor deja la nota pública enfocada (en móvil no hay hover).
 *  De noche no hay nada que destapar: la mirilla lleva a tu lectura. */
function toggleNota() {
  if (esNoche()) {
    goToSection('mirada');
    return;
  }
  const enfocada = ficha.nota.getAttribute('aria-pressed') === 'true';
  ficha.nota.setAttribute('aria-pressed', String(!enfocada));
}

const PROFILE_BASE = 'https://image.tmdb.org/t/p/w185';
const MAX_REPARTO = 8; // dos plantas de cuatro ventanas: se observa de un vistazo, sin carrusel
const personTemplate = document.querySelector('#plantilla-persona');

/** Pura: «Morgan Freeman» → «MF». Para quien no tiene foto en TMDB. */
const initials = (name = '') =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0].toUpperCase()).join('');

function createPerson({ name, character, profilePath }) {
  const item = personTemplate.content.firstElementChild.cloneNode(true);
  const img = item.querySelector('.persona-img');

  if (profilePath) {
    img.src = `${PROFILE_BASE}${profilePath}`;
  } else {
    img.remove(); // sin foto: quedan las iniciales
    item.classList.add('persona--sin-foto');
  }
  item.querySelector('.persona-iniciales').textContent = initials(name);
  item.querySelector('.persona-nombre').textContent = name;
  item.querySelector('.persona-personaje').textContent = character;
  return item;
}

function renderReparto(cast) {
  const hayReparto = cast.length > 0;
  ficha.reparto.replaceChildren(...cast.map(createPerson));
  ficha.reparto.hidden = !hayReparto;
  ficha.repartoVacio.hidden = hayReparto;
}

/** Pura: clasificación → texto. Si no es la española, dice de qué país es. */
const certificationText = (cert) => {
  if (!cert) return '';
  return cert.country === 'ES'
    ? cert.certification
    : `${cert.certification} (${countryName(cert.country, cert.country)})`;
};

/** Pura: añade la fila «Origen» a la ficha técnica solo si hay países. No muta `roles`. */
const withOrigin = (roles, paises) =>
  paises.length ? [...roles, { label: 'Origen', names: paises }] : roles;

function renderEquipo(roles) {
  ficha.equipo.replaceChildren(...roles.flatMap(({ label, names }) => {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = names.join(', ');
    return [dt, dd];
  }));
  ficha.equipo.hidden = roles.length === 0;
}


function handleArrowClick(event) {
  const arrow = event.target.closest('[data-flecha]');
  if (!arrow) return;
  const row = document.getElementById(arrow.dataset.objetivo);
  const direction = arrow.dataset.flecha === 'izquierda' ? -1 : 1;
  row.scrollBy({
    left: direction * row.clientWidth * 0.8,
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
  });
}

// ---------- Eventos ----------
els.btnBuscar.addEventListener('click', togglePanel);
els.input.addEventListener('input', debouncedSearch);
els.input.addEventListener('keydown', handleKeydown);
els.input.addEventListener('focus', handleFocus);
els.results.addEventListener('click', handleResultsClick);
els.btnTema.addEventListener('click', toggleTheme); // NUEVO 5d
els.genres.addEventListener('click', handleGenreClick);
document.querySelectorAll('.fila-flechas')
  .forEach((flechas) => flechas.addEventListener('click', handleArrowClick));
pelis.pestanas.addEventListener('click', handlePestanaClick);
ficha.ventana.addEventListener('toggle', showMap);
ficha.nota.addEventListener('click', toggleNota);
mirada.rango.addEventListener('input', handleMiradaInput);
mirada.form.addEventListener('submit', handleMiradaSubmit);
mirada.borrar.addEventListener('click', handleMiradaBorrar);
mirada.reescribir.addEventListener('click', handleMiradaReescribir);
mirada.examen.addEventListener('click', handleExamenClick);
mirada.repetir.addEventListener('click', handleExamenRepetir);
// Otra pestaña guardó o borró una mirada: si es la película abierta, se repinta
window.addEventListener('storage', (event) => {
  if (event.key === MIRADAS_KEY && miradaId !== null) renderMirada(miradaId);
});
pelis.mas.addEventListener('click', () => {
  const accion = radiografia.genero
    ? () => fillGenre(pelis.rejilla.children.length + MIN_VISIBLES) // con filtro: 12 más de ese género
    : () => catalog.loadMore();
  loadPeliculas(accion, { enfocarNuevas: true });
});
radiografia.capsulas.addEventListener('click', handleCapsulaClick);
radiografia.capsulas.addEventListener('pointerover', (event) => {
  const boton = event.target.closest('.capsula');
  if (boton) previewCapsula(boton.dataset.genero);
});
radiografia.capsulas.addEventListener('pointerleave', () => previewCapsula(radiografia.genero));
radiografia.capsulas.addEventListener('focusin', (event) => previewCapsula(event.target.dataset.genero ?? ''));
radiografia.capsulas.addEventListener('focusout', (event) => {
  if (!radiografia.capsulas.contains(event.relatedTarget)) previewCapsula(radiografia.genero);
});

/** La luz de cada cápsula sigue al ratón. Reutiliza la función pura de la inclinación. */
function enablePointerLight(container, selector) {
  let frame = 0; // vive en el cierre: no es una variable global
  container.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse') return;
    const target = event.target.closest(selector);
    if (!target) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const { mx, my } = tiltFromPointer(event.clientX, event.clientY, target.getBoundingClientRect());
      target.style.setProperty('--mx', `${mx.toFixed(1)}%`);
      target.style.setProperty('--my', `${my.toFixed(1)}%`);
    });
  });
}
enablePointerLight(ficha.ventana, '.ficha-mapa');

// ---------- Arranque ----------
applyTheme(loadTheme()); // NUEVO 5d: sincroniza el interruptor con el tema guardado
const hero = new HeroCarousel(document.querySelector('#hero'), { onAction: handleHeroAction });
// Una sola instancia: sus listeners se crean una vez. También pinta «Mi lista» con las favoritas.
const queVer = new QueVer(document.querySelector('#vista-que-ver'), {
  miLista: document.querySelector('#catalogo-grid'),
  filtrosLista: document.querySelector('#mi-lista-filtros'),
  avisoLista: document.querySelector('#mi-lista-aviso'),
});

Promise.allSettled([
  startRouter(handleRoute),
  loadHero(hero),
  loadRow(els.trending, () => getTrending()).then(fillEmblem),
  initGenres(),
]);

