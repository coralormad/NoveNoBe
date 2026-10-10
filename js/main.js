import { searchMovies, getTrending } from './api.js';
import { Movie } from './Movie.js';
import { debounce, getErrorMessage } from './utils.js';
import { addQuery, clearHistory, loadHistory, saveHistory, loadTheme, saveTheme } from './storage.js';

const MIN_QUERY = 2;
const DEBOUNCE_MS = 400;

const els = {
  btnBuscar: document.querySelector('#btn-buscar'),
  panel: document.querySelector('#panel-buscar'),
  input: document.querySelector('#buscador'),
  results: document.querySelector('#resultados-busqueda'),
  trending: document.querySelector('#fila-tendencias'),
  btnTema: document.querySelector('#btn-tema'), // NUEVO 5d
};

let controller = null; // petición en curso (variable de módulo, no global)

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
    li.textContent = `${movie.title} (${movie.yearText}) · ★ ${movie.ratingText}`;
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
function createCard(movie) {
  const card = document.createElement('article');
  card.className = 'tarjeta';
  card.dataset.id = movie.id;

  const img = document.createElement('img');
  img.src = movie.posterUrl;
  img.alt = `Póster de ${movie.title}`;
  img.loading = 'lazy';
  img.width = 342;
  img.height = 513;

  const title = document.createElement('h3');
  title.className = 'tarjeta-titulo';
  title.textContent = movie.title;

  const meta = document.createElement('p');
  meta.className = 'tarjeta-meta';
  meta.textContent = `${movie.yearText} · ★ ${movie.ratingText}`;

  card.append(img, title, meta);
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

async function loadTrending() {
  renderRowMessage(els.trending, 'Cargando…');
  try {
    const data = await getTrending();
    const movies = data.results.map((item) => new Movie(item));
    renderRow(els.trending, movies);
  } catch (error) {
    renderRowMessage(els.trending, getErrorMessage(error.status ?? 0));
  }
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

// ---------- Eventos ----------
els.btnBuscar.addEventListener('click', togglePanel);
els.input.addEventListener('input', debouncedSearch);
els.input.addEventListener('keydown', handleKeydown);
els.input.addEventListener('focus', handleFocus);
els.results.addEventListener('click', handleResultsClick);
els.btnTema.addEventListener('click', toggleTheme); // NUEVO 5d

// ---------- Arranque ----------
applyTheme(loadTheme()); // NUEVO 5d: sincroniza el interruptor con el tema guardado
loadTrending();