// «Qué ver» · Observatorio cinematográfico.
// Cuatro preguntas (una por plano), cada respuesta enciende una ventana de enfrente y,
// al final, las recomendaciones se revelan enfocándose. La lógica vive en recomendador.js (pura).
import { DIMENSIONES, recomendar, explicar } from './recomendador.js';
import { loadFavorites, saveFavorites, toggleFavorite } from './storage.js';
import { getMovieDetails } from './api.js';
import { Movie } from './Movie.js';
import { movieHref } from './router.js';
import { peliculas } from '../data/movies.js';

const VENTANAS = 12;
const ORDEN_LUCES = [5, 2, 10, 7]; // qué ventana se enciende con cada respuesta (no en fila: como un edificio de verdad)
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');

const GRUPOS = Object.freeze([
  { clave: 'mira', titulo: 'En tu punto de mira' },
  { clave: 'ventana', titulo: 'Detrás de la ventana' },
  { clave: 'noBuscabas', titulo: 'Lo que no estabas buscando' },
]);

export class QueVer {
  #els;
  #paso = 0;
  #respuestas = {};
  #favoritas = loadFavorites();
  #posters = new Map(); // tmdbId → URL del póster (caché: cada póster se pide una sola vez)

  constructor(raiz) {
    const $ = (selector) => raiz.querySelector(selector);
    this.#els = {
      seccion: $('.que-ver'), // aquí vive --enfoque (lo leen la fachada y la rendija)
      fachada: $('#que-ver-fachada'),
      form: $('#que-ver-form'),
      progreso: $('#que-ver-progreso'),
      pregunta: $('#que-ver-pregunta'),
      aviso: $('#que-ver-aviso'),
      atras: $('#que-ver-atras'),
      siguiente: $('#que-ver-siguiente'),
      resultados: $('#que-ver-resultados'),
      hallazgos: $('#que-ver-hallazgos'),
      categorias: $('#que-ver-categorias'),
      reiniciar: $('#que-ver-reiniciar'),
    };
    this.#crearFachada();

