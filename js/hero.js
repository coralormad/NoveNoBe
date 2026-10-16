// Hero: presentación, novedades y avisos con transición de persiana.
const PERSIANA_MS = 560; // = 315 ms por lama + 7 × 35 ms de retraso (CSS)
const SVG_NS = 'http://www.w3.org/2000/svg';

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Cercanía a un borde: 1 pegado a él, 0 a partir de `zone` (fracción del ancho). */
export const proximity = (distance, zone = 0.3) => Math.max(0, 1 - distance / zone);

/** Crea una mirilla del índice. La usan el hero y el escaparate. */
export function createMirilla({ indice, etiqueta, imagen }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'mirilla';
  button.dataset.indice = indice;
  button.setAttribute('aria-label', etiqueta);

  const lente = document.createElement('span');
  lente.className = 'mirilla-lente';
  if (imagen) lente.style.backgroundImage = `url("${imagen}")`;

  const tapa = document.createElement('span');
  tapa.className = 'mirilla-tapa';

  button.append(lente, tapa);
  return button;
}

/** Dirección de un deslizamiento: 1 = siguiente, -1 = anterior, 0 = no cuenta. */
export function swipeDirection(dx, dy, min = 50) {
  if (Math.abs(dx) < min || Math.abs(dx) < Math.abs(dy)) return 0;
  return dx < 0 ? 1 : -1;
}

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

/** Convierte películas y avisos en datos de diapositiva (objetos planos, sin DOM). */
export function buildSlides({ estreno, proximo, avisos = [] }) {
  const fromMovie = (movie, etiqueta, nav) => movie && {
    tipo: 'pelicula',
    id: movie.id,
    nav,
    etiqueta,
    titulo: movie.title,
    texto: movie.overview,
    imagen: movie.backdropUrl,
    accion: 'Ver ficha',
    destino: 'ficha',
  };
  // Un aviso = una diapositiva con dos variantes; el CSS muestra la del tema activo
  const fromAviso = (aviso) => ({
    tipo: 'aviso',
    id: aviso.id,
    nav: 'Aviso',
    imagen: null,
    variantes: [
      { tema: 'dia', ...aviso.dia },
      { tema: 'noche', ...aviso.noche },
    ],
  });

  return [
    fromMovie(estreno, 'En cines esta semana', 'En cines'),
    fromMovie(proximo, `Próximo estreno · ${proximo?.releaseText ?? ''}`, 'Próximo estreno'),
    ...avisos.map(fromAviso),
  ].filter(Boolean);
}

// ---------- DOM ----------

/** Rellena un bloque de texto de diapositiva (textContent, sin innerHTML). */
function fillText(block, data) {
  block.querySelector('.diapositiva-etiqueta').textContent = data.etiqueta;
  block.querySelector('.diapositiva-titulo').textContent = data.titulo;
  block.querySelector('.diapositiva-desc').textContent = data.texto;
  const button = block.querySelector('.diapositiva-boton');
  button.textContent = data.accion;
  button.dataset.accion = data.destino;
  return button;
}

/** Clona la plantilla y la rellena según el tipo de diapositiva. */
export function createSlide(slide) {
  const node = document.querySelector('#plantilla-diapositiva').content.firstElementChild.cloneNode(true);
  node.classList.add(`diapositiva--${slide.tipo}`);
  node.dataset.nav = slide.nav;
  const text = node.querySelector('.diapositiva-texto');

  if (slide.tipo === 'pelicula') {
    const button = fillText(text, slide);
    button.dataset.id = slide.id;
    button.setAttribute('aria-label', `Ver ficha de ${slide.titulo}`);
  } else {
    const blocks = slide.variantes.map((variante) => {
      const block = text.cloneNode(true);
      block.classList.add(`solo-${variante.tema}`);
      fillText(block, variante);
      return block;
    });
    text.replaceWith(...blocks);
    const entrada = document.querySelector('#plantilla-entrada')?.content.firstElementChild;
    if (entrada) node.append(entrada.cloneNode(true));
  }

  const img = node.querySelector('.diapositiva-fondo');
  if (slide.imagen) img.src = slide.imagen;
  else img.remove();

  return node;
}

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

/** Fondo de la presentación: 3 estrenos difuminados que se funden en un degradado. */
export async function setAmbient(movies, container = document.querySelector('#concepto-ambiente')) {
  if (!container) return;
  const images = movies
    .filter((movie) => movie.backdropPath)
    .slice(0, 3)
    .map((movie) => {
      const img = new Image();
      img.alt = '';
      img.decoding = 'async';
      img.src = movie.backdropSmallUrl;
      return img;
    });
  if (images.length === 0) return;

  container.replaceChildren(...images);
  await Promise.allSettled(images.map((img) => img.decode()));
  container.classList.add('cargado');
}

// ---------- Clase ----------

