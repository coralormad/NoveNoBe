// Recomendador de «Qué ver»: solo funciones puras (sin DOM ni localStorage).
// Mismas respuestas y mismas favoritas → siempre las mismas recomendaciones.

/** Las cuatro preguntas. El peso dice cuánto cuenta cada coincidencia. */
export const DIMENSIONES = Object.freeze([
  {
    clave: 'atmosfera', nombre: 'atmósfera', peso: 3,
    titulo: '¿Qué atmósfera quieres respirar?',
    subtitulo: 'La energía y el tono que deben llenar la pantalla.',
    opciones: [
      { valor: 'tension', etiqueta: 'Tensión que no suelta', pista: 'El aire se corta: algo está a punto de pasar.' },
      { valor: 'melancolia', etiqueta: 'Melancolía luminosa', pista: 'Lo que duele también puede ser bello.' },
      { valor: 'ironia', etiqueta: 'Ironía afilada', pista: 'Reírse para no apartar la mirada.' },
      { valor: 'epica', etiqueta: 'Energía desbocada', pista: 'Fuego, polvo y ganas de cambiarlo todo.' },
    ],
  },
  {
    clave: 'mirada', nombre: 'mirada', peso: 3,
    titulo: '¿Desde dónde quieres mirar?',
    subtitulo: 'La diferencia entre mirar una escena y adentrarse en ella.',
    opciones: [
      { valor: 'intima', etiqueta: 'Muy de cerca', pista: 'Una vida por dentro, sin filtros.' },
      { valor: 'testigo', etiqueta: 'Desde el otro lado del patio', pista: 'Observar sin ser vista, atar cabos.' },
      { valor: 'colectiva', etiqueta: 'Entre muchas', pista: 'Un grupo que se sostiene frente al mundo.' },
      { valor: 'rebelde', etiqueta: 'Con quien rompe las reglas', pista: 'Alguien que se niega a mirar hacia otro lado.' },
    ],
  },
  {
    clave: 'ritmo', nombre: 'ritmo', peso: 2,
    titulo: '¿A qué ritmo?',
    subtitulo: 'El pulso del montaje.',
    opciones: [
      { valor: 'pausado', etiqueta: 'Sin prisa', pista: 'Planos que respiran y silencios que hablan.' },
      { valor: 'medido', etiqueta: 'Tensión creciente', pista: 'Cada escena aprieta un poco más.' },
      { valor: 'vertiginoso', etiqueta: 'Sin tregua', pista: 'Ni un segundo para pestañear.' },
      { valor: 'conversacional', etiqueta: 'Diálogo y réplica', pista: 'Palabras rápidas y mucho subtexto.' },
    ],
  },
  {
    clave: 'confort', nombre: 'propuesta', peso: 2,
    titulo: '¿Cuánto quieres que te remueva?',
    subtitulo: '«No hay más ciego que el que no quiere ver».',
    opciones: [
      { valor: 'directa', etiqueta: 'Que me atrape sin esfuerzo', pista: 'Entrar y dejarse llevar.' },
      { valor: 'clasica', etiqueta: 'Un clásico que ha resistido', pista: 'Lo que el tiempo ya ha confirmado.' },
      { valor: 'desafiante', etiqueta: 'Que me incomode', pista: 'Salir de la sala con preguntas.' },
    ],
  },
]);

const LISTA = new Intl.ListFormat('es', { type: 'conjunction' });

/** Pura: etiqueta legible de un valor («tension» → «Tensión que no suelta»). */
export function etiquetaDe(clave, valor) {
  const dimension = DIMENSIONES.find((d) => d.clave === clave);
  return dimension?.opciones.find((o) => o.valor === valor)?.etiqueta ?? valor;
}

/** Pura: puntos de una película y en qué respuestas coincide. */
export function puntuar(pelicula, respuestas) {
  const coincidencias = DIMENSIONES
    .filter(({ clave }) => respuestas[clave] && pelicula.atributos?.[clave]?.includes(respuestas[clave]))
    .map(({ clave, peso }) => ({ clave, valor: respuestas[clave], peso }));
  const puntos = coincidencias.reduce((total, { peso }) => total + peso, 0);
  return { puntos, coincidencias };
}

