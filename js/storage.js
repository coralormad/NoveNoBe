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

// ---------- Tu mirada: nota propia + archivo de observaciones, por id de TMDB ----------
// Independiente de TMDB: nunca se mezcla con vote_average.
// Formato: { [id]: { nota, bechdel, fecha, observaciones: [{ id, texto, fecha }] } }
export const MIRADAS_KEY = 'novenobe_miradas';
const MAX_TEXTO = 600;
const MAX_OBSERVACIONES = 30; // un archivo, no un diario: se guardan las más recientes

/** Pura: nota en pasos de 0,5 y acotada a 0-10. Si no es un número, null (sin nota). */
export const clampNota = (valor) => {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) ? Math.min(Math.max(Math.round(n * 2) / 2, 0), 10) : null;
};

/** Pura: nivel del test de Bechdel (0-3, entero). Sin responder o inválido → null. 0 es una respuesta válida. */
export const clampBechdel = (valor) => {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = Number(valor);
  return Number.isInteger(n) && n >= 0 && n <= 3 ? n : null;
};

const limpiarTexto = (texto) => (typeof texto === 'string' ? texto.trim().slice(0, MAX_TEXTO) : '');
const limpiarFecha = (fecha) => (typeof fecha === 'string' ? fecha : null);

/** Pura: id estable de una observación a partir de su fecha (no depende del orden). */
export const idObservacion = (fecha) => `o${Date.parse(fecha) || 0}`;

/** Pura: una observación válida { id, texto, fecha } o null si está vacía o corrupta. */
export function sanitizeObservacion(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const texto = limpiarTexto(raw.texto);
  if (!texto) return null;
  const fecha = limpiarFecha(raw.fecha);
  const id = typeof raw.id === 'string' && raw.id ? raw.id : idObservacion(fecha);
  return { id, texto, fecha };
}

/** Pura: el archivo de una mirada. Migra el formato antiguo (un solo `texto`) a una observación. */
export function sanitizeObservaciones(raw) {
  const lista = Array.isArray(raw?.observaciones)
    ? raw.observaciones
    : [{ texto: raw?.texto, fecha: raw?.fecha }]; // mirada guardada antes del archivo
  return lista.map(sanitizeObservacion).filter(Boolean).slice(-MAX_OBSERVACIONES);
}

/** Pura: añade una observación al final (la más reciente). No muta la lista. */
export const addObservacion = (lista, { texto, fecha }) =>
  sanitizeObservaciones({ observaciones: [...lista, { id: idObservacion(fecha), texto, fecha }] });

/** Pura: corrige el texto de una observación. Si queda vacía, se retira. No muta la lista. */
export const editObservacion = (lista, id, texto) =>
  sanitizeObservaciones({ observaciones: lista.map((obs) => (obs.id === id ? { ...obs, texto } : obs)) });

/** Pura: retira una observación del archivo. No muta la lista. */
export const removeObservacion = (lista, id) => lista.filter((obs) => obs.id !== id);

/** Pura: limpia una mirada. Sin nota, sin observaciones y sin Bechdel no hay nada que guardar → null.
 *  Las miradas guardadas antes del test o del archivo se leen igual. */
export function sanitizeMirada(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const nota = clampNota(raw.nota);
  const bechdel = clampBechdel(raw.bechdel);
  const observaciones = sanitizeObservaciones(raw);
  if (nota === null && bechdel === null && observaciones.length === 0) return null;
  return { nota, bechdel, fecha: limpiarFecha(raw.fecha), observaciones };
}

/** Pura: limpia el objeto leído (claves que no son ids, miradas vacías o corruptas). */
export function sanitizeMiradas(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw)
      .filter(([id]) => /^\d+$/.test(id))
      .map(([id, mirada]) => [id, sanitizeMirada(mirada)])
      .filter(([, mirada]) => mirada !== null)
  );
}

/** Pura: quita la mirada de una película. Devuelve un objeto nuevo (no muta). */
export const removeMirada = (miradas, id) =>
  Object.fromEntries(Object.entries(miradas).filter(([clave]) => clave !== String(id)));

/** Pura: guarda (o sustituye) la mirada de una película. Si queda vacía, la quita. */
export function setMirada(miradas, id, mirada) {
  const limpia = sanitizeMirada(mirada);
  return limpia ? { ...miradas, [id]: limpia } : removeMirada(miradas, id);
}

/** Lee todas las miradas. Nunca lanza: si falla, {}. */
export function loadMiradas() {
  try {
    return sanitizeMiradas(JSON.parse(localStorage.getItem(MIRADAS_KEY)));
  } catch {
    return {};
  }
}

/** Guarda todas las miradas. Devuelve true si se guardó (false si el navegador lo bloquea). */
export function saveMiradas(miradas) {
  try {
    localStorage.setItem(MIRADAS_KEY, JSON.stringify(miradas));
    return true;
  } catch {
    return false;
  }
}