export class HeroCarousel {
  #els;
  #slides = [];
  #index = 0;
  #busy = false;
  #onAction;
  #pointerX = 0;
  #frame = 0;
  #swipe = null;

  constructor(root, { onAction = () => {} } = {}) {
    this.#onAction = onAction;
    this.#els = {
      root,
      track: root.querySelector('#hero-diapositivas'),
      nav: root.querySelector('#hero-indice'),
      clock: root.querySelector('#hero-reloj'),
    };

    root.querySelector('#hero-anterior').addEventListener('click', () => this.go(this.#index - 1));
    root.querySelector('#hero-siguiente').addEventListener('click', () => this.go(this.#index + 1));
    this.#els.clock.addEventListener('animationend', () => this.go(this.#index + 1));

    this.#els.nav.addEventListener('click', (event) => {
      const button = event.target.closest('[data-indice]');
      if (button) this.go(Number(button.dataset.indice));
    });
    this.#els.track.addEventListener('click', (event) => {
      const button = event.target.closest('[data-accion]');
      if (button) this.#onAction(button);
    });

    root.addEventListener('pointermove', (event) => this.#trackPointer(event));
    root.addEventListener('pointerleave', () => this.#setProximity(0, 0));
    root.addEventListener('keydown', (event) => this.#handleKey(event));
    root.addEventListener('pointerdown', (event) => this.#startSwipe(event));
    root.addEventListener('pointerup', (event) => this.#endSwipe(event));
    this.#els.nav.addEventListener('pointerover', (event) => this.#showName(event.target));
    this.#els.nav.addEventListener('focusin', (event) => this.#showName(event.target));

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
    const next = (target + total) % total;
    if (this.#busy || total < 2 || next === this.#index) return;
    this.#busy = true;

    const ms = prefersReducedMotion() ? 0 : PERSIANA_MS;
    this.#els.root.dataset.persiana = 'cerrada';
    await wait(ms);

    this.#index = next;
    this.#render();

    delete this.#els.root.dataset.persiana;
    await wait(ms);
    this.#busy = false;
  }

  // Calcula la cercanía del cursor a cada borde, como mucho una vez por fotograma
  #trackPointer(event) {
    this.#pointerX = event.clientX;
    if (this.#frame) return;
    this.#frame = requestAnimationFrame(() => {
      this.#frame = 0;
      const { left, width } = this.#els.root.getBoundingClientRect();
      const x = (this.#pointerX - left) / width;
      this.#setProximity(proximity(x), proximity(1 - x));
    });
  }

  #setProximity(prev, next) {
    this.#els.root.style.setProperty('--prox-anterior', prev.toFixed(3));
    this.#els.root.style.setProperty('--prox-siguiente', next.toFixed(3));
  }

  #handleKey(event) {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (!step) return;
    event.preventDefault();
    this.go(this.#index + step);
  }

  #startSwipe(event) {
    if (event.pointerType === 'mouse') return;
    this.#swipe = { x: event.clientX, y: event.clientY };
  }

  #endSwipe(event) {
    if (!this.#swipe) return;
    const direction = swipeDirection(event.clientX - this.#swipe.x, event.clientY - this.#swipe.y);
    this.#swipe = null;
    if (direction) this.go(this.#index + direction);
  }

  #showName(target) {
    const button = target.closest('[data-indice]');
    if (button) this.#els.name.textContent = button.dataset.nombre;
  }

  #sync() {
    this.#slides = [...this.#els.track.children];
    const items = this.#slides.map((slide, i) => {
      const nombre = slide.dataset.nav ?? '';
      const button = createMirilla({
        indice: i,
        etiqueta: `Diapositiva ${i + 1}: ${nombre}`,
        imagen: slide.querySelector('.diapositiva-fondo')?.getAttribute('src'),
      });
      button.dataset.nombre = nombre; // el hero muestra el nombre al pasar el ratón
      return button;
    });

    const name = document.createElement('span');
    name.className = 'hero-indice-nombre';
    name.setAttribute('aria-hidden', 'true');
    this.#els.name = name;
    this.#els.nav.replaceChildren(...items, name);
    this.#render();
  }

  #render() {
    const total = this.#slides.length;
    this.#slides.forEach((slide, i) => {
      slide.hidden = i !== this.#index;
      slide.setAttribute('aria-label', `${i + 1} de ${total}`);
    });
    [...this.#els.nav.children].forEach((item, i) => {
        this.#els.nav.style.setProperty('--progreso', (this.#index + 1) / total);
        if (i === this.#index) item.setAttribute('aria-current', 'true');
      else item.removeAttribute('aria-current');
    });

    // Reinicia el temporizador invisible (animación CSS de 7 s)
    const { clock } = this.#els;
    clock.classList.remove('activo');
    void clock.offsetWidth;
    clock.classList.add('activo');
  }
}