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