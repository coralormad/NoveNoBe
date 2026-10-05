import { API_KEY } from './config.js';

const BASE_URL = '____';   // pista: https://api.themoviedb.org/3
const LANGUAGE = 'es-ES';

async function request(endpoint, params = {}) {
  const url = new URL(`${BASE_URL}${____}`);
  url.search = new URLSearchParams({
    api_key: API_KEY,
    language: LANGUAGE,
    ____            // pista: copia aquí los params recibidos
  }).toString();

  const response = await fetch(____);
  if (!____) {
    throw new Error(`Error ${response.status} al llamar a TMDB`);
  }
  return ____;      // pista: leer el JSON también es asíncrono
}

export function searchMovies(query) {
  return request(____, { ____ });
}

export function getMovieDetails(id) {
  return request(____);
}