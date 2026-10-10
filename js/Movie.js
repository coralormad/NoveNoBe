const IMG_BASE = 'https://image.tmdb.org/t/p/w342';
const NO_POSTER = 'img/sin-poster.svg';

/** Modelo de película: convierte el JSON crudo de TMDB en un objeto limpio e inmutable. */
export class Movie {
  /** @param {object} data - Película tal como llega de TMDB (búsqueda o detalle). */
  constructor(data) {
    this.id = data.id;
    this.title = data.title || 'Sin título';
    this.overview = data.overview || 'Sin descripción disponible.';
    this.releaseDate = data.release_date || '';
    this.rating = data.vote_average ?? 0;
    this.popularity = data.popularity ?? 0;
    this.posterPath = data.poster_path || null;
    this.adult = data.adult ?? false;
    this.genreIds = data.genre_ids ?? data.genres?.map((g) => g.id) ?? [];
    this.genres = data.genres ?? [];
    this.countries = data.production_countries ?? [];
    Object.freeze(this);
  }

  /** Año como número (para filtrar) o null si no hay fecha. */
  get year() {
    return Number(this.releaseDate.slice(0, 4)) || null;
  }

  /** Año listo para mostrar en pantalla. */
  get yearText() {
    return this.year ?? '—';
  }

  get posterUrl() {
    return this.posterPath ? `${IMG_BASE}${this.posterPath}` : NO_POSTER;
  }

  get ratingText() {
    return this.rating.toFixed(1);
  }

  get genreNames() {
    return this.genres.map((g) => g.name);
  }

  get countryCodes() {
    return this.countries.map((c) => c.iso_3166_1);
  }
}