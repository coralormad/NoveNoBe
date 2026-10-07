import { searchMovies, getMovieDetails } from './api.js';

try {
  const data = await searchMovies('matrix');
  console.log(data.results);
  const detalle = await getMovieDetails(data.results[0].id);
  console.log(detalle.genres, detalle.production_countries);
} catch (error) {
  console.error(error);
}

import { initScrollTheme } from './scrollTheme.js';

initScrollTheme();

import { initBuscador } from './buscador.js';
initBuscador();