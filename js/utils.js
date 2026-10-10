// Funciones puras: reciben datos, devuelven datos nuevos. Sin DOM, sin fetch, sin mutar.

/** Comprueba si un filtro tiene valor (ignora undefined, null y ''). */
const hasValue = (value) => value !== undefined && value !== null && value !== '';

/**
 * Filtra películas por género, año y nota mínima.
 * @param {Array<Movie>} movies - Lista de películas.
 * @param {{genreId?: number, year?: number, minRating?: number}} [filters={}] - Filtros opcionales.
 * @returns {Array<Movie>} Array nuevo con las que cumplen todos los filtros.
 */
export function filterMovies(movies, { genreId, year, minRating } = {}) {
  return movies.filter((movie) =>
    (!hasValue(genreId) || movie.genreIds.includes(genreId)) &&
    (!hasValue(year) || movie.year === year) &&
    (!hasValue(minRating) || movie.rating >= minRating)
  );
}

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
    .map((genre) => ({ label: genre.name, value: counts[genre.id] }))
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