// Gráficas del catálogo con Chart.js (cargado con <script defer> en index.html).
// Se crean una vez y después solo se actualizan sus datos.
import { describeRows } from './utils.js';

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');
const truncate = (text, max = 18) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** Colores leídos de las variables CSS: la gráfica usa la misma paleta que la web. */
const palette = () => ({
  slices: ['--lavanda-100', '--lavanda-300', '--lavanda-500', '--lavanda-700', '--lavanda-900'].map(css),
  other: css('--color-borde-control'),
  text: css('--color-texto'),
  soft: css('--color-texto-suave'),
  grid: css('--color-borde'),
  background: css('--color-fondo'),
});

export class CatalogCharts {
  #genreCanvas;
  #popularityCanvas;
  #genreChart = null;
  #popularityChart = null;

  constructor(genreCanvas, popularityCanvas) {
    this.#genreCanvas = genreCanvas;
    this.#popularityCanvas = popularityCanvas;
    // Al cambiar de tema, recolorear (cambia el atributo data-theme de <html>)
    new MutationObserver(() => this.#applyColors())
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  /** @returns {boolean} false si Chart.js no ha cargado (sin red o CDN caído). */
  update({ genres, popularity }) {
    if (!window.Chart) return false;
    this.#genreChart ??= this.#createGenreChart();
    this.#popularityChart ??= this.#createPopularityChart();
    this.#applyColors();

    CatalogCharts.#setData(this.#genreChart, genres);
    CatalogCharts.#setData(this.#popularityChart, popularity);
    this.#genreCanvas.setAttribute('aria-label', `Géneros de las películas cargadas. ${describeRows(genres)}`);
    this.#popularityCanvas.setAttribute('aria-label', `Las 5 más populares según TMDB. ${describeRows(popularity)}`);
    return true;
  }

  static #setData(chart, rows) {
    chart.data.labels = rows.map((row) => row.label);
    chart.data.datasets[0].data = rows.map((row) => row.value);
    chart.update(); // Chart.js anima del estado anterior al nuevo
  }

  #createGenreChart() {
    return new Chart(this.#genreCanvas, {
      type: 'doughnut',
      data: { labels: [], datasets: [{ data: [], borderWidth: 2 }] },
      options: {
        maintainAspectRatio: false,
        cutout: '68%',
        animation: REDUCED_MOTION.matches ? false : { duration: 600 },
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, font: { size: 11 } } },
          tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.parsed} películas` } },
        },
      },
    });
  }

  #createPopularityChart() {
    return new Chart(this.#popularityCanvas, {
      type: 'bar',
      data: { labels: [], datasets: [{ data: [], borderRadius: 3, maxBarThickness: 18 }] },
      options: {
        indexAxis: 'y', // barras horizontales: los títulos se leen enteros
        maintainAspectRatio: false,
        animation: REDUCED_MOTION.matches ? false : { duration: 600 },
        scales: {
          x: { beginAtZero: true, ticks: { font: { size: 10 } } },
          y: {
            grid: { display: false },
            ticks: { callback(value) { return truncate(this.getLabelForValue(value)); } },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => ` Popularidad TMDB: ${ctx.parsed.x}` } },
        },
      },
    });
  }

  /** Aplica la paleta actual a las dos gráficas (al crearlas y al cambiar de tema). */
  #applyColors() {
    if (!window.Chart) return;
    const colors = palette();
    Chart.defaults.color = colors.soft;
    Chart.defaults.font.family = css('--fuente-texto');

    if (this.#genreChart) {
      const dataset = this.#genreChart.data.datasets[0];
      dataset.backgroundColor = (ctx) =>
        ctx.chart.data.labels[ctx.dataIndex] === 'Otros' ? colors.other : colors.slices[ctx.dataIndex % 5];
      dataset.borderColor = colors.background; // separa porciones con el color del fondo
      this.#genreChart.options.plugins.legend.labels.color = colors.text;
      this.#genreChart.update('none');
    }
    if (this.#popularityChart) {
      this.#popularityChart.data.datasets[0].backgroundColor = colors.slices[1];
      this.#popularityChart.options.scales.x.grid.color = colors.grid;
      this.#popularityChart.options.scales.y.ticks.color = colors.text;
      this.#popularityChart.update('none');
    }
  }
}