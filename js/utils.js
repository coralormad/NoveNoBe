// Funciones puras: reciben datos, devuelven datos nuevos. Sin DOM, sin fetch, sin mutar.

/**
 * Ordena por popularidad, de mayor a menor, sin tocar el original.
 * @param {Array<Movie>} movies
 * @returns {Array<Movie>} Copia ordenada.
 */
export const sortByPopularity = (movies) =>
  [...movies].sort((a, b) => b.popularity - a.popularity);

/**
 * Cuenta cuántas películas hay de cada género (formato listo para Chart.js).
 * @param {Array<Movie>} movies
 * @param {Array<{id: number, name: string}>} genres - Géneros de TMDB.
 * @returns {Array<{label: string, value: number}>} De mayor a menor.
 */
export function countByGenre(movies, genres) {
  const counts = movies
    .flatMap((movie) => movie.genreIds)
    .reduce((acc, id) => ({ ...acc, [id]: (acc[id] ?? 0) + 1 }), {});

  return genres
    .filter((genre) => counts[genre.id])
    .map((genre) => ({ ids: [genre.id], label: genre.name, value: counts[genre.id] }))
    .sort((a, b) => b.value - a.value);
}

/** Mensajes de error en español según el código HTTP. Congelado: no se puede modificar. */
export const ERROR_MESSAGES = Object.freeze({
  0: 'Sin conexión. Revisa tu internet.',
  401: 'No autorizado: revisa el token de TMDB.',
  404: 'No hemos encontrado lo que buscas.',
  429: 'Demasiadas peticiones. Espera un momento.',
  500: 'TMDB tiene problemas. Inténtalo más tarde.',
  DEFAULT: 'Algo ha fallado. Inténtalo de nuevo.',
});

/**
 * Devuelve el mensaje de error para un código HTTP.
 * @param {number} status
 * @returns {string}
 */
export const getErrorMessage = (status) => ERROR_MESSAGES[status] ?? ERROR_MESSAGES.DEFAULT;

/**
 * Devuelve una versión de fn que solo se ejecuta tras `ms` sin nuevas llamadas.
 * Ojo: no es pura (guarda un temporizador), es una función de orden superior.
 * @param {Function} fn
 * @param {number} [ms=400]
 * @returns {Function}
 */
export function debounce(fn, ms = 400) {
  let timerId;
  const debounced = (...args) => {
    clearTimeout(timerId);
    timerId = setTimeout(() => fn(...args), ms);
  };
  debounced.cancel = () => clearTimeout(timerId);
  return debounced;
}

/**
 * Traduce cualquier error a un mensaje para el usuario.
 * Errores de la API → mensaje según su código HTTP.
 * Errores de programación → se muestran en consola y mensaje genérico.
 * @param {Error} error
 * @returns {string}
 */
export function toUserMessage(error) {
  if (error.name === 'ApiError') return getErrorMessage(error.status);
  console.error(error);
  return ERROR_MESSAGES.DEFAULT;
}

/**
 * Devuelve los avisos vigentes en una fecha. Los que no tienen `hasta` no caducan.
 * @param {Array<{hasta?: string}>} avisos
 * @param {Date} today - Se pasa desde fuera para que la función sea pura.
 * @returns {Array} Array nuevo con los avisos vigentes.
 */
export const filterActive = (avisos, today) =>
  avisos.filter(({ hasta }) => !hasta || new Date(`${hasta}T23:59:59`) >= today);

/**
 * Las N primeras personas del reparto, en el orden de créditos de TMDB.
 * @param {Array} cast - credits.cast crudo
 * @param {number} max
 * @returns {Array<{id, name, character, profilePath}>} Array nuevo (no muta `cast`).
 */
export const pickCast = (cast = [], max = 15) =>
  [...cast]
    .sort((a, b) => a.order - b.order)
    .slice(0, max)
    .map(({ id, name, character, profile_path }) => ({
      id,
      name,
      character: character || '',
      profilePath: profile_path ?? null,
    }));

