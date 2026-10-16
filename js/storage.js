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
export const DEFAULT_THEME = 'claro'; // se empieza con la luz encendida: la superficie; al apagarla, la revelación

/**
 * Lee el tema guardado. Si no existe o no es válido, devuelve 'claro'. Nunca lanza.
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
// ---------- Mi lista ----------
// Antes guardaba ids del catálogo local de «Qué ver» (1, 2, 3…). Ahora guarda películas de toda la SPA,
// identificadas por una clave: «t» + id de TMDB, o «l» + id local para lo que no está en TMDB (las series).
// Las claves antiguas solo se leen una vez, para migrar (js/miLista.js).
const FAVORITES_KEY = 'novenobe_favoritos';   // formato antiguo (solo lectura)
const OBSERVED_KEY = 'novenobe_observadas';   // formato antiguo (solo lectura)
export const LISTA_KEY = 'novenobe_lista';
const LISTA_OBSERVADAS_KEY = 'novenobe_lista_observadas';
const CLAVE_VALIDA = /^[tl]\d+$/;

/** Pura: limpia lo leído (datos corruptos, tipos raros o repetidos) → ids enteros únicos. */
export const sanitizeIds = (raw) =>
  Array.isArray(raw) ? [...new Set(raw.filter(Number.isInteger))] : [];

/** Pura: añade el valor si no está y lo quita si está. Devuelve un array nuevo (no muta). */
export const toggleId = (ids, id) =>
  ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];

/** Pura: claves únicas y bien formadas («t603», «l2»). */
export const sanitizeClaves = (raw) =>
  Array.isArray(raw) ? [...new Set(raw.filter((c) => typeof c === 'string' && CLAVE_VALIDA.test(c)))] : [];

/** Pura: una película guardada, tal y como se pinta en Mi lista (una instantánea: no hace falta pedirla otra vez). */
export function sanitizeEntrada(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.clave !== 'string' || !CLAVE_VALIDA.test(raw.clave)) return null;
  const titulo = typeof raw.titulo === 'string' ? raw.titulo.trim().slice(0, 200) : '';
  return {
    clave: raw.clave,
    tmdbId: Number.isInteger(raw.tmdbId) ? raw.tmdbId : null,
    titulo: titulo || 'Sin título',
    anio: ['string', 'number'].includes(typeof raw.anio) ? String(raw.anio).slice(0, 4) : '',
    poster: typeof raw.poster === 'string' && raw.poster.startsWith('/') ? raw.poster : null,
    generos: Array.isArray(raw.generos) ? raw.generos.filter(Number.isInteger) : [],
  };
}

/** Pura: lista limpia y sin repetidas (si una clave sale dos veces, se queda la primera). */
export function sanitizeLista(raw) {
  if (!Array.isArray(raw)) return [];
  const vistas = new Set();
  return raw.map(sanitizeEntrada).filter((entrada) => {
    if (!entrada || vistas.has(entrada.clave)) return false;
    vistas.add(entrada.clave);
    return true;
  });
}

/** Lee un JSON de localStorage. Si no existe devuelve `vacio`; si está roto o bloqueado, `roto`. Nunca lanza. */
function readJson(key, { vacio, roto }) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? vacio : JSON.parse(raw);
  } catch {
    return roto;
  }
}

/** Guarda un JSON. Devuelve true si se guardó (false si el navegador lo bloquea). */
function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** @returns {number[]} formato antiguo: ids locales guardados desde «Qué ver» (solo para migrar) */
export const loadFavorites = () => sanitizeIds(readJson(FAVORITES_KEY, { vacio: [], roto: [] }));
/** @returns {number[]} formato antiguo: ids locales marcados como vistos (solo para migrar) */
export const loadObserved = () => sanitizeIds(readJson(OBSERVED_KEY, { vacio: [], roto: [] }));

/** @returns {object[]|null} Mi lista. null = nunca se ha guardado (toca migrar el formato antiguo). */
export function loadLista() {
  const raw = readJson(LISTA_KEY, { vacio: null, roto: [] });
  return raw === null ? null : sanitizeLista(raw);
}
/** @param {object[]} lista @returns {boolean} */
export const saveLista = (lista) => writeJson(LISTA_KEY, sanitizeLista(lista));

/** @returns {string[]} claves de las películas de Mi lista marcadas como vistas */
export const loadListaObservadas = () => sanitizeClaves(readJson(LISTA_OBSERVADAS_KEY, { vacio: [], roto: [] }));
/** @param {string[]} claves @returns {boolean} */
export const saveListaObservadas = (claves) => writeJson(LISTA_OBSERVADAS_KEY, sanitizeClaves(claves));

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
