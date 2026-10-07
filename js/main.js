import { searchMovies, getMovieDetails } from './api.js';
import { Movie } from './Movie.js';

async function probar() {
  try {
    const data = await searchMovies('matrix');
    const movies = data.results.map((item) => new Movie(item));
    console.log('Películas:', movies);

    const detalle = new Movie(await getMovieDetails(movies[0].id));
    console.log('Título:', detalle.title, '·', detalle.year, '·', detalle.ratingText);
    console.log('Géneros:', detalle.genreNames);
    console.log('Países:', detalle.countryCodes);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

probar();


import { initScrollTheme } from './scrollTheme.js';

initScrollTheme();

