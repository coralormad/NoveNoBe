const moviesData = [
  {
    id: 1,
    title: "Mad Max: Fury Road",
    year: 2015,
    type: "Película",
    bechdelPasses: true,
    violenceRepresentation: "Crítica de la cosificación y rescate de la autonomía femenina.",
    standardDescription: "Acción postapocalíptica y persecuciones en el desierto.",
    votes: { bechdel: 42, noViolence: 38 }
  },
  {
    id: 2,
    title: "Fleabag",
    year: 2016,
    type: "Serie",
    bechdelPasses: true,
    violenceRepresentation: "Subversión de roles tradicionales y vínculos entre hermanas.",
    standardDescription: "Comedia dramática sobre una mujer independiente en Londres.",
    votes: { bechdel: 55, noViolence: 50 }
  },
  {
    id: 3,
    title: "Die Hard",
    year: 1988,
    type: "Película",
    bechdelPasses: false,
    violenceRepresentation: "Tropo de la mujer trofeo/rehén como motor del héroe masculino.",
    standardDescription: "Clásico policial de acción y rescate en un rascacielos.",
    votes: { bechdel: 5, noViolence: 12 }
  }
];

export const peliculas = [
  {
    id: 1,
    titulo: "Mad Max: Fury Road",
    tipo: "peliculas",
    genero: "Acción",
    anio: 2015,
    portada: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500&q=80",
    sinopsis: "En un páramo desértico, una mujer lidera la rebelión contra una tiranía patriarcal.",
    pasaBechdel: true,
    violacion: false,
    votos: { bechdelSi: 48, bechdelNo: 2, violacionSi: 0, violacionNo: 50 },
    destacada: true
  },
  {
    id: 2,
    titulo: "Fleabag",
    tipo: "series",
    genero: "Comedia",
    anio: 2016,
    portada: "https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=500&q=80",
    sinopsis: "Una mujer en Londres navega el duelo, el deseo y las relaciones afectivas sin filtros.",
    pasaBechdel: true,
    violacion: false,
    votos: { bechdelSi: 62, bechdelNo: 1, violacionSi: 0, violacionNo: 60 },
    destacada: true
  },
  {
    id: 3,
    titulo: "Promising Young Woman",
    tipo: "peliculas",
    genero: "Drama",
    anio: 2020,
    portada: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=500&q=80",
    sinopsis: "Una joven traumatizada por una agresión del pasado busca justicia por su cuenta.",
    pasaBechdel: true,
    violacion: true,
    votos: { bechdelSi: 35, bechdelNo: 4, violacionSi: 32, violacionNo: 7 },
    destacada: false
  },
  {
    id: 4,
    titulo: "Die Hard",
    tipo: "peliculas",
    genero: "Acción",
    anio: 1988,
    portada: "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=500&q=80",
    sinopsis: "Un policía intenta salvar rehenes secuestrados en un rascacielos de Los Ángeles.",
    pasaBechdel: false,
    violacion: false,
    votos: { bechdelSi: 3, bechdelNo: 41, violacionSi: 0, violacionNo: 44 },
    destacada: false
  }
];

export const avisos = [
  "Nueva votación comunitaria abierta para títulos de 2026.",
  "Se añadió el desglose de análisis para 'Promising Young Woman'.",
  "Actualización del catálogo con perspectiva de género."
];