    // Listeners una sola vez: la vista se crea una vez y solo se repinta su contenido
    const { form, pregunta, atras, categorias, reiniciar } = this.#els;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.#avanzar();
    });
    pregunta.addEventListener('change', (event) => this.#responder(event.target.value));
    atras.addEventListener('click', () => this.#irA(this.#paso - 1));
    categorias.addEventListener('click', (event) => this.#onFavorita(event));
    reiniciar.addEventListener('click', () => this.#reiniciar());

    this.#pintarPregunta();
  }

  // ---------- Preguntas ----------

  #pintarPregunta() {
    const { clave, titulo, subtitulo, opciones } = DIMENSIONES[this.#paso];
    const leyenda = document.createElement('legend');
    leyenda.className = 'qv-pregunta-titulo';
    leyenda.textContent = titulo;

    const contexto = document.createElement('p');
    contexto.className = 'qv-pregunta-subtitulo';
    contexto.id = 'que-ver-subtitulo';
    contexto.textContent = subtitulo;
    this.#els.pregunta.setAttribute('aria-describedby', contexto.id); // el lector lo lee junto a la pregunta

    const lista = document.createElement('div');
    lista.className = 'qv-opciones';
    lista.append(...opciones.map((opcion) => this.#crearOpcion(clave, opcion)));

    this.#els.pregunta.replaceChildren(leyenda, contexto, lista);
    this.#els.progreso.textContent = `Plano ${this.#paso + 1} de ${DIMENSIONES.length}`;
    this.#els.atras.hidden = this.#paso === 0;
    this.#els.siguiente.textContent = this.#paso === DIMENSIONES.length - 1 ? 'Revelar' : 'Siguiente';
    this.#els.aviso.textContent = '';
    this.#sincronizarLuz();
  }

  /** Un radio dentro de su <label>: teclado y lectores de pantalla funcionan sin código extra. */
  #crearOpcion(clave, { valor, etiqueta, pista }) {
    const label = document.createElement('label');
    label.className = 'qv-opcion';

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = `qv-${clave}`;
    radio.value = valor;
    radio.className = 'qv-radio';
    radio.checked = this.#respuestas[clave] === valor; // al volver atrás, la respuesta sigue ahí

    const nombre = document.createElement('span');
    nombre.className = 'qv-opcion-etiqueta';
    nombre.textContent = etiqueta;

    const detalle = document.createElement('span');
    detalle.className = 'qv-opcion-pista';
    detalle.textContent = pista;

    label.append(radio, nombre, detalle);
    return label;
  }

  #responder(valor) {
    const { clave } = DIMENSIONES[this.#paso];
    this.#respuestas = { ...this.#respuestas, [clave]: valor }; // objeto nuevo: no se muta el anterior
    this.#els.aviso.textContent = '';
    this.#sincronizarLuz();
  }

  #avanzar() {
    const { clave } = DIMENSIONES[this.#paso];
    if (!this.#respuestas[clave]) {
      this.#els.aviso.textContent = 'Elige una opción para seguir mirando.';
      this.#els.pregunta.querySelector('input')?.focus();
      return;
    }
    if (this.#paso < DIMENSIONES.length - 1) this.#irA(this.#paso + 1);
    else this.#revelar();
  }

  /** Cambio de plano: la escena se desenfoca, cambia y vuelve a enfocarse. */
  async #irA(paso) {
    if (paso < 0 || paso >= DIMENSIONES.length) return;
    await this.#animar(this.#els.pregunta, [{ opacity: 1, filter: 'blur(0)' }, { opacity: 0, filter: 'blur(6px)' }], 180);
    this.#paso = paso;
    this.#pintarPregunta();
    this.#animar(this.#els.pregunta, [{ opacity: 0, filter: 'blur(6px)' }, { opacity: 1, filter: 'blur(0)' }], 320);
    // El foco va a la respuesta elegida o a la primera opción (nunca se pierde al cambiar de plano)
    const pregunta = this.#els.pregunta;
    (pregunta.querySelector('input:checked') ?? pregunta.querySelector('input'))?.focus();
  }

  // ---------- Luz: ventanas encendidas y enfoque ----------

  #crearFachada() {
    const ventanas = Array.from({ length: VENTANAS }, () => {
      const ventana = document.createElement('span');
      ventana.className = 'qv-ventana';
      return ventana;
    });
    this.#els.fachada.replaceChildren(...ventanas);
  }

  /** Cada respuesta enciende una ventana y enfoca un poco más la escena (--enfoque de 0 a 1). */
  #sincronizarLuz(todo = false) {
    const respondidas = todo ? DIMENSIONES.length : Object.keys(this.#respuestas).length;
    const encendidas = new Set(ORDEN_LUCES.slice(0, respondidas));
    [...this.#els.fachada.children].forEach((ventana, i) =>
      ventana.classList.toggle('encendida', todo || encendidas.has(i)));
    this.#els.seccion.style.setProperty('--enfoque', (respondidas / DIMENSIONES.length).toFixed(2));
  }

  // ---------- Resultados ----------

  #revelar() {
    const recomendacion = recomendar(peliculas, this.#respuestas, this.#favoritas);
    this.#els.form.hidden = true;
    this.#els.resultados.hidden = false;
    this.#sincronizarLuz(true);
    this.#pintarResultados(recomendacion);
    this.#els.hallazgos.focus(); // el lector de pantalla empieza por el título de los resultados
  }

  #pintarResultados(recomendacion) {
    let orden = 0; // para escalonar la revelación
    const grupos = GRUPOS.map(({ clave, titulo }) => {
      const items = [recomendacion[clave]].flat().filter(Boolean);
      const grupo = document.createElement('section');
      grupo.className = `qv-grupo qv-grupo--${clave}`;
      const h4 = document.createElement('h4');
      h4.className = 'qv-grupo-titulo';
      h4.textContent = titulo;
      grupo.append(h4);

      if (items.length === 0) {
        const vacio = document.createElement('p');
        vacio.className = 'qv-grupo-vacio';
        vacio.textContent = clave === 'noBuscabas'
          ? 'Esta vez nada fuera de tu atmósfera encaja con el resto de tus respuestas.'
          : 'No hay más títulos que encajen con esta mirada.';
        grupo.append(vacio);
        return grupo;
      }
      grupo.append(...items.map((item) => this.#crearHallazgo(item, orden++)));
      return grupo;
    });
    this.#els.categorias.replaceChildren(...grupos);
  }

  #crearHallazgo(item, orden) {
    const { pelicula } = item;
    const tarjeta = document.createElement('article');
    tarjeta.className = 'qv-hallazgo';
    tarjeta.style.setProperty('--orden', orden);

    const cartel = document.createElement('div');
    cartel.className = 'qv-cartel';
    // Cartela tipográfica mientras llega el póster (o si no hay red): nunca una imagen ajena
    const cartela = document.createElement('span');
    cartela.className = 'qv-cartela';
    cartela.textContent = pelicula.titulo;
    cartel.append(cartela);
    this.#cargarPoster(pelicula, cartel);

    const cuerpo = document.createElement('div');
    cuerpo.className = 'qv-hallazgo-cuerpo';

    const titulo = document.createElement('h5');
    titulo.className = 'qv-hallazgo-titulo';
    if (pelicula.tmdbId) {
      const enlace = document.createElement('a');
      enlace.href = movieHref(pelicula.tmdbId); // conecta con la ficha que ya existe
      enlace.textContent = pelicula.titulo;
      titulo.append(enlace);
    } else {
      titulo.textContent = pelicula.titulo;
    }

    const meta = document.createElement('p');
    meta.className = 'qv-meta';
    meta.textContent = `${pelicula.anio} · ${pelicula.genero}${pelicula.tipo === 'series' ? ' · Serie' : ''}`;

    const sinopsis = document.createElement('p');
    sinopsis.className = 'qv-sinopsis';
    sinopsis.textContent = pelicula.sinopsis;

    const motivo = document.createElement('p');
    motivo.className = 'qv-motivo';
    motivo.textContent = explicar(item);

    cuerpo.append(titulo, meta, sinopsis, motivo);
    if (pelicula.pistaOculta) cuerpo.append(this.#crearPista(pelicula.pistaOculta));

    const favorita = document.createElement('button');
    favorita.type = 'button';
    favorita.className = 'qv-favorita';
    favorita.dataset.favorita = pelicula.id;
    this.#pintarFavorita(favorita, pelicula.titulo);

    cuerpo.append(favorita);
    tarjeta.append(cartel, cuerpo);
    return tarjeta;
  }

  /**
   * La pista oculta: en oscuro se lee tal cual; en claro queda velada hasta que la tarjeta
   * recibe el ratón o el foco (es un extra, no información necesaria para usar la sección).
   */
  #crearPista(texto) {
    const pista = document.createElement('p');
    pista.className = 'qv-pista';
    const etiqueta = document.createElement('span');
    etiqueta.className = 'qv-pista-etiqueta';
    etiqueta.textContent = 'Revelación';
    const aviso = document.createElement('span');
    aviso.className = 'solo-dia qv-pista-aviso'; // solo en claro: invita a apagar la luz
    aviso.textContent = ' · se ve mejor con la luz apagada';
    const contenido = document.createElement('span');
    contenido.className = 'qv-pista-texto';
    contenido.textContent = texto;
    pista.append(etiqueta, aviso, contenido);
    return pista;
  }

  /** Póster real de TMDB como mejora: si falla, se queda la cartela (la sección no depende de la API). */
  async #cargarPoster(pelicula, cartel) {
    if (!pelicula.tmdbId) return;
    try {
      if (!this.#posters.has(pelicula.tmdbId)) {
        const movie = new Movie(await getMovieDetails(pelicula.tmdbId));
        this.#posters.set(pelicula.tmdbId, movie.posterPath ? movie.posterUrl : null);
      }
      const url = this.#posters.get(pelicula.tmdbId);
      if (!url || !cartel.isConnected) return; // sin póster o la tarjeta ya no está en pantalla
      const img = document.createElement('img');
      img.className = 'qv-poster';
      img.src = url;
      img.alt = `Póster de ${pelicula.titulo}`;
      img.width = 342;
      img.height = 513;
      img.decoding = 'async';
      img.addEventListener('load', () => cartel.classList.add('con-poster'), { once: true });
      cartel.append(img);
    } catch {
      // Sin red o sin token: la cartela tipográfica ya cumple su papel
    }
  }

  // ---------- Favoritas ----------

  #onFavorita(event) {
    const boton = event.target.closest('[data-favorita]');
    if (!boton) return;
    const id = Number(boton.dataset.favorita);
    this.#favoritas = toggleFavorite(this.#favoritas, id);
    saveFavorites(this.#favoritas);
    const titulo = boton.closest('.qv-hallazgo').querySelector('.qv-hallazgo-titulo').textContent;
    this.#pintarFavorita(boton, titulo);
  }

  #pintarFavorita(boton, titulo) {
    const guardada = this.#favoritas.includes(Number(boton.dataset.favorita));
    boton.setAttribute('aria-pressed', String(guardada));
    boton.textContent = guardada ? 'En tu lista' : 'Guardar en mi lista';
    boton.setAttribute('aria-label', guardada ? `Quitar ${titulo} de mi lista` : `Guardar ${titulo} en mi lista`);
  }

  // ---------- Utilidades ----------

  #reiniciar() {
    this.#respuestas = {};
    this.#paso = 0;
    this.#els.resultados.hidden = true;
    this.#els.form.hidden = false;
    this.#pintarPregunta();
    this.#els.pregunta.querySelector('input')?.focus();
  }

  /** Animación con Web Animations; con movimiento reducido no se anima. */
  #animar(elemento, fotogramas, duracion) {
    if (REDUCED_MOTION.matches) return Promise.resolve();
    return elemento.animate(fotogramas, { duration: duracion, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' })
      .finished.catch(() => {});
  }
}
