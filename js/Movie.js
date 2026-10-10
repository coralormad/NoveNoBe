const IMG_BASE = 'https://image.tmdb.org/t/p/w342';

// Póster de reserva: un SVG embebido, sin archivo, así que nunca da 404
const NO_POSTER = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 3"><rect width="2" height="3" fill="#29202D"/></svg>'
)}`;

export class Movie {
  constructor(data) {
    this.id = data.id;
    this.title = data.title || 'Sin título';
    this.overview = data.overview || 'Sin descripción disponible.';
    this.releaseDate = data.release_date || '';
    this.rating = data.vote_average ?? 0;
    this.popularity = data.popularity ?? 0;
    this.posterPath = data.poster_path || null;
    this.genres = data.genres ?? [];
    this.genreIds = data.genre_ids ?? this.genres.map((g) => g.id);
    this.countries = data.production_countries ?? [];
  }

  // Convierte el array crudo de TMDB en un array de Movie
  static fromList(results = []) {
    return results.map((data) => new Movie(data));
  }

  get year() {
    return this.releaseDate ? this.releaseDate.slice(0, 4) : '—';
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