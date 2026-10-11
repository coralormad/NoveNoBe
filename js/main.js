import { searchMovies, getTrending, getGenres, discoverMovies, getMovieList } from './api.js';
import { Movie } from './Movie.js';
import { debounce, toUserMessage, filterActive } from './utils.js';
import { addQuery, clearHistory, loadHistory, saveHistory, loadTheme, saveTheme } from './storage.js';
import { HeroCarousel, pickHeroMovies, buildSlides, createSlide, fillEmblem, setAmbient} from './hero.js';

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

  card.querySelector('.tarjeta-boton')
    .setAttribute('aria-label', `${movie.title}, ${movie.year}. Nota ${movie.ratingText}`);
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
    renderRowMessage(container, getErrorMessage(error.status ?? 0));
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
    renderRowMessage(els.genreRow, getErrorMessage(error.status ?? 0));
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
    picks = pickHeroMovies({
      nowPlaying: Movie.fromList(nowPlaying.results),
      upcoming: Movie.fromList(upcoming.results),
      today,
    });
  } catch (error) {
    console.warn('Hero sin novedades; se muestran presentación y avisos.', error);
  }
  const slides = buildSlides({ ...picks, avisos: filterActive(AVISOS, today) });
  hero.addSlides(slides.map(createSlide));
  setAmbient(picks.nowPlaying);
}

function handleHeroAction(button) {
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
    renderMessage(getErrorMessage(error.status ?? 0));
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

function deselectRow(row) {
  row.querySelectorAll('.tarjeta-boton[aria-pressed="true"]')
    .forEach((button) => button.setAttribute('aria-pressed', 'false'));
  delete row.dataset.seleccion;
}

function selectCard(row, button) {
  deselectRow(row);
  button.setAttribute('aria-pressed', 'true');
  row.dataset.seleccion = 'true';
  button.closest('.tarjeta').scrollIntoView({
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    inline: 'center',
    block: 'nearest',
  });
}

function openFicha(id) {
  // Fase 6: aquí abriremos el modal con getMovieDetails(id) y el mapa.
}

function handleRowClick(event) {
  const button = event.target.closest('.tarjeta-boton');
  if (!button) return;

  if (button.getAttribute('aria-pressed') === 'true') {
    openFicha(button.closest('.tarjeta').dataset.id);
    return;
  }
  selectCard(event.currentTarget, button);
}

function handleRowKeydown(event) {
  if (event.key === 'Escape') deselectRow(event.currentTarget);
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

function handleOutsideClick(event) {
  if (event.target.closest('.fila-flechas')) return; // las flechas no cuentan como "fuera"
  document.querySelectorAll('.carrusel[data-seleccion]').forEach((row) => {
    if (!row.contains(event.target)) deselectRow(row);
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
document.addEventListener('click', handleOutsideClick);


// ---------- Arranque ----------
applyTheme(loadTheme()); // NUEVO 5d: sincroniza el interruptor con el tema guardado
const hero = new HeroCarousel(document.querySelector('#hero'), { onAction: handleHeroAction });

Promise.allSettled([
  loadHero(hero),
  loadRow(els.trending, () => getTrending()).then((movies) => {
    fillEmblem(movies);
    setAmbient(movies);
  }),
  initGenres(),
]);