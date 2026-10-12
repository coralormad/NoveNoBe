// Escaparate: las películas más populares del género elegido, en abanico 3D.
// Flechas del hero en los laterales (aparecen al acercar el cursor) y deslizar en táctil.
import { movieHref } from './router.js';
import { proximity } from './hero.js';

const MAX = 5;
const SWIPE_MIN = 40; // px que hay que deslizar para cambiar de película
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');

export class GenreStage {
  #els;
  #movies = [];
  #activa = 0;
  #nombrar = () => '';
  #frame = 0;
  #pointerX = 0;
  #swipe = null;

  /** @param {{marco, lista, titulo, generos, anterior, siguiente}} els */
  constructor(els) {
    this.#els = els;
    els.lista.addEventListener('click', (event) => this.#onClick(event));
    els.lista.addEventListener('keydown', (event) => this.#onKeydown(event));
    els.anterior.addEventListener('click', () => this.step(-1));
    els.siguiente.addEventListener('click', () => this.step(1));
    els.marco.addEventListener('pointermove', (event) => this.#trackPointer(event));
    els.marco.addEventListener('pointerleave', () => this.#setProximity(0, 0));
    els.marco.addEventListener('pointerdown', (event) => this.#startSwipe(event));
    els.marco.addEventListener('pointerup', (event) => this.#endSwipe(event));
  }

  /**
   * Pinta las películas (ya ordenadas) y activa la primera.
   * @param {Function} nombrar ids de géneros → texto («Drama · Crimen»)
   */
  render(movies, nombrar = () => '') {
    this.#movies = movies.slice(0, MAX);
    this.#nombrar = nombrar;
    this.#activa = 0;
    this.#els.lista.replaceChildren(...this.#movies.map((movie, i) => GenreStage.#crear(movie, i)));
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
    enlace.setAttribute('aria-label', movie.title);

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

  /** Coloca cada carátula según su distancia a la activa y sincroniza flechas y título. */
  #colocar() {
    const { lista, generos, anterior, siguiente } = this.#els;
    [...lista.children].forEach((item, i) => {
      const pos = i - this.#activa;
      item.style.setProperty('--pos', pos);
      item.style.setProperty('--dist', Math.abs(pos));
      item.classList.toggle('activa', pos === 0);
      item.querySelector('a').tabIndex = pos === 0 ? 0 : -1; // tabulación itinerante
    });
    // En los extremos, la flecha que no lleva a ninguna parte se oculta
    anterior.disabled = this.#activa === 0;
    siguiente.disabled = this.#activa >= this.#movies.length - 1;

    const movie = this.#movies[this.#activa];
    this.#mostrarTitulo(movie ? movie.title : 'Ninguna película de este género por ahora.');
    generos.textContent = movie ? this.#nombrar(movie.genreIds) : '';
  }

  /** Cambia el título con un fundido breve (solo si cambia y sin movimiento reducido). */
  #mostrarTitulo(texto) {
    const { titulo } = this.#els;
    if (titulo.textContent === texto) return;
    titulo.textContent = texto;
    if (REDUCED_MOTION.matches) return;
    titulo.animate(
      [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
      { duration: 260, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
    );
  }

  #onClick(event) {
    const item = event.target.closest('.escaparate-item');
    if (!item || item.classList.contains('activa')) return; // la activa sigue su enlace a la ficha
    event.preventDefault();
    this.activate(Number(item.dataset.indice));
  }

  #onKeydown(event) {
    const delta = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (!delta) return;
    event.preventDefault();
    this.step(delta);
    this.#els.lista.children[this.#activa]?.querySelector('a').focus();
  }

  /** Cercanía del cursor a cada lateral, como mucho una vez por fotograma (igual que el hero). */
  #trackPointer(event) {
    if (event.pointerType !== 'mouse') return;
    this.#pointerX = event.clientX;
    if (this.#frame) return;
    this.#frame = requestAnimationFrame(() => {
      this.#frame = 0;
      const { left, width } = this.#els.marco.getBoundingClientRect();
      const x = (this.#pointerX - left) / width;
      this.#setProximity(proximity(x), proximity(1 - x));
    });
  }

  #setProximity(prev, next) {
    this.#els.marco.style.setProperty('--prox-anterior', prev.toFixed(3));
    this.#els.marco.style.setProperty('--prox-siguiente', next.toFixed(3));
  }

  #startSwipe(event) {
    if (event.pointerType === 'mouse') return;
    this.#swipe = { x: event.clientX, y: event.clientY };
  }

  /** Deslizar en horizontal cambia de película; en vertical se deja hacer scroll. */
  #endSwipe(event) {
    if (!this.#swipe) return;
    const dx = event.clientX - this.#swipe.x;
    const dy = event.clientY - this.#swipe.y;
    this.#swipe = null;
    if (Math.abs(dx) > SWIPE_MIN && Math.abs(dx) > Math.abs(dy)) this.step(dx < 0 ? 1 : -1);
  }
}