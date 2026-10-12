import { MovieCatalog } from './catalog.js';
import { searchMovies, getTrending, getGenres, discoverMovies, getMovieList, getMovieDetails } from './api.js';
import { Movie } from './Movie.js';
import { debounce, toUserMessage, filterActive, pickCast, pickCrew, pickCertification } from './utils.js';
import { addQuery, clearHistory, loadHistory, saveHistory, loadTheme, saveTheme } from './storage.js';
import { HeroCarousel, pickHeroMovies, buildSlides, createSlide, fillEmblem, setAmbient } from './hero.js';
import { CountryMap, toMarkers, countryName } from './map.js';
import { COORDENADAS_PAISES } from '../data/paises.js';
import { startRouter, movieHref } from './router.js';
import { enableCardTilt } from './tilt.js';
import { AVISOS } from '../data/avisos.js';


const MIN_QUERY = 2;
const DEBOUNCE_MS = 400;

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
  generos: document.querySelector('#ficha-generos'),
  eslogan: document.querySelector('#ficha-eslogan'),
  sinopsis: document.querySelector('#ficha-sinopsis'),
  equipo: document.querySelector('#ficha-equipo'),
  nav: document.querySelector('#ficha-nav'),
  mapa: document.querySelector('#ficha-mapa'),
  paises: document.querySelector('#ficha-paises'),
  reparto: document.querySelector('#ficha-reparto'),
  repartoVacio: document.querySelector('#ficha-reparto-vacio'),
  repartoFlechas: document.querySelector('#reparto-flechas'),
};

let fichaActual = null; // id de la película pintada: si solo cambia la sección, no se vuelve a pedir
let fichaController = null;
let countryMap = null; // se crea la primera vez que se abre una ficha
let scrollInicio = 0; // para volver al mismo punto del inicio

let controller = null; // petición en curso (variable de módulo, no global)
let genreController = null; // petición de género en curso

// ---------- Tema (NUEVO 5d) ----------
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  els.btnTema.setAttribute('aria-checked', String(theme === 'oscuro'));
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'oscuro' ? 'claro' : 'oscuro';
  applyTheme(next);
  saveTheme(next);
  if (!ficha.vista.hidden) countryMap?.refresh();
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

// Películas y Mi lista comparten la misma vista HTML (#vista-catalogo)
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

function renderPeliculas(movies) {
  pelis.rejilla.replaceChildren(...movies.map(createCard));
  pelis.mas.hidden = !catalog.hasMore;
}

/** Ejecuta una acción del catálogo (load o loadMore) con estado de carga y errores. */
async function loadPeliculas(action) {
  const antes = pelis.rejilla.children.length;
  pelis.rejilla.setAttribute('aria-busy', 'true');
  pelis.estado.textContent = 'Subiendo la persiana…';
  try {
    const movies = await action();
    pelis.estado.textContent = movies.length ? '' : 'No hay películas que mostrar.';
    renderPeliculas(movies);
    if (antes > 0) pelis.rejilla.children[antes]?.querySelector('a')?.focus(); // «Cargar más»: foco en la primera nueva
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
    ficha.contenido.hidden = false; // primero visible: Leaflet necesita medir el contenedor
    ficha.titulo.focus({ preventScroll: true });

    countryMap ??= new CountryMap(ficha.mapa);
    countryMap.show(toMarkers(movie.countries, COORDENADAS_PAISES));
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

function renderFicha(movie) {
  ficha.fondo.src = movie.backdropUrl ?? movie.posterUrl;
  ficha.poster.src = movie.posterUrl;
  ficha.titulo.textContent = movie.title;

  ficha.original.hidden = !movie.hasOriginalTitle;
  ficha.original.textContent = `Título original: ${movie.originalTitle}`;

  ficha.meta.textContent = [movie.year, certificationText(pickCertification(movie.releaseDates)), movie.runtimeText]
    .filter(Boolean)
    .join(' · ');
  ficha.nota.textContent = `★ ${movie.ratingText} · TMDB · ${movie.votesText}`;

  ficha.generos.replaceChildren(...movie.genreNames.map((name) => {
    const li = document.createElement('li');
    li.textContent = name;
    return li;
  }));



  ficha.eslogan.hidden = !movie.tagline;
  ficha.eslogan.textContent = movie.tagline;
  ficha.sinopsis.textContent = movie.overview;
  renderEquipo(pickCrew(movie.credits.crew));
  renderReparto(pickCast(movie.credits.cast));

  ficha.nav.querySelectorAll('[data-seccion]').forEach((link) => {
    link.href = movieHref(movie.id, link.dataset.seccion);
  });

  const nombres = movie.countries.map(({ iso_3166_1: code, name }) => countryName(code, name));
  ficha.paises.textContent = nombres.length ? nombres.join(' · ') : 'Sin países de producción registrados.';
  ficha.mapa.setAttribute('aria-label', nombres.length
    ? `Mapa de los países de producción: ${nombres.join(', ')}`
    : 'Mapa sin países de producción');
}

const PROFILE_BASE = 'https://image.tmdb.org/t/p/w185';
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
  ficha.repartoFlechas.hidden = !hayReparto;
  ficha.repartoVacio.hidden = hayReparto;
  ficha.reparto.scrollLeft = 0; // nueva película → empieza por la primera persona
}

/** Pura: clasificación → texto. Si no es la española, dice de qué país es. */
const certificationText = (cert) => {
  if (!cert) return '';
  return cert.country === 'ES'
    ? cert.certification
    : `${cert.certification} (${countryName(cert.country, cert.country)})`;
};

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
pelis.mas.addEventListener('click', () => loadPeliculas(() => catalog.loadMore()));

// ---------- Arranque ----------
applyTheme(loadTheme()); // NUEVO 5d: sincroniza el interruptor con el tema guardado
const hero = new HeroCarousel(document.querySelector('#hero'), { onAction: handleHeroAction });

Promise.allSettled([
  startRouter(handleRoute),
  loadHero(hero),
  loadRow(els.trending, () => getTrending()).then(fillEmblem),
  initGenres(),
]);