/** Pura: los valores que se repiten en las favoritas → Set de «clave:valor». */
export function perfilDe(peliculas, favoritas) {
  const perfil = new Set();
  peliculas
    .filter((p) => favoritas.includes(p.id))
    .forEach((p) => Object.entries(p.atributos ?? {})
      .forEach(([clave, valores]) => valores.forEach((valor) => perfil.add(`${clave}:${valor}`))));
  return perfil;
}

/** Pura: rasgos que una película comparte con el perfil de favoritas (uno por dimensión). */
export function afinidadCon(pelicula, perfil) {
  return Object.entries(pelicula.atributos ?? {})
    .map(([clave, valores]) => ({ clave, valor: valores.find((v) => perfil.has(`${clave}:${v}`)) }))
    .filter(({ valor }) => valor);
}

/** Orden estable: puntos, después afinidad con las favoritas y, si empatan, por título. */
const comparar = (a, b) =>
  b.puntos - a.puntos
  || b.afinidad.length - a.afinidad.length
  || a.pelicula.titulo.localeCompare(b.pelicula.titulo, 'es');

/**
 * Pura: reparte las recomendaciones en tres grupos sin repetir película.
 * - mira: la de mayor afinidad con las respuestas.
 * - ventana: hasta dos más, primero las que se parecen a las favoritas.
 * - noBuscabas: otra atmósfera, pero que comparte algo más con las respuestas (nunca una al azar).
 * Las favoritas no se recomiendan salvo que no quede nada más.
 */
export function recomendar(peliculas, respuestas, favoritas = []) {
  const perfil = perfilDe(peliculas, favoritas);
  const ranking = peliculas
    .map((pelicula) => ({
      pelicula,
      ...puntuar(pelicula, respuestas),
      afinidad: afinidadCon(pelicula, perfil).filter(() => !favoritas.includes(pelicula.id)),
      favorita: favoritas.includes(pelicula.id),
    }))
    .filter((item) => item.puntos > 0)
    .sort(comparar);

  // Primero las que no están guardadas; las favoritas solo rellenan si faltan
  const candidatas = [...ranking.filter((i) => !i.favorita), ...ranking.filter((i) => i.favorita)];
  const usadas = new Set();
  const tomar = (n, condicion = () => true) => {
    const elegidas = candidatas.filter((i) => !usadas.has(i.pelicula.id) && condicion(i)).slice(0, n);
    elegidas.forEach((i) => usadas.add(i.pelicula.id));
    return elegidas;
  };

  const mira = tomar(1).map((i) => ({ ...i, motivo: 'respuestas' }));
  const parecidas = favoritas.length ? tomar(2, (i) => !i.favorita && i.afinidad.length >= 2) : [];
  const ventana = [
    ...parecidas.map((i) => ({ ...i, motivo: 'favoritas' })),
    ...tomar(2 - parecidas.length).map((i) => ({ ...i, motivo: 'cerca' })),
  ];
  const [noBuscabas = null] = tomar(1, (i) =>
    i.pelicula.atributos.atmosfera.every((a) => a !== respuestas.atmosfera)
    && i.coincidencias.length > 0)
    .map((i) => ({ ...i, motivo: 'descubrimiento' }));

  return { mira, ventana, noBuscabas };
}

/** Pura: frase que explica una recomendación con coincidencias reales (nada de porcentajes). */
export function explicar({ motivo, coincidencias, afinidad, favorita }) {
  const rasgos = (lista) => LISTA.format(lista.map(({ clave, valor }) =>
    `${DIMENSIONES.find((d) => d.clave === clave).nombre} «${etiquetaDe(clave, valor)}»`));
  const extra = favorita ? ' Ya está en tu lista.' : '';
  if (motivo === 'favoritas') return `Comparte ${rasgos(afinidad)} con tus favoritas.${extra}`;
  if (motivo === 'descubrimiento') return `No es la atmósfera que pediste, pero comparte tu ${rasgos(coincidencias)}.${extra}`;
  if (motivo === 'cerca') return `También responde a tu ${rasgos(coincidencias)}.${extra}`;
  return `Coincide con tu ${rasgos(coincidencias)}.${extra}`;
}
