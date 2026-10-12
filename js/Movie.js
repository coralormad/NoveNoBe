const IMG_BASE = 'https://image.tmdb.org/t/p/w342';
const BACKDROP_BASE = 'https://image.tmdb.org/t/p/w1280';
const BACKDROP_SMALL = 'https://image.tmdb.org/t/p/w300';
// Se crea una vez y se reutiliza: construir un Intl.NumberFormat es caro
const VOTES_FORMAT = new Intl.NumberFormat('es', { notation: 'compact', maximumFractionDigits: 1 });

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
    this.imdbId = data.imdb_id ?? null; // para Bechdel (busca por imdbid); solo llega en los detalles
    this.rating = data.vote_average ?? 0;
    this.popularity = data.popularity ?? 0;
    this.posterPath = data.poster_path || null;
    this.backdropPath = data.backdrop_path || null;
    this.genres = data.genres ?? [];
    this.genreIds = data.genre_ids ?? this.genres.map((g) => g.id);
    this.countries = data.production_countries ?? [];
    this.runtime = data.runtime ?? null; // solo llega en getMovieDetails
    this.originalTitle = data.original_title || this.title;
    this.tagline = data.tagline || '';
    this.voteCount = data.vote_count ?? 0;
    // Solo llegan con getMovieDetails (append_to_response); en las listas quedan vacíos
    this.credits = { cast: data.credits?.cast ?? [], crew: data.credits?.crew ?? [] };
    this.releaseDates = data.release_dates?.results ?? [];
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

  get backdropUrl() {
    return this.backdropPath ? `${BACKDROP_BASE}${this.backdropPath}` : null;
  }

  get backdropSmallUrl() {
    return this.backdropPath ? `${BACKDROP_SMALL}${this.backdropPath}` : null;
  }

  get releaseText() {
    if (!this.releaseDate) return '';
    return new Date(`${this.releaseDate}T00:00`)
      .toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  }

  get ratingText() {
    return this.rating.toFixed(1);
  }

    get runtimeText() {
    if (!this.runtime) return '';
    const h = Math.floor(this.runtime / 60);
    const m = this.runtime % 60;
    return h ? `${h} h ${m} min` : `${m} min`;
  }

  get genreNames() {
    return this.genres.map((g) => g.name);
  }

  get countryCodes() {
    return this.countries.map((c) => c.iso_3166_1);
  }

    get hasOriginalTitle() {
    return this.originalTitle !== this.title;
  }

  get votesText() {
    return this.voteCount === 1 ? '1 voto' : `${VOTES_FORMAT.format(this.voteCount)} votos`;
  }
}