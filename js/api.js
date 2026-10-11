import { ACCESS_TOKEN, TMDB_BASE_URL } from './config.js';

const DEFAULT_LANGUAGE = 'es-ES';

// Error propio con el código HTTP (0 = sin conexión)
export class ApiError extends Error {
  constructor(status) {
    super(`TMDB ${status}`);
    this.name = 'ApiError';
    this.status = status;
  }
}

// Helper privado: todas las peticiones a TMDB pasan por aquí
async function request(endpoint, params = {}, signal) {
  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  url.search = new URLSearchParams({ language: DEFAULT_LANGUAGE, ...params });

  let response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        accept: 'application/json',
      },
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error; // cancelación: no es un fallo
    throw new ApiError(0);                         // sin red / DNS / CORS
  }

  if (!response.ok) {
    throw new ApiError(response.status);
  }

  return response.json();
}

export function searchMovies(query, { page = 1, signal } = {}) {
  return request('/search/movie', { query, page, include_adult: false }, signal);
}

// Una sola petición trae detalles + reparto + recomendadas + clasificación + plataformas + vídeos + palabras clave
const DETAIL_EXTRAS = 'credits,recommendations,release_dates,watch/providers,videos,keywords';

export function getMovieDetails(id, { signal } = {}) {
  return request(`/movie/${id}`, {
    append_to_response: DETAIL_EXTRAS,
    include_video_language: 'es,en',
  }, signal);
}

// Listas "fijas" de TMDB que sirven con la misma función
const MOVIE_LISTS = Object.freeze(['popular', 'top_rated', 'upcoming', 'now_playing']);

export function getTrending(timeWindow = 'week') {
  return request(`/trending/movie/${timeWindow}`);
}

export async function getMovieList(type, { page = 1, signal } = {}) {
  if (!MOVIE_LISTS.includes(type)) throw new Error(`Lista no válida: ${type}`);
  return request(`/movie/${type}`, { page, region: 'ES' }, signal);
}

export function discoverMovies({ genreId, page = 1, signal } = {}) {
  return request('/discover/movie', {
    page,
    sort_by: 'popularity.desc',
    include_adult: false,
    'vote_count.gte': 100,
    ...(genreId && { with_genres: genreId }),
  }, signal);
}

export function getRecommendations(id, { signal } = {}) {
  return request(`/movie/${id}/recommendations`, {}, signal);
}

export async function getGenres() {
  const data = await request('/genre/movie/list');
  return data.genres;
}