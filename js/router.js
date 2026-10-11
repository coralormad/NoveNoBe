// #/pelicula/278  o  #/pelicula/278/reparto  (la sección es opcional)
const RUTA_PELICULA = /^#\/pelicula\/(\d+)(?:\/([a-z-]+))?$/;

/** Pura: hash → ruta. Lo desconocido lleva al inicio (nunca a una pantalla rota). */
export function parseRoute(hash = '') {
  const match = hash.match(RUTA_PELICULA);
  if (!match) return { vista: 'inicio' };
  return { vista: 'ficha', id: Number(match[1]), seccion: match[2] ?? null };
}

/** Pura: id (+ sección opcional) → hash. Una sola fuente para construir enlaces. */
export function movieHref(id, seccion = null) {
  return seccion ? `#/pelicula/${id}/${seccion}` : `#/pelicula/${id}`;
}

/** Avisa a onRoute en cada cambio de ruta y también con la ruta inicial (recarga o enlace compartido). */
export function startRouter(onRoute) {
  const handle = () => onRoute(parseRoute(window.location.hash));
  window.addEventListener('hashchange', handle);
  handle();
}