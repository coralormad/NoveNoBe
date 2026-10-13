// Teselas de OpenStreetMap: gratis y sin clave. El tema oscuro se aplica con CSS.
const TILES_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const MUNDO = { centro: [20, 0], zoom: 1 };
const ZOOM_MAX = 4;

// ---------- Puras ----------

const REGION_NAMES = new Intl.DisplayNames(['es'], { type: 'region' });

/** Nombre del país en español ('FR' → 'Francia'); si el navegador no lo conoce (p. ej. 'SU'), usa el de TMDB. */
export function countryName(code, fallback) {
  try {
    const name = REGION_NAMES.of(code);
    return name && name !== code ? name : fallback;
  } catch {
    return fallback;
  }
}

/** Países de TMDB → marcadores. Descarta códigos sin coordenadas; no muta la entrada. */
export function toMarkers(countries = [], coords = {}) {
  return countries
    .filter(({ iso_3166_1: code }) => Object.hasOwn(coords, code))
    .map(({ iso_3166_1: code, name }) => ({ code, name: countryName(code, name), latlng: coords[code] }));
}
// Texto accesible del mapa: «Mapa de producción: Estados Unidos y Francia»
const listFormat = new Intl.ListFormat('es', { type: 'conjunction' });
export const mapLabel = (markers = []) =>
  `Mapa de producción: ${listFormat.format(markers.map(({ name }) => name))}`;

// ---------- Clase ----------

export class CountryMap {
  #map;
  #layer;
  #tiles;
  #theme;
  #color;
  #markers = [];

  constructor(container) {
    // Mapa de lectura: sin zoom ni arrastre, solo mirar
    this.#map = L.map(container, {
      zoomControl: false, dragging: false, scrollWheelZoom: false,
      doubleClickZoom: false, boxZoom: false, keyboard: false, touchZoom: false,
    }).setView(MUNDO.centro, MUNDO.zoom);
    this.#layer = L.layerGroup().addTo(this.#map);
  }

  /** Pinta los marcadores. Llamar con el mapa ya visible (después de showModal). */
  show(markers) {
    this.#markers = markers;
    this.#syncTheme();
    this.#map.invalidateSize(); // el <dialog> estaba oculto: Leaflet debe medir de nuevo
    this.#layer.clearLayers();

    markers.forEach(({ name, latlng }) => {
      L.circleMarker(latlng, {
        radius: 7, weight: 2, color: this.#color, fillColor: this.#color, fillOpacity: 0.85,
      }).bindTooltip(name).addTo(this.#layer);
    });

    if (markers.length === 1) {
      this.#map.setView(markers[0].latlng, ZOOM_MAX);
    } else if (markers.length > 1) {
      this.#map.fitBounds(markers.map((m) => m.latlng), { padding: [24, 24], maxZoom: ZOOM_MAX });
    } else {
      this.#map.setView(MUNDO.centro, MUNDO.zoom);
    }
  }

  /** Vuelve a pintar lo último mostrado (p. ej. tras cambiar de tema con la ficha abierta). */
  refresh() {
    this.show(this.#markers);
  }

  /** Teselas y color de día o de noche según el tema; solo cambia si hace falta. */
  #syncTheme() {
    const theme = document.documentElement.dataset.theme === 'claro' ? 'claro' : 'oscuro';
    if (theme === this.#theme) return;

    this.#tiles ??= L.tileLayer(TILES_URL, {
      attribution: ATTRIBUTION, maxZoom: 19, className: 'mapa-teselas',
    }).addTo(this.#map);

    const token = theme === 'claro' ? '--lavanda-100' : '--lavanda-300';
    this.#color = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
    this.#theme = theme;
  }
}