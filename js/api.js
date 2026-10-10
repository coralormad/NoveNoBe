import { ACCESS_TOKEN, TMDB_BASE_URL } from './config.js';

const DEFAULT_LANGUAGE = 'es-ES';

// 1️⃣ NUEVO: error personalizado con el código HTTP
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

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      accept: 'application/json',
    },
    signal,
  });

  // 2️⃣ CAMBIADO: antes era throw new Error(`TMDB ${response.status}: ${response.statusText}`)
  if (!response.ok) {
    throw new ApiError(response.status);
  }

  return response.json();
}

export function searchMovies(query, { page = 1, signal } = {}) {
  return request('/search/movie', { query, page, include_adult: false }, signal);
}

export function getMovieDetails(id) {
  return request(`/movie/${id}`, {
    append_to_response: 'videos',
    include_video_language: 'es,en',
  });
}

export function getTrending() {
  return request('/trending/movie/week');
}

export async function getGenres() {
  const data = await request('/genre/movie/list');
  return data.genres;
}