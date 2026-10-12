// Doughnut de géneros con Chart.js (cargado con <script defer> en index.html).
// Se crea una vez y después solo se actualizan sus datos.
import { describeRows } from './utils.js';

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');

/** Colores leídos de las variables CSS: la gráfica usa la misma paleta que la web. */
const palette = () => ({
  slices: ['--lavanda-100', '--lavanda-300', '--lavanda-500', '--lavanda-700', '--lavanda-900'].map(css),
  other: css('--color-borde-control'),
  background: css('--color-fondo'),
});

export class CatalogCharts {
  #genreCanvas;
  #genreChart = null;
  #genreRows = [];
  #focusIndex = null;
  #onGenreFocus;

  constructor(genreCanvas, { onGenreFocus = () => {} } = {}) {
    this.#genreCanvas = genreCanvas;
    this.#onGenreFocus = onGenreFocus;
    // Al cambiar de tema, recolorear (cambia el atributo data-theme de <html>)
    new MutationObserver(() => this.#applyColors())
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    // Al sacar el ratón del gráfico se apaga el foco
    genreCanvas.addEventListener('mouseleave', () => this.#focus(null));
  }

  /** @returns {boolean} false si Chart.js no ha cargado (sin red o CDN caído). */
  update({ genres }) {
    if (!window.Chart) return false;
    this.#genreChart ??= this.#createGenreChart();
    this.#applyColors();
    this.#genreRows = genres;
    this.#focus(null); // datos nuevos: el foco anterior ya no vale

    this.#genreChart.data.labels = genres.map((row) => row.label);
    this.#genreChart.data.datasets[0].data = genres.map((row) => row.value);
    this.#genreChart.update();
    this.#genreCanvas.setAttribute('aria-label', `Géneros de las películas cargadas. ${describeRows(genres)}`);
    return true;
  }

  /** Separa una porción desde fuera (las cápsulas). null o -1: ninguna. */
  highlight(index) {
    if (!this.#genreChart) return;
    const active = index === null || index < 0 ? [] : [{ datasetIndex: 0, index }];
    this.#genreChart.setActiveElements(active);
    this.#genreChart.update();
  }

  #createGenreChart() {
    return new Chart(this.#genreCanvas, {
      type: 'doughnut',
      data: { labels: [], datasets: [{ data: [], borderWidth: 2, hoverOffset: 10 }] },
      options: {
        onHover: (_event, elements) => this.#focus(elements[0]?.index ?? null),
        maintainAspectRatio: false,
        cutout: '68%',
        layout: { padding: 12 }, // hueco para que la porción separada no se corte
        animation: REDUCED_MOTION.matches ? false : { duration: 600 },
        plugins: {
          legend: { display: false }, // la leyenda ahora son las cápsulas (HTML accesible)
          tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.parsed} películas` } },
        },
      },
    });
  }

  /** Avisa de qué géneros iluminar, solo si cambia la porción (no en cada píxel). */
  #focus(index) {
    if (index === this.#focusIndex) return;
    this.#focusIndex = index;
    const ids = index === null ? [] : this.#genreRows[index]?.ids ?? [];
    this.#onGenreFocus(ids);
  }

  /** Aplica la paleta actual (al crear y al cambiar de tema). */
  #applyColors() {
    if (!this.#genreChart) return;
    const colors = palette();
    const dataset = this.#genreChart.data.datasets[0];
    dataset.backgroundColor = (ctx) =>
      ctx.chart.data.labels[ctx.dataIndex] === 'Otros' ? colors.other : colors.slices[ctx.dataIndex % 5];
    dataset.borderColor = colors.background; // separa porciones con el color del fondo
    this.#genreChart.update('none');
  }
}