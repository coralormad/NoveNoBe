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

export function getMovieDetails(id, { signal } = {}) {
  return request(`/movie/${id}`, {
    append_to_response: 'videos',
    include_video_language: 'es,en',
  }, signal);
}

export function getTrending() {
  return request('/trending/movie/week');
}

export async function getGenres() {
  const data = await request('/genre/movie/list');
  return data.genres;
}