// Hero: presentación, novedades y avisos con transición de persiana.
const PERSIANA_MS = 560; // debe coincidir con la duración de las lamas en CSS (paso 4)

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const pad = (n) => String(n).padStart(2, '0');

// ---------- Funciones puras ----------

/**
 * Elige la película en cines y el próximo estreno (ambas con imagen panorámica).
 * @param {{nowPlaying: Movie[], upcoming: Movie[], today: Date}} datos
 * @returns {{estreno?: Movie, proximo?: Movie}}
 */
export function pickHeroMovies({ nowPlaying = [], upcoming = [], today }) {
  const withImage = (movies) => movies.filter((movie) => movie.backdropPath);
  const estreno = withImage(nowPlaying)[0];
  const proximo = withImage(upcoming).find(
    (movie) => movie.id !== estreno?.id && new Date(`${movie.releaseDate}T00:00`) > today
  );
  return { estreno, proximo };
}

/**
 * Convierte películas y avisos en datos de diapositiva (objetos planos, sin DOM).
 * @returns {Array<{tipo: string, id: (number|string), etiqueta: string, titulo: string, texto: string, imagen: (string|null), accion: string}>}
 */
export function buildSlides({ estreno, proximo, avisos = [] }) {
  const fromMovie = (movie, etiqueta) => movie && {
    tipo: 'pelicula',
    id: movie.id,
    etiqueta,
    titulo: movie.title,
    texto: movie.overview,
    imagen: movie.backdropUrl,
    accion: 'Ver ficha',
  };
  const fromAviso = (aviso) => ({
    tipo: 'aviso',
    id: aviso.id,
    etiqueta: aviso.etiqueta,
    titulo: aviso.titulo,
    texto: aviso.texto,
    imagen: null,
    accion: aviso.accion,
  });

  return [
    fromMovie(estreno, 'En cines esta semana'),
    fromMovie(proximo, `Próximo estreno · ${proximo?.releaseText ?? ''}`),
    ...avisos.map(fromAviso),
  ].filter(Boolean);
}

// ---------- DOM ----------

/** Clona la plantilla y la rellena con textContent (sin innerHTML). */
export function createSlide(slide) {
  const node = document.querySelector('#plantilla-diapositiva').content.firstElementChild.cloneNode(true);
  node.classList.add(`diapositiva--${slide.tipo}`);
  node.querySelector('.diapositiva-etiqueta').textContent = slide.etiqueta;
  node.querySelector('.diapositiva-titulo').textContent = slide.titulo;
  node.querySelector('.diapositiva-desc').textContent = slide.texto;

  const button = node.querySelector('.diapositiva-boton');
  button.textContent = slide.accion;
  button.dataset.accion = slide.tipo === 'pelicula' ? 'ficha' : 'aviso';
  button.dataset.id = slide.id;
  if (slide.tipo === 'pelicula') button.setAttribute('aria-label', `Ver ficha de ${slide.titulo}`);

  const img = node.querySelector('.diapositiva-fondo');
  if (slide.imagen) img.src = slide.imagen;
  else img.remove();

  return node;
}

// ---------- Clase ----------

export class HeroCarousel {
  #els;
  #slides = [];
  #index = 0;
  #busy = false;
  #onAction;

  constructor(root, { onAction = () => {} } = {}) {
    this.#onAction = onAction;
    this.#els = {
      root,
      track: root.querySelector('#hero-diapositivas'),
      progress: root.querySelector('#hero-progreso'),
      counter: root.querySelector('#hero-contador'),
      pause: root.querySelector('#hero-pausa'),
    };

    root.querySelector('#hero-anterior').addEventListener('click', () => this.go(this.#index - 1));
    root.querySelector('#hero-siguiente').addEventListener('click', () => this.go(this.#index + 1));
    this.#els.pause.addEventListener('click', () => this.togglePause());
    this.#els.progress.addEventListener('animationend', () => this.go(this.#index + 1));
    this.#els.track.addEventListener('click', (event) => {
      const button = event.target.closest('[data-accion]');
      if (button) this.#onAction(button);
    });

    this.#sync();
  }

  /** Añade diapositivas nuevas (las que llegan de la API) detrás de la presentación. */
  addSlides(nodes) {
    this.#els.track.append(...nodes);
    this.#sync();
  }

  /** Cambia de diapositiva: cierra la persiana, intercambia y la abre. */
  async go(target) {
    const total = this.#slides.length;
    if (this.#busy || total < 2) return;
    this.#busy = true;

    const ms = prefersReducedMotion() ? 0 : PERSIANA_MS;
    this.#els.root.dataset.persiana = 'cerrada';
    await wait(ms);

    this.#index = (target + total) % total;
    this.#render();

    delete this.#els.root.dataset.persiana;
    await wait(ms);
    this.#busy = false;
  }

  togglePause() {
    const paused = this.#els.pause.getAttribute('aria-pressed') !== 'true';
    this.#els.pause.setAttribute('aria-pressed', String(paused));
    this.#els.pause.setAttribute('aria-label', paused ? 'Reanudar el carrusel' : 'Pausar el carrusel');
    this.#els.root.toggleAttribute('data-pausado', paused);
    this.#els.track.setAttribute('aria-live', paused ? 'polite' : 'off');
  }

  #sync() {
    this.#slides = [...this.#els.track.children];
    this.#els.progress.replaceChildren(...this.#slides.map(() => document.createElement('span')));
    this.#render();
  }

  #render() {
    const total = this.#slides.length;
    this.#slides.forEach((slide, i) => {
      slide.hidden = i !== this.#index;
      slide.setAttribute('aria-label', `${i + 1} de ${total}`);
    });
    this.#els.counter.textContent = `${pad(this.#index + 1)} / ${pad(total)}`;

    [...this.#els.progress.children].forEach((bar, i) => {
      bar.classList.remove('activa');
      if (i === this.#index) {
        void bar.offsetWidth; // fuerza un reflow para reiniciar la animación CSS
        bar.classList.add('activa');
      }
    });
  }
}

// ---------- Emblema del 9ºB ----------
const SVG_NS = 'http://www.w3.org/2000/svg';

/** Coloca hasta 12 pósters en rejilla 4×3 dentro del 9 (recortados por el clipPath). */
export function fillEmblem(movies, container = document.querySelector('#emblema-posters')) {
  if (!container) return;
  const COLS = 4;
  const W = 75;
  const H = 112;

  const images = movies
    .filter((movie) => movie.posterPath)
    .slice(0, 12)
    .map((movie, i) => {
      const image = document.createElementNS(SVG_NS, 'image');
      image.setAttribute('href', movie.posterUrl);
      image.setAttribute('x', (i % COLS) * W);
      image.setAttribute('y', Math.floor(i / COLS) * H);
      image.setAttribute('width', W);
      image.setAttribute('height', H);
      image.setAttribute('preserveAspectRatio', 'xMidYMid slice');
      return image;
    });

  container.replaceChildren(...images);
}

/** Usa el backdrop de la primera película con imagen como fondo ambiental difuminado. */
export function setAmbient(movies, img = document.querySelector('#concepto-ambiente')) {
  const movie = movies.find((item) => item.backdropPath);
  if (!img || !movie) return;
  img.addEventListener('load', () => img.classList.add('cargado'), { once: true });
  img.src = movie.backdropUrl;
}