// Historial de búsquedas en localStorage.
// addQuery es PURA. Solo load/save/clear tocan el navegador.

const HISTORY_KEY = 'novenobe:history';
const MAX_ITEMS = 10;
const MIN_LENGTH = 2;

/**
 * Añade una búsqueda al historial sin mutar el original.
 * @param {string[]} history - Historial actual.
 * @param {string} query - Texto buscado.
 * @returns {string[]} Array nuevo: la más reciente primero, sin duplicados, máx. 10.
 */
export function addQuery(history, query) {
  const term = String(query ?? '').trim();
  if (term.length < MIN_LENGTH) return [...history];

  const rest = history.filter((item) => item.toLowerCase() !== term.toLowerCase());
  return [term, ...rest].slice(0, MAX_ITEMS);
}

/**
 * Lee el historial. Nunca lanza error.
 * @returns {string[]}
 */
export function loadHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY));
    return Array.isArray(parsed)
      ? parsed.filter((item) => typeof item === 'string').slice(0, MAX_ITEMS)
      : [];
  } catch {
    return [];
  }
}

/**
 * Guarda el historial.
 * @param {string[]} history
 * @returns {boolean} true si se guardó.
 */
export function saveHistory(history) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    return true;
  } catch {
    return false;
  }
}

/** Borra el historial. */
export function clearHistory() {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // localStorage bloqueado: no hay nada que borrar
  }
}

// ---------- Tema ----------
const THEME_KEY = 'novenobe:theme';
const THEMES = ['oscuro', 'claro'];
export const DEFAULT_THEME = 'oscuro';

/**
 * Lee el tema guardado. Si no existe o no es válido, devuelve 'oscuro'. Nunca lanza.
 * @returns {'oscuro'|'claro'}
 */
export function loadTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return THEMES.includes(saved) ? saved : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/**
 * Guarda el tema.
 * @param {'oscuro'|'claro'} theme
 * @returns {boolean} true si se guardó.
 */
export function saveTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
    return true;
  } catch {
    return false;
  }
}
// ---------- Listas de ids: favoritas y observadas (Mi lista) ----------
// Las dos listas comparten las mismas funciones: un único sistema, dos claves.
const FAVORITES_KEY = 'novenobe_favoritos';
const OBSERVED_KEY = 'novenobe_observadas';

/** Pura: limpia lo leído (datos corruptos, tipos raros o repetidos) → ids enteros únicos. */
export const sanitizeIds = (raw) =>
  Array.isArray(raw) ? [...new Set(raw.filter(Number.isInteger))] : [];

/** Pura: añade el id si no está y lo quita si está. Devuelve un array nuevo (no muta). */
export const toggleId = (ids, id) =>
  ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];

/** Lee una lista de ids. Si no hay, o el JSON está roto, devuelve []. Nunca lanza. */
function readIds(key) {
  try {
    return sanitizeIds(JSON.parse(localStorage.getItem(key)));
  } catch {
    return [];
  }
}

/** Guarda una lista de ids. Devuelve true si se guardó (false si el navegador lo bloquea). */
function writeIds(key, ids) {
  try {
    localStorage.setItem(key, JSON.stringify(sanitizeIds(ids)));
    return true;
  } catch {
    return false;
  }
}

/** @returns {number[]} ids de las películas guardadas en Mi lista */
export const loadFavorites = () => readIds(FAVORITES_KEY);
/** @param {number[]} ids @returns {boolean} */
export const saveFavorites = (ids) => writeIds(FAVORITES_KEY, ids);

/** @returns {number[]} ids de las películas marcadas como vistas */
export const loadObserved = () => readIds(OBSERVED_KEY);
/** @param {number[]} ids @returns {boolean} */
export const saveObserved = (ids) => writeIds(OBSERVED_KEY, ids);