// Puestos que mostramos, con los nombres de `job` que usa TMDB
const CREW_ROLES = Object.freeze([
  { label: 'Dirección', jobs: ['Director'] },
  { label: 'Guion', jobs: ['Screenplay', 'Writer'] },
  { label: 'Música', jobs: ['Original Music Composer', 'Music'] },
  { label: 'Fotografía', jobs: ['Director of Photography'] },
]);

/**
 * Agrupa el equipo técnico por puesto, sin nombres repetidos y sin puestos vacíos.
 * @param {Array} crew - credits.crew crudo
 * @returns {Array<{label: string, names: string[]}>}
 */
export function pickCrew(crew = []) {
  return CREW_ROLES
    .map(({ label, jobs }) => ({
      label,
      names: [...new Set(crew.filter((p) => jobs.includes(p.job)).map((p) => p.name))],
    }))
    .filter((role) => role.names.length > 0);
}

/**
 * Clasificación por edad: la del primer país de la lista que la tenga.
 * @param {Array} releaseDates - release_dates.results crudo
 * @param {string[]} countries - Orden de preferencia (ISO 3166-1)
 * @returns {{country: string, certification: string} | null}
 */
export function pickCertification(releaseDates = [], countries = ['ES', 'US']) {
  for (const code of countries) {
    const entry = releaseDates.find((r) => r.iso_3166_1 === code);
    const certification = entry?.release_dates?.find((d) => d.certification)?.certification;
    if (certification) return { country: code, certification };
  }
  return null;
}

/**
 * Quita películas repetidas (TMDB puede repetir una entre páginas). Se queda con la primera posición.
 * @param {Array<Movie>} movies
 * @returns {Array<Movie>} Array nuevo sin repetidos.
 */
export const uniqueById = (movies) => [...new Map(movies.map((movie) => [movie.id, movie])).values()];

/** Deja las N primeras filas y agrupa el resto en «Otros», que guarda todos sus ids. */
export function groupTail(rows, max = 5, otherLabel = 'Otros') {
  if (rows.length <= max) return rows;
  const rest = rows.slice(max);
  const other = {
    ids: rest.flatMap((row) => row.ids ?? []),
    label: otherLabel,
    value: rest.reduce((sum, row) => sum + row.value, 0),
  };
  return [...rows.slice(0, max), other];
}

// Cómo se dice cada lista en el titular
const LIST_CONTEXT = Object.freeze({
  popular: 'en lo más popular',
  top_rated: 'en lo mejor valorado',
  now_playing: 'en los cines',
  upcoming: 'en los próximos estrenos',
});

/** Titular del cartel a partir de datos reales, sin cifras. Sin datos, lo dice. */
export function headline(genreStats, list) {
  if (genreStats.length === 0) return 'Aún no hay películas que mostrar.';
  const [{ label }] = genreStats; // el primero es el mayor (countByGenre ya ordena)
  return `${label} manda ${LIST_CONTEXT[list] ?? 'en el catálogo'}.`;
}

/** Pura: nombres de los géneros de una película («Drama · Crimen»), como mucho `max`. */
export const genreNames = (ids, genres, max = 2) =>
  ids.map((id) => genres.find((genre) => genre.id === id)?.name).filter(Boolean).slice(0, max).join(' · ');

/** Texto para lectores de pantalla: «Drama: 12, Acción: 8…». */
export const describeRows = (rows) => rows.map(({ label, value }) => `${label}: ${value}`).join(', ');

/** ¿La película comparte algún género con los del foco? */
export const sharesGenre = (genreIds, focusIds) => genreIds.some((id) => focusIds.includes(id));

/** Pura: películas con alguno de esos géneros. Sin ids, todas. */
export const filterByGenre = (movies, ids = []) =>
  ids.length ? movies.filter((movie) => sharesGenre(movie.genreIds, ids)) : movies;

