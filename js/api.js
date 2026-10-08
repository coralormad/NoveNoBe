import { TMDB_API_KEY, TMDB_BASE_URL } from './config.js';

// Helper privado: todas las peticiones pasan por aquí
async function request(endpoint, params = {}) {
  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);

  url.search = new URLSearchParams({
    api_key: TMDB_API_KEY,
    language: 'es-ES',
    ...params,
  });

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`TMDB ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

export function searchMovies(query, page = 1) {
  return request('/search/movie', { query, page });
}

export function getMovieDetails(id) {
  return request(`/movie/${id}`);
}