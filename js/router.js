// Router por hash: el estado de la navegación vive en la URL.
//   #/ (o vacío)    → inicio
//   #/pelicula/278  → ficha de la película 278
// Hash y no rutas reales: GitHub Pages no redirige rutas, y #/… sobrevive a recargas y enlaces compartidos.

const RUTA_PELICULA = /^#\/pelicula\/(\d+)$/;

/** Pura: hash → ruta. Lo desconocido lleva al inicio (nunca a una pantalla rota). */
export function parseRoute(hash = '') {
  const match = hash.match(RUTA_PELICULA);
  return match ? { vista: 'ficha', id: Number(match[1]) } : { vista: 'inicio' };
}

/** Pura: id → hash de su ficha (una sola fuente para construir enlaces). */
export function movieHref(id) {
  return `#/pelicula/${id}`;
}

/** Avisa a onRoute en cada cambio de ruta y también con la ruta inicial (recarga o enlace compartido). */
export function startRouter(onRoute) {
  const handle = () => onRoute(parseRoute(window.location.hash));
  window.addEventListener('hashchange', handle);
  handle();
}