/** Pura: tamaño de la cápsula según su peso frente al género mayor. */
export function sizeBucket(value, max) {
  const ratio = max > 0 ? value / max : 0;
  if (ratio >= 0.6) return 'l';
  if (ratio >= 0.3) return 'm';
  return 's';
}

/** Pura: clave del filtro («18» o «80,53» para «Otros») → ids numéricos. Sin clave, []. */
export const toGenreIds = (key = '') => (key ? key.split(',').map(Number) : []);

/** Pura: en qué porción del doughnut está un género (-1 si no está). */
export const sliceIndexOf = (rows, genreId) => rows.findIndex((row) => row.ids.includes(genreId));

/** Pura: titular con un género elegido. Sin cifras: solo lo que se mira. */
export const genreHeadline = (label) => `Solo ${label}. Lo demás queda fuera de plano.`;

/** Pura: las N más populares de esos géneros (sin ids, de todo el catálogo). */
export const topOfGenre = (movies, ids = [], max = 5) =>
  sortByPopularity(filterByGenre(movies, ids)).slice(0, max);

// ---------- Mi lista ----------

/** Filtros de Mi lista: qué películas deja ver cada uno según estén vistas o no. */
export const FILTROS_LISTA = Object.freeze(['todas', 'pendientes', 'observadas']);

/**
 * Pura: filtra las películas guardadas por su estado.
 * @param {object[]} lista - Películas guardadas.
 * @param {Array<number|string>} observadas - Identificadores de las ya vistas.
 * @param {'todas'|'pendientes'|'observadas'} [filtro='todas']
 * @param {string} [campo='id'] - Qué propiedad identifica a cada película (Mi lista usa «clave»).
 * @returns {Array} Array nuevo (no muta la lista).
 */
export function filterByWatched(lista, observadas, filtro = 'todas', campo = 'id') {
  if (filtro === 'observadas') return lista.filter((item) => observadas.includes(item[campo]));
  if (filtro === 'pendientes') return lista.filter((item) => !observadas.includes(item[campo]));
  return [...lista];
}

/** Pura: número de colección con dos cifras (0 → «01»). Es un orden, no una cifra que leer. */
export const numeroDeColeccion = (indice) => String(indice + 1).padStart(2, '0');

/**
 * Pura: quita de unos resultados de TMDB las películas que ya se muestran en otra fila.
 * @param {Array<{id:number}>} results @param {Array<{id:number}>} yaVistas
 * @returns {Array} array nuevo (no muta)
 */
export function excludeIds(results, yaVistas) {
  const ids = new Set(yaVistas.map(({ id }) => id));
  return results.filter(({ id }) => !ids.has(id));
}

/**
 * Pura: ¿queda contenido fuera de plano a cada lado de una tira con scroll horizontal?
 * El margen de 2px evita parpadeos por redondeos de subpíxel.
 * @returns {{ antes: boolean, despues: boolean }}
 */
export const bordesDeScroll = (scrollLeft, clientWidth, scrollWidth, margen = 2) => ({
  antes: scrollLeft > margen,
  despues: scrollLeft + clientWidth < scrollWidth - margen,
});

/** Pura: nota (0-10) → porción del aro de la mirilla (0-100, el pathLength del SVG). Acotada. */
export const ratingToArc = (rating) => Math.min(Math.max(Number(rating) || 0, 0), 10) * 10;

/** Pura: nota 0-10 → cuánto se revela cada fotograma de la tira (1 = revelado, 0 = sin revelar).
 *  Un fotograma por punto; el último, en proporción (6,7 → seis enteros y el séptimo al 70 %). */
export const fotogramas = (nota, total = 10) =>
  Array.from({ length: total }, (_, i) => Math.round(Math.min(Math.max((Number(nota) || 0) - i, 0), 1) * 100) / 100);
