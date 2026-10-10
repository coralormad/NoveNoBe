const IMG_BASE = 'https://image.tmdb.org/t/p/w342';

export class Movie {
  constructor(data) {
    this.id = data.id;
    this.title = data.title || 'Sin título';
    this.overview = data.overview || 'Sin descripción disponible.';
    this.releaseDate = data.release_date || '';
    this.rating = data.vote_average ?? 0;
    this.popularity = data.popularity ?? 0;
    this.posterPath = data.poster_path || null;
    this.adult = data.adult ?? false;
    this.genres = data.genres || [];
    this.countries = data.production_countries || [];
  }

  get year() {
    return this.releaseDate ? this.releaseDate.slice(0, 4) : '—';
  }

  get posterUrl() {
    return this.posterPath ? `${IMG_BASE}${this.posterPath}` : 'img/sin-poster.png';
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
