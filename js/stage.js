// Escaparate: las películas más populares del género elegido, en abanico 3D.
// Flechas del hero en los laterales (aparecen al acercar el cursor) y deslizar en táctil.
import { movieHref } from './router.js';
import { proximity } from './hero.js';
import { tiltFromPointer } from './tilt.js';

const MAX = 5;
const SWIPE_MIN = 40; // px que hay que deslizar para cambiar de película
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');
const ALCANCE_LUZ = 1.1; // en anchos de carátula: más allá, la luz no llega

/**
 * Pura: luz de una carátula (0…1) según la distancia horizontal del cursor a su centro.
 * Curva cuadrática: la que está bajo el cursor manda y las vecinas reciben solo un eco.
 */
export function cardLight(pointerX, rect, alcance = ALCANCE_LUZ) {
  const distancia = Math.abs(pointerX - (rect.left + rect.width / 2)) / rect.width;
  return Math.max(0, 1 - distancia / alcance) ** 2;
}

export class GenreStage {
  #els;
  #movies = [];
  #activa = 0;
  #nombrar = () => '';
  #frame = 0;
  #pointerX = 0;
  #pointerY = 0;
  #dentro = false; // ¿hay un ratón dentro del carrusel?
  #swipe = null;

  /** @param {{marco, lista, titulo, generos, anterior, siguiente}} els */
  constructor(els) {
    this.#els = els;
    els.lista.addEventListener('click', (event) => this.#onClick(event));
    els.lista.addEventListener('keydown', (event) => this.#onKeydown(event));
    els.anterior.addEventListener('click', () => this.step(-1));
    els.siguiente.addEventListener('click', () => this.step(1));
    els.marco.addEventListener('pointermove', (event) => this.#trackPointer(event));
    els.marco.addEventListener('pointerleave', () => {
      this.#dentro = false;
      this.#setProximity(0, 0);
      this.#apagar();
    });
    // Tras moverse el abanico (flechas, teclado, clic), la luz se recoloca donde está el cursor
    els.lista.addEventListener('transitionend', (event) => {
      if (event.propertyName === 'transform' && this.#dentro) this.#pedirFotograma();
    });
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
    if (event.pointerType !== 'mouse') return; // en táctil no hay cursor: ninguna carátula se queda iluminada
    this.#pointerX = event.clientX;
    this.#pointerY = event.clientY;
    this.#dentro = true;
    this.#pedirFotograma();
  }

  /** Como mucho un cálculo por fotograma, por mucho que se mueva el ratón. */
  #pedirFotograma() {
    if (this.#frame) return;
    this.#frame = requestAnimationFrame(() => {
      this.#frame = 0;
      if (!this.#dentro) return; // el ratón salió antes de este fotograma
      const { left, width } = this.#els.marco.getBoundingClientRect();
      const x = (this.#pointerX - left) / width;
      this.#setProximity(proximity(x), proximity(1 - x));
      this.#iluminar();
    });
  }

  /** Reparte la luz: --luz en cada carátula y el foco (--foco, --mx, --my) solo en la protagonista. */
  #iluminar() {
    const items = [...this.#els.lista.children];
    // Primero se mide todo y después se escribe: mezclar lecturas y escrituras obliga a recalcular el layout
    const rects = items.map((item) => item.getBoundingClientRect());
    const luces = rects.map((rect) => cardLight(this.#pointerX, rect));
    const protagonista = luces.indexOf(Math.max(...luces));

    items.forEach((item, i) => {
      item.style.setProperty('--luz', luces[i].toFixed(2));
      const esProtagonista = i === protagonista && luces[i] > 0;
      item.style.setProperty('--foco', esProtagonista ? '1' : '0');
      if (esProtagonista) {
        const { mx, my } = tiltFromPointer(this.#pointerX, this.#pointerY, rects[i]);
        item.style.setProperty('--mx', `${mx.toFixed(1)}%`);
        item.style.setProperty('--my', `${my.toFixed(1)}%`);
      }
    });
  }

  /** Sin cursor: vuelta al estado original (las transiciones del CSS hacen el fundido). */
  #apagar() {
    for (const item of this.#els.lista.children) {
      item.style.removeProperty('--luz');
      item.style.removeProperty('--foco'); // --mx/--my se quedan: el foco se apaga en su sitio, sin saltar
    }
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