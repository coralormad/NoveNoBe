// «Para ti» · lo que TMDB relaciona con las películas de Mi lista.
// No es una inteligencia artificial ni una selección al azar: son las recomendaciones de TMDB para tus
// últimas guardadas, ordenadas por cuántas de ellas coinciden. Lo ya guardado nunca se recomienda.
import { getRecommendations, getSimilar } from './api.js';
import { Movie } from './Movie.js';
import { debounce, toUserMessage } from './utils.js';
import { cargarLista, claveTmdb, EVENTO_LISTA } from './miLista.js';

const MAX_SEMILLAS = 4;      // las últimas guardadas mandan: cuatro peticiones como mucho, y solo una vez
const MAX_RECOMENDADAS = 12;
const LISTA_TITULOS = new Intl.ListFormat('es', { type: 'conjunction' });

// ---------- Puras ----------

/** Pura: las últimas películas de TMDB guardadas (de la más reciente a la más antigua). */
export const elegirSemillas = (lista, max = MAX_SEMILLAS) =>
  lista.filter((entrada) => entrada.tmdbId).slice(-max).reverse();

/**
 * Pura: une las recomendaciones de varias semillas en un solo ranking.
 * Primero las que recomiendan más semillas a la vez; después, el orden de relevancia de TMDB
 * (así se intercalan las semillas: la primera de cada una, luego la segunda…). Sin repetidas.
 * @param {Array<{ resultados: Movie[] }>} fuentes - una por semilla, de la más reciente a la más antigua
 * @param {Set<string>} guardadas - claves de Mi lista (no se recomiendan)
 * @returns {Movie[]} array nuevo
 */
export function combinarRecomendaciones(fuentes, guardadas, max = MAX_RECOMENDADAS) {
  const ranking = new Map(); // id → { movie, coincidencias, posicion, semilla }
  fuentes.forEach(({ resultados }, semilla) => {
    resultados.forEach((movie, posicion) => {
      if (guardadas.has(claveTmdb(movie.id))) return;
      const previa = ranking.get(movie.id);
      ranking.set(movie.id, previa
        ? { ...previa, coincidencias: previa.coincidencias + 1 } // se queda con su mejor posición
        : { movie, coincidencias: 1, posicion, semilla });
    });
  });
  return [...ranking.values()]
    .sort((a, b) => b.coincidencias - a.coincidencias || a.posicion - b.posicion || a.semilla - b.semilla)
    .slice(0, max)
    .map(({ movie }) => movie);
}

/** Pura: el porqué, con títulos reales: «A partir de «Alien», «Carol» y «Her»». */
export const textoSemillas = (semillas) =>
  `A partir de ${LISTA_TITULOS.format(semillas.map(({ titulo }) => `«${titulo}»`))}`;

// ---------- La sección ----------

export class ParaTi {
  #els;
  #crearTarjeta;
  #cache = new Map();   // tmdbId de la semilla → Movie[] (cada semilla se pide una sola vez por visita)
  #controller = null;
  #pendiente = false;   // hubo un cambio mientras mirabas la sección: se aplica al salir de ella

  /**
   * @param {{ seccion: HTMLElement, fila: HTMLElement, fuentes: HTMLElement, flechas: HTMLElement }} els
   * @param {{ crearTarjeta: (movie: Movie) => HTMLElement }} opciones - la misma tarjeta que el resto de filas
   */
  constructor(els, { crearTarjeta }) {
    this.#els = els;
    this.#crearTarjeta = crearTarjeta;
    const cambio = debounce(() => this.#alCambiar(), 300); // varios clics seguidos → una sola actualización
    document.addEventListener(EVENTO_LISTA, cambio);
    // Si guardas una recomendada, no desaparece bajo tu cursor: la sección se renueva cuando sales de ella
    els.seccion.addEventListener('pointerleave', () => this.#aplicarPendiente());
    els.seccion.addEventListener('focusout', (event) => {
      if (!els.seccion.contains(event.relatedTarget)) this.#aplicarPendiente();
    });
  }

  #alCambiar() {
    if (this.#els.seccion.matches(':hover, :focus-within')) {
      this.#pendiente = true;
      return;
    }
    this.actualizar();
  }

  #aplicarPendiente() {
    if (!this.#pendiente) return;
    this.#pendiente = false;
    this.actualizar();
  }

  /** Recalcula la sección con lo guardado ahora. Solo pide a TMDB las semillas nuevas. */
  async actualizar() {
    const lista = cargarLista();
    const semillas = elegirSemillas(lista);
    if (semillas.length === 0) return this.#pintarVacio();

    this.#controller?.abort(); // un cambio anterior aún cargando: se descarta
    this.#controller = new AbortController();
    const { signal } = this.#controller;
    if (this.#els.fila.children.length === 0) this.#mensaje('Buscando lo que encaja con tu lista…');

    try {
      const fuentes = await Promise.all(semillas.map(async (semilla) => ({
        resultados: await this.#recomendadasPara(semilla.tmdbId, signal),
      })));
      const guardadas = new Set(lista.map(({ clave }) => clave));
      const recomendadas = combinarRecomendaciones(fuentes, guardadas);
      this.#els.fuentes.textContent = textoSemillas(semillas);
      if (recomendadas.length === 0) {
        this.#mensaje('Tus guardadas aún no tienen relaciones en TMDB. Guarda alguna más y vuelve a mirar.');
        return;
      }
      this.#els.flechas.hidden = false;
      this.#els.fila.replaceChildren(...recomendadas.map(this.#crearTarjeta));
    } catch (error) {
      if (error.name === 'AbortError') return;
      this.#mensaje(toUserMessage(error));
    }
  }

  /** Recomendaciones de TMDB de una película; si no tiene, sus parecidas. Con caché. */
  async #recomendadasPara(id, signal) {
    if (!this.#cache.has(id)) {
      let { results } = await getRecommendations(id, { signal });
      if (results.length === 0) ({ results } = await getSimilar(id, { signal }));
      this.#cache.set(id, Movie.fromList(results));
    }
    return this.#cache.get(id);
  }

  #mensaje(texto) {
    const p = document.createElement('p');
    p.className = 'fila-mensaje';
    p.textContent = texto;
    this.#els.flechas.hidden = true;
    this.#els.fila.replaceChildren(p);
  }

  /** Lista vacía: no se finge nada. Se enseña cómo empezar: tres ventanas apagadas esperando una mirada. */
  #pintarVacio() {
    this.#controller?.abort();
    this.#els.fuentes.textContent = 'Todavía no hay nada guardado';
    this.#els.flechas.hidden = true;

    const vacio = document.createElement('div');
    vacio.className = 'para-ti-vacio';
    const ventanas = document.createElement('div');
    ventanas.className = 'para-ti-ventanas';
    ventanas.setAttribute('aria-hidden', 'true');
    ventanas.append(...Array.from({ length: 3 }, () => document.createElement('span')));

    const texto = document.createElement('div');
    texto.className = 'para-ti-texto';
    const titulo = document.createElement('p');
    titulo.className = 'para-ti-titulo';
    titulo.textContent = 'Estas ventanas se encienden con lo que guardas.';
    const pasos = document.createElement('p');
    pasos.className = 'para-ti-pasos';
    pasos.append(
      'Pulsa ',
      Object.assign(document.createElement('span'), { className: 'para-ti-mas', textContent: '+' }),
      ' en cualquier cartel o ficha. Con tus guardadas, aquí aparecerán las películas que TMDB relaciona con ellas.',
    );
    texto.append(titulo, pasos);
    vacio.append(ventanas, texto);
    this.#els.fila.replaceChildren(vacio);
  }
}
