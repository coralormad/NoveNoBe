import { API_KEY } from './config.js';

const BASE_URL = 'https://api.themoviedb.org/3';  
const LANGUAGE = 'es-ES';

async function request(endpoint, params = {}) {
  const url = new URL(`${BASE_URL}${endpoint}`);
  url.search = new URLSearchParams({
    api_key: API_KEY,
    language: LANGUAGE,
    ...params
  }).toString();

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Error ${response.status} al llamar a TMDB`);
  }
  return response.json();      // pista: leer el JSON también es asíncrono
}

export function searchMovies(query) {
  return request('search/movie', { query });
}

export function getMovieDetails(id) {
  return request(`movie/${id}`);
}