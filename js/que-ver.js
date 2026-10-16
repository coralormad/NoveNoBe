// «Qué ver» · Observatorio cinematográfico.
// Cuatro preguntas (una por plano), cada respuesta enciende una ventana de enfrente y,
// al final, las recomendaciones se revelan enfocándose. La lógica vive en recomendador.js (pura).
import { DIMENSIONES, recomendar, explicar } from './recomendador.js';
import { FILTROS_LISTA, filterByWatched, numeroDeColeccion, genreNames } from './utils.js';
import { getMovieBasics, getGenres } from './api.js';
import {
  cargarLista, quitar, reinsertar, cargarObservadas, alternarObservada,
  entradaDesdeLocal, localDe, favoritasLocales, crearBotonLista, EVENTO_LISTA,
} from './miLista.js';
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
  #posters = new Map(); // tmdbId → promesa de la URL del póster (caché: cada póster se pide una sola vez)
  #miLista = null;      // contenedor de «Mi lista» (opcional)
  #filtrosLista = null; // botones Todas / Por descubrir / Ya observadas
  #observadas = cargarObservadas(); // claves de las ya vistas
  #filtro = 'todas';
  #avisoLista = null;   // línea de estado de Mi lista (anuncia filtros y permite deshacer)
  #deshacer = null;     // última película quitada: { entrada, indice }
  #generos = [];        // géneros de TMDB (id → nombre) para las películas guardadas desde fuera

  /**
   * @param {HTMLElement} raiz
   * @param {{ miLista?: HTMLElement, filtrosLista?: HTMLElement, avisoLista?: HTMLElement }} opciones
   */
  constructor(raiz, { miLista = null, filtrosLista = null, avisoLista = null } = {}) {
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
    const { form, pregunta, atras, reiniciar } = this.#els;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.#avanzar();
    });
    pregunta.addEventListener('change', (event) => this.#responder(event.target.value));
    atras.addEventListener('click', () => this.#irA(this.#paso - 1));
    // Guardar en Mi lista no necesita listener aquí: la cápsula es la misma de toda la página (miLista.js)
    reiniciar.addEventListener('click', () => this.#reiniciar());
    this.#miLista = miLista;
    miLista?.addEventListener('click', (event) => this.#onMiLista(event));
    this.#filtrosLista = filtrosLista;
    filtrosLista?.addEventListener('click', (event) => this.#onFiltro(event));
    this.#avisoLista = avisoLista;
    avisoLista?.addEventListener('click', (event) => {
      if (event.target.closest('[data-deshacer]')) this.#deshacerQuitar();
    });
    // Otra pestaña cambió Mi lista (el aviso llega sin clave): si la vista está a la vista, se repinta
    document.addEventListener(EVENTO_LISTA, (event) => {
      if (event.detail?.clave === null && this.#miLista && !this.#miLista.closest('.vista')?.hidden) this.#pintarLista();
    });

    this.#pintarPregunta();
    // Los nombres de género de lo guardado desde fuera de «Qué ver» (la petición ya está en caché)
    getGenres().then((generos) => {
      this.#generos = generos;
      if (this.#miLista && !this.#miLista.closest('.vista')?.hidden) this.#pintarLista();
    }).catch(() => {}); // sin géneros, Mi lista se pinta igual (solo el año)
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
    const recomendacion = recomendar(peliculas, this.#respuestas, favoritasLocales(cargarLista()));
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

    // En Mi lista: número de colección sobre el cartel (orden de guardado, no una cifra)
    if (item.numero) {
      const numero = document.createElement('span');
      numero.className = 'ml-numero';
      numero.setAttribute('aria-hidden', 'true');
      numero.textContent = `${item.numero} / NNB`;
      cartel.append(numero);
    }

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
    meta.textContent = [pelicula.anio, pelicula.genero, pelicula.tipo === 'series' && 'Serie'].filter(Boolean).join(' · ');

    const sinopsis = pelicula.sinopsis ? document.createElement('p') : null; // lo guardado desde TMDB no trae sinopsis
    if (sinopsis) {
      sinopsis.className = 'qv-sinopsis';
      sinopsis.textContent = pelicula.sinopsis;
    }

    // En «Mi lista» no hay respuestas que explicar: el porqué solo aparece en los resultados
    const motivo = item.motivo ? document.createElement('p') : null;
    if (motivo) {
      motivo.className = 'qv-motivo';
      motivo.textContent = explicar(item);
    }

    cuerpo.append(...[titulo, meta, sinopsis, motivo].filter(Boolean));
    if (pelicula.pistaOculta) cuerpo.append(this.#crearPista(pelicula.pistaOculta));

    if (item.numero) {
      // Solo en Mi lista: «Por descubrir» ⇄ «Ya observada», junto al botón de quitar
      const acciones = document.createElement('div');
      acciones.className = 'ml-acciones';
      const estado = document.createElement('button');
      estado.type = 'button';
      estado.className = 'ml-estado';
      estado.dataset.observada = pelicula.clave;
      this.#pintarEstado(estado, pelicula.titulo);
      // En Mi lista ya está guardada: la acción es quitarla (no es un interruptor) y se puede deshacer
      const quitarBoton = document.createElement('button');
      quitarBoton.type = 'button';
      quitarBoton.className = 'qv-favorita ml-quitar';
      quitarBoton.dataset.quitar = pelicula.clave;
      quitarBoton.textContent = 'Quitar';
      quitarBoton.setAttribute('aria-label', `Quitar «${pelicula.titulo}» de mi lista`);
      acciones.append(estado, quitarBoton);
      cuerpo.append(acciones);
    } else {
      // La misma cápsula que en el resto de la página: guardar aquí es guardar en todas partes
      const favorita = crearBotonLista(entradaDesdeLocal(pelicula), 'texto');
      favorita.classList.add('qv-favorita');
      cuerpo.append(favorita);
    }
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
      // Guardada desde TMDB: ya trae la ruta del póster (la clase Movie construye la URL, como en todas partes)
      if (pelicula.posterPath) this.#posters.set(pelicula.tmdbId, Promise.resolve(new Movie({ poster_path: pelicula.posterPath }).posterUrl));
      if (!this.#posters.has(pelicula.tmdbId)) {
        // Se guarda la promesa, no el resultado: dos tarjetas de la misma película comparten una sola petición
        const peticion = getMovieBasics(pelicula.tmdbId).then((data) => {
          const movie = new Movie(data);
          return movie.posterPath ? movie.posterUrl : null;
        });
        peticion.catch(() => this.#posters.delete(pelicula.tmdbId)); // si falla, la próxima vez se reintenta
        this.#posters.set(pelicula.tmdbId, peticion);
      }
      const url = await this.#posters.get(pelicula.tmdbId);
      // Sin comprobar isConnected: con el póster en caché esto ocurre antes de que la tarjeta entre en la página
      // (y entonces nunca se pintaba). Añadirlo a una tarjeta ya retirada no tiene efecto.
      if (!url) return;
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

  // ---------- Mi lista ----------

  /** Clics dentro de Mi lista: marcar como vista o quitar de la lista. */
  #onMiLista(event) {
    const tarjeta = event.target.closest('.qv-hallazgo');
    const indice = [...this.#miLista.querySelectorAll('.qv-hallazgo')].indexOf(tarjeta); // su sitio, para no perder el foco
    const quitarBoton = event.target.closest('[data-quitar]');
    if (quitarBoton) return this.#quitar(quitarBoton.dataset.quitar, indice);
    const estado = event.target.closest('[data-observada]');
    if (!estado) return;
    this.#observadas = alternarObservada(estado.dataset.observada);
    if (this.#filtro === 'todas') {
      this.#pintarEstado(estado, tarjeta.querySelector('.qv-hallazgo-titulo').textContent);
    } else {
      this.#pintarLista(); // con un filtro activo, la tarjeta cambia de grupo y sale de la vista
      this.#enfocarEn(indice);
    }
  }

  /** Tras repintar, el foco no cae en la página: va a la tarjeta que ocupa ese sitio (o a la última),
   *  y sin tarjetas, al filtro activo o a la salida del estado vacío. */
  #enfocarEn(indice) {
    const estados = this.#miLista.querySelectorAll('.ml-estado');
    const filtro = this.#filtrosLista?.hidden ? null : this.#filtrosLista?.querySelector('[aria-pressed="true"]');
    const destino = estados[Math.min(Math.max(indice, 0), estados.length - 1)]
      ?? filtro
      ?? this.#miLista.querySelector('.ml-vacio-enlace');
    destino?.focus();
  }

  #onFiltro(event) {
    const boton = event.target.closest('[data-filtro]');
    if (!boton || !FILTROS_LISTA.includes(boton.dataset.filtro)) return;
    this.#filtro = boton.dataset.filtro;
    this.#pintarLista();
    this.#anunciar(`Mostrando: ${boton.textContent.toLowerCase()}.`, { visible: false });
  }

  /** Quitada desde Mi lista: la tarjeta desaparece, pero se puede deshacer (nada se pierde por un clic). */
  #quitar(clave, indice) {
    const quitada = quitar(clave);
    if (!quitada) return;
    this.#deshacer = quitada;
    this.#pintarLista();
    this.#anunciar(`Has quitado «${quitada.entrada.titulo}» de tu lista.`, { deshacer: true });
    // El botón pulsado ya no existe: el foco pasa a «Deshacer», la acción que tiene sentido justo ahora
    const deshacer = this.#avisoLista?.querySelector('[data-deshacer]');
    if (deshacer) deshacer.focus();
    else this.#enfocarEn(indice);
  }

  /** Devuelve la última película quitada a su sitio (la instantánea guardada en el aviso, no una copia de la lista). */
  #deshacerQuitar() {
    if (!this.#deshacer) return;
    const { entrada, indice } = this.#deshacer;
    reinsertar(entrada, indice);
    this.#deshacer = null;
    this.#pintarLista();
    this.#anunciar(`«${entrada.titulo}» vuelve a tu lista.`);
    // «Deshacer» desaparece: el foco va a la película recuperada (si el filtro la deja a la vista)
    const recuperada = this.#miLista.querySelector(`[data-observada="${entrada.clave}"]`);
    if (recuperada) recuperada.focus();
    else this.#enfocarEn(indice);
  }

  /** Línea de estado: los lectores de pantalla la anuncian (role="status"). */
  #anunciar(texto, { deshacer = false, visible = true } = {}) {
    if (!this.#avisoLista) return;
    const mensaje = document.createElement('span');
    mensaje.textContent = texto;
    const partes = [mensaje];
    if (deshacer) {
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'ml-deshacer';
      boton.dataset.deshacer = '';
      boton.textContent = 'Deshacer';
      partes.push(boton);
    }
    this.#avisoLista.classList.toggle('sr-only', !visible);
    this.#avisoLista.replaceChildren(...partes);
  }

  #pintarEstado(boton, titulo) {
    const vista = this.#observadas.includes(boton.dataset.observada);
    boton.setAttribute('aria-pressed', String(vista));
    boton.textContent = vista ? 'Ya observada' : 'Por descubrir';
    boton.setAttribute('aria-label', vista ? `${titulo}: ya observada. Marcar como por descubrir` : `${titulo}: por descubrir. Marcar como ya observada`);
  }

  /** Al entrar en Mi lista: se pinta con lo último guardado y el aviso anterior se retira. */
  pintarMiLista() {
    this.#deshacer = null;
    this.#avisoLista?.replaceChildren();
    this.#pintarLista();
  }

  /**
   * Pinta Mi lista: las favoritas en el orden en que se guardaron, filtradas por su estado.
   * Cada tarjeta conserva su número de colección aunque haya un filtro activo.
   */
  #pintarLista() {
    if (!this.#miLista) return;
    this.#observadas = cargarObservadas();
    const guardadas = cargarLista().map((entrada) => this.#vistaDe(entrada));

    // Los filtros solo tienen sentido con algo guardado
    if (this.#filtrosLista) {
      this.#filtrosLista.hidden = guardadas.length === 0;
      this.#filtrosLista.querySelectorAll('[data-filtro]').forEach((boton) =>
        boton.setAttribute('aria-pressed', String(boton.dataset.filtro === this.#filtro)));
    }

    if (guardadas.length === 0) {
      this.#miLista.replaceChildren(this.#crearVacio(
        'Todavía no has guardado ninguna mirada.',
        'Guarda cualquier película con el botón + de su cartel o de su ficha: aquí te esperará, vista o por ver.',
        { href: '#/que-ver', texto: 'Descubre qué ver' }));
      return;
    }

    const visibles = filterByWatched(guardadas, this.#observadas, this.#filtro, 'clave');
    if (visibles.length === 0) {
      const textos = this.#filtro === 'pendientes'
        ? ['No queda nada por descubrir.', 'Todo lo que guardaste ya ha pasado ante tus ojos.']
        : ['Aún no has marcado ninguna como vista.', 'Cuando veas una, márcala: la lista recordará tu mirada.'];
      this.#miLista.replaceChildren(this.#crearVacio(...textos));
      return;
    }

    this.#miLista.replaceChildren(...visibles.map((pelicula, i) =>
      this.#crearHallazgo({ pelicula, numero: numeroDeColeccion(guardadas.indexOf(pelicula)) }, i)));
  }

  /** Estado vacío con la misma voz que el resto: una cartela, una línea y, si toca, una salida. */
  #crearVacio(titulo, texto, enlace = null) {
    const vacio = document.createElement('div');
    vacio.className = 'ml-vacio';
    const cartela = document.createElement('p');
    cartela.className = 'ml-vacio-titulo';
    cartela.textContent = titulo;
    const linea = document.createElement('p');
    linea.className = 'ml-vacio-texto';
    linea.textContent = texto;
    vacio.append(cartela, linea);
    if (enlace) {
      const a = document.createElement('a');
      a.className = 'ml-vacio-enlace';
      a.href = enlace.href;
      a.textContent = enlace.texto;
      vacio.append(a);
    }
    return vacio;
  }

  /** Lo que Mi lista pinta de cada película guardada: la instantánea y, si es del catálogo local,
   *  su sinopsis y su pista oculta. Las de TMDB llevan el nombre de sus géneros. */
  #vistaDe(entrada) {
    const local = localDe(entrada);
    return {
      clave: entrada.clave,
      titulo: entrada.titulo,
      tmdbId: entrada.tmdbId,
      anio: entrada.anio,
      genero: local?.genero ?? genreNames(entrada.generos, this.#generos),
      tipo: local?.tipo ?? 'peliculas',
      sinopsis: local?.sinopsis ?? '',
      pistaOculta: local?.pistaOculta ?? null,
      posterPath: entrada.poster,
    };
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
