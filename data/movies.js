// Catálogo local de «Qué ver». `atributos` alimenta el recomendador (js/recomendador.js);
// `tmdbId` permite pedir el póster real y enlazar con la ficha. Sin red, la sección funciona igual.
export const peliculas = [
  {
    id: 1,
    titulo: "Mad Max: Fury Road",
    tmdbId: 76341,
    atributos: { atmosfera: ["epica", "tension"], mirada: ["colectiva", "rebelde"], ritmo: ["vertiginoso"], confort: ["directa"] },
    pistaOculta: "Pasa el test de Bechdel con una red de solidaridad entre mujeres explícita.",
    tipo: "peliculas",
    genero: "Acción",
    anio: 2015,
    sinopsis: "En un páramo desértico, una mujer lidera la rebelión contra una tiranía patriarcal."
  },
  {
    id: 2,
    titulo: "Fleabag",
    tmdbId: null, // serie: sin ficha de película en TMDB
    atributos: { atmosfera: ["ironia", "melancolia"], mirada: ["intima"], ritmo: ["conversacional"], confort: ["directa"] },
    pistaOculta: "Rompe la cuarta pared: te convierte en cómplice de lo que mira.",
    tipo: "series",
    genero: "Comedia",
    anio: 2016,
    sinopsis: "Una mujer en Londres navega el duelo, el deseo y las relaciones afectivas sin filtros."
  },
  {
    id: 3,
    titulo: "Promising Young Woman",
    tmdbId: 582014,
    atributos: { atmosfera: ["tension", "ironia"], mirada: ["rebelde", "intima"], ritmo: ["medido"], confort: ["desafiante"] },
    pistaOculta: "Subvierte el cine de venganza desde una estética pastel engañosa.",
    tipo: "peliculas",
    genero: "Drama",
    anio: 2020,
    sinopsis: "Una joven traumatizada por una agresión del pasado busca justicia por su cuenta."
  },
  {
    id: 4,
    titulo: "Die Hard",
    tmdbId: 562,
    atributos: { atmosfera: ["epica", "tension"], mirada: ["rebelde"], ritmo: ["vertiginoso"], confort: ["clasica"] },
    pistaOculta: "La rehén como motor del héroe: no pasa el test de Bechdel.",
    tipo: "peliculas",
    genero: "Acción",
    anio: 1988,
    sinopsis: "Un policía intenta salvar rehenes secuestrados en un rascacielos de Los Ángeles."
  },
  {
    id: 5,
    titulo: "Retrato de una mujer en llamas",
    tmdbId: 531428,
    atributos: { atmosfera: ["melancolia"], mirada: ["intima", "testigo"], ritmo: ["pausado"], confort: ["desafiante"] },
    pistaOculta: "Un estudio sobre la mirada mutua: quién observa y quién es observada.",
    tipo: "peliculas",
    genero: "Drama",
    anio: 2019,
    sinopsis: "Una pintora debe retratar en secreto a una joven que se niega a posar. Mirar es, aquí, empezar a amar."
  },
  {
    id: 6,
    titulo: "La ventana indiscreta",
    tmdbId: 567,
    atributos: { atmosfera: ["tension"], mirada: ["testigo"], ritmo: ["medido"], confort: ["clasica"] },
    pistaOculta: "El origen de NoveNoBé: la obsesión por mirar tras los cristales ajenos.",
    tipo: "peliculas",
    genero: "Suspense",
    anio: 1954,
    sinopsis: "Inmovilizado junto a su ventana, un fotógrafo observa a sus vecinos hasta creer haber visto un crimen."
  },
  {
    id: 7,
    titulo: "The Matrix",
    tmdbId: 603,
    atributos: { atmosfera: ["tension", "epica"], mirada: ["rebelde", "colectiva"], ritmo: ["vertiginoso"], confort: ["clasica"] },
    pistaOculta: "Una alegoría de abrir los ojos ante un engaño colectivo.",
    tipo: "peliculas",
    genero: "Ciencia ficción",
    anio: 1999,
    sinopsis: "Un programador descubre que el mundo que ve es una simulación y que despertar tiene un precio."
  }
];
