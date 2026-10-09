import { ACCESS_TOKEN, TMDB_BASE_URL } from './config.js';

const DEFAULT_LANGUAGE = 'es-ES';

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

  if (!response.ok) {
    throw new Error(`TMDB ${response.status}: ${response.statusText}`);
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