import { searchMovies } from './api.js';
import { Movie } from './Movie.js';
import { debounce, getErrorMessage } from './utils.js';
import { addQuery, loadHistory, saveHistory } from './storage.js';

const MIN_QUERY = 2;
const DEBOUNCE_MS = 400;

const els = {
  btnBuscar: document.querySelector('#btn-buscar'),
  panel: document.querySelector('#panel-buscar'),
  input: document.querySelector('#buscador'),
  results: document.querySelector('#resultados-busqueda'),
};

let controller = null; // petición en curso (variable de módulo, no global)

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

// ---------- Búsqueda ----------
async function handleSearch(rawQuery) {
  const query = rawQuery.trim();
  controller?.abort();

  if (query.length < MIN_QUERY) {
    els.results.replaceChildren();
    return;
  }

  controller = new AbortController();
  renderMessage('Buscando…');

  try {
    const data = await searchMovies(query, { signal: controller.signal });
    const movies = data.results.map((item) => new Movie(item));
    renderResults(movies);
    if (movies.length > 0) saveHistory(addQuery(loadHistory(), query));
  } catch (error) {
    if (error.name === 'AbortError') return;
    renderMessage(getErrorMessage(error.status ?? 0));
  }
}

// ---------- Panel ----------
function togglePanel() {
  const isOpen = els.btnBuscar.getAttribute('aria-expanded') === 'true';
  els.btnBuscar.setAttribute('aria-expanded', String(!isOpen));
  els.panel.hidden = isOpen;
  if (!isOpen) els.input.focus();
}

// ---------- Eventos ----------
els.btnBuscar.addEventListener('click', togglePanel);
els.input.addEventListener(
  'input',
  debounce((event) => handleSearch(event.target.value), DEBOUNCE_MS),
);