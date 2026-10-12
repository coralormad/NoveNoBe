// Estado del catálogo de Películas: qué lista, qué página y qué películas llevamos.
// Solo datos: no toca el DOM (eso es trabajo de main.js).
import { getMovieList } from './api.js';
import { Movie } from './Movie.js';
import { uniqueById } from './utils.js';

const MAX_PAGES = 500; // TMDB no sirve más allá de la página 500

export class MovieCatalog {
  #list = 'popular';
  #page = 0;
  #totalPages = 1;
  #movies = [];
  #controller = null;

  get list() { return this.#list; }
  get movies() { return [...this.#movies]; } // copia: desde fuera no se puede mutar el estado
  get hasMore() { return this.#page < this.#totalPages; }

  /** Empieza de cero con otra lista (popular, top_rated, now_playing, upcoming). */
  load(list) {
    this.#list = list;
    this.#page = 0;
    this.#totalPages = 1;
    this.#movies = [];
    return this.#fetchNextPage();
  }

  /** Añade la página siguiente a lo que ya hay. */
  loadMore() {
    return this.#fetchNextPage();
  }

  async #fetchNextPage() {
    this.#controller?.abort(); // si cambian de pestaña a mitad de carga, la petición vieja se cancela
    this.#controller = new AbortController();

    const data = await getMovieList(this.#list, { page: this.#page + 1, signal: this.#controller.signal });
    this.#page = data.page;
    this.#totalPages = Math.min(data.total_pages, MAX_PAGES);
    this.#movies = uniqueById([...this.#movies, ...Movie.fromList(data.results)]);
    return this.movies;
  }
}