import { ACCESS_TOKEN } from './config.js';

const BASE_URL = 'https://api.themoviedb.org/3';

// Helper privado (no se exporta): todas las peticiones pasan por aquí
async function request(endpoint, params = {}) {
  const url = new URL(`${BASE_URL}${endpoint}`);
  url.search = new URLSearchParams({ language: 'es-ES', ...params });

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      accept: 'application/json',
    },
  });

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