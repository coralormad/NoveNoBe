// Escaparate: las películas más populares del género elegido, en abanico 3D.
// Solo se ocupa del DOM y de qué película está activa; los datos llegan filtrados desde main.js.
import { movieHref } from './router.js';

const MAX = 5;

export class GenreStage {
  #lista;
  #info;
  #movies = [];
  #activa = 0;

  constructor(lista, info) {
    this.#lista = lista;
    this.#info = info;
    lista.addEventListener('click', (event) => this.#onClick(event));
    lista.addEventListener('keydown', (event) => this.#onKeydown(event));
  }

  /** Pinta las películas (ya ordenadas) y activa la primera. */
  render(movies) {
    this.#movies = movies.slice(0, MAX);
    this.#activa = 0;
    this.#lista.replaceChildren(...this.#movies.map((movie, i) => GenreStage.#crear(movie, i)));
    this.#colocar();
  }

  /** Activa la película i, sin salirse de los límites. */
  activate(i) {
    if (this.#movies.length === 0) return;
    this.#activa = Math.min(Math.max(i, 0), this.#movies.length - 1);
    this.#colocar();
  }

  step(delta) {
    this.activate(this.#activa + delta);
  }

  static #crear(movie, i) {
    const item = document.createElement('li');
    item.className = 'escaparate-item';
    item.dataset.indice = i;

    const enlace = document.createElement('a');
    enlace.className = 'caratula';
    enlace.href = movieHref(movie.id);
    enlace.setAttribute('aria-label', `${movie.title}, ${movie.year}`);

    const img = document.createElement('img');
    img.className = 'caratula-img';
    img.src = movie.posterUrl;
    img.alt = '';
    img.width = 342;
    img.height = 513;
    img.decoding = 'async';

    enlace.append(img);
    item.append(enlace);
    return item;
  }

  /** Coloca cada tarjeta según su distancia a la activa y actualiza el texto. */
  #colocar() {
    [...this.#lista.children].forEach((item, i) => {
      const pos = i - this.#activa;
      item.style.setProperty('--pos', pos);
      item.style.setProperty('--dist', Math.abs(pos));
      item.classList.toggle('activa', pos === 0);
      // Tabulación itinerante: solo la activa entra en el orden del tabulador
      item.querySelector('a').tabIndex = pos === 0 ? 0 : -1;
    });
    const movie = this.#movies[this.#activa];
    this.#info.textContent = movie
      ? `${movie.title} · ${movie.year} · ★ ${movie.ratingText}`
      : 'Ninguna película de este género por ahora.';
  }

  #onClick(event) {
    const item = event.target.closest('.escaparate-item');
    if (!item || item.classList.contains('activa')) return; // la activa sigue su enlace a la ficha
    event.preventDefault(); // una vecina no navega: primero pasa al frente
    this.activate(Number(item.dataset.indice));
  }

  #onKeydown(event) {
    const delta = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (!delta) return;
    event.preventDefault();
    this.step(delta);
    this.#lista.children[this.#activa]?.querySelector('a').focus();
  }
}