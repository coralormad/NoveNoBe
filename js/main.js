import { peliculas as peliculasLocales, avisos } from "../data/movies.js";
import { 
  obtenerTendenciasTMDB, 
  obtenerSeriesTMDB, 
  buscarEnTMDB, 
  TITULOS_CURADOS 
} from "./tmdb.js";

// ===================================================
// 1. ESTADO GLOBAL
// ===================================================
let peliculas = [...peliculasLocales];
let listaHero = [];
let indiceHero = 0;
let peliculaSeleccionada = null;

// ===================================================
// 2. REFERENCIAS AL DOM
// ===================================================
const btnFeminista = document.getElementById("btn-feminista");
const textoInterruptor = btnFeminista?.querySelector(".interruptor-texto");

const botonesMenu = document.querySelectorAll(".menu-boton");
const vistas = document.querySelectorAll(".vista");

const btnBuscar = document.getElementById("btn-buscar");
const panelBuscar = document.getElementById("panel-buscar");
const buscador = document.getElementById("buscador");
const resultadosBusqueda = document.getElementById("resultados-busqueda");

const btnAvisos = document.getElementById("btn-avisos");
const panelAvisos = document.getElementById("panel-avisos");
const listaAvisosEl = document.getElementById("lista-avisos");

const heroSlide = document.getElementById("hero-slide");
const heroContador = document.getElementById("hero-contador");
const btnHeroAnt = document.getElementById("hero-anterior");
const btnHeroSig = document.getElementById("hero-siguiente");
const spotlight = document.getElementById("spotlight");

const filaContinua = document.getElementById("fila-continua");
const filaTendencias = document.getElementById("fila-tendencias");
const filaGenero = document.getElementById("fila-genero");
const contenedorGeneros = document.getElementById("generos");
const catalogoGrid = document.getElementById("catalogo-grid");
const catalogoTitulo = document.getElementById("catalogo-titulo");

const modalFicha = document.getElementById("modal-ficha");
const modalCerrar = document.getElementById("modal-cerrar");
const modalContenido = document.getElementById("modal-contenido");
const botonesVoto = document.querySelectorAll("[data-voto]");

// ===================================================
// 3. INTERRUPTOR DE MODO (FEMINISTA / NO FEMINISTA)
// ===================================================
function setModo(esFeminista) {
  if (esFeminista) {
    document.body.setAttribute("data-theme", "feminista");
    btnFeminista.setAttribute("aria-checked", "true");
    if (textoInterruptor) textoInterruptor.textContent = "Versión feminista";
  } else {
    document.body.setAttribute("data-theme", "no-feminista");
    btnFeminista.setAttribute("aria-checked", "false");
    if (textoInterruptor) textoInterruptor.textContent = "Versión estándar";
  }
}

btnFeminista.addEventListener("click", () => {
  const activo = btnFeminista.getAttribute("aria-checked") === "true";
  setModo(!activo);
});

// ===================================================
// 4. CAMBIO DE VISTAS (MENÚ)
// ===================================================
botonesMenu.forEach((btn) => {
  btn.addEventListener("click", () => {
    botonesMenu.forEach((b) => b.removeAttribute("aria-current"));
    btn.setAttribute("aria-current", "page");

    const vistaDestino = btn.dataset.vista;
    vistas.forEach((v) => (v.hidden = true));

    if (vistaDestino === "inicio") {
      document.getElementById("vista-inicio").hidden = false;
    } else if (vistaDestino === "que-ver") {
      document.getElementById("vista-que-ver").hidden = false;
    } else {
      document.getElementById("vista-catalogo").hidden = false;
      renderCatalogo(vistaDestino);
    }
  });
});

// ===================================================
// 5. BÚSQUEDA EN TIEMPO REAL (TMDB + LOCAL)
// ===================================================
btnBuscar.addEventListener("click", () => {
  const oculto = panelBuscar.hidden;
  panelBuscar.hidden = !oculto;
  btnBuscar.setAttribute("aria-expanded", String(oculto));
  if (oculto) buscador.focus();
});

let debounceTimer;
buscador.addEventListener("input", (e) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    const query = e.target.value.trim().toLowerCase();
    resultadosBusqueda.innerHTML = "";
    if (!query) return;

    // Buscar primero en TMDB
    let resultados = await buscarEnTMDB(query);

    // Si la API no devuelve o está offline, buscar en datos locales
    if (resultados.length === 0) {
      resultados = peliculas.filter((p) => p.titulo.toLowerCase().includes(query));
    }

    resultados.forEach((p) => {
      const li = document.createElement("li");
      li.style.padding = "0.5rem";
      li.style.cursor = "pointer";
      li.style.borderBottom = "1px solid var(--color-borde)";
      li.textContent = `${p.titulo} (${p.anio}) · ${p.tipo}`;

      li.addEventListener("click", () => {
        // Si no estaba en el catálogo, se agrega
        if (!peliculas.some((item) => item.id === p.id)) {
          peliculas.push(p);
        }
        abrirModal(p);
        panelBuscar.hidden = true;
      });
      resultadosBusqueda.appendChild(li);
    });
  }, 300);
});

// Panel de Avisos
btnAvisos.addEventListener("click", () => {
  const oculto = panelAvisos.hidden;
  panelAvisos.hidden = !oculto;
  btnAvisos.setAttribute("aria-expanded", String(oculto));

  if (oculto) {
    listaAvisosEl.innerHTML = avisos.map((aviso) => `<li>• ${aviso}</li>`).join("");
  }
});

// ===================================================
// 6. HERO SLIDER (DESTACADOS / SELECCIONADOS)
// ===================================================
function actualizarHeroLista() {
  // Priorizar películas destacadas o en la lista de seleccionadas
  listaHero = peliculas.filter((p) => p.destacada);
  if (listaHero.length === 0) listaHero = peliculas.slice(0, 3);
}

function renderHero() {
  actualizarHeroLista();
  if (listaHero.length === 0) return;

  const p = listaHero[indiceHero];
  heroSlide.innerHTML = `
    <h2>${p.titulo}</h2>
    <p style="margin: 0.5rem 0 1rem; color: var(--color-texto-atenuado);">${p.sinopsis}</p>
    <button type="button" class="menu-boton" id="btn-hero-ver" style="background: var(--color-acento); color: #ffffff;">
      Ver análisis completo
    </button>
  `;

  document.getElementById("btn-hero-ver").addEventListener("click", () => abrirModal(p));
  heroContador.textContent = `0${indiceHero + 1} / 0${listaHero.length}`;
}

btnHeroAnt.addEventListener("click", () => {
  indiceHero = (indiceHero - 1 + listaHero.length) % listaHero.length;
  renderHero();
});

btnHeroSig.addEventListener("click", () => {
  indiceHero = (indiceHero + 1) % listaHero.length;
  renderHero();
});

// ===================================================
// 7. TARJETAS, CARRUSELES Y CATÁLOGO
// ===================================================
function crearTarjeta(p) {
  const card = document.createElement("article");
  card.className = "tarjeta";
  card.style.minWidth = "210px";
  card.style.background = "var(--color-tarjeta)";
  card.style.border = "1px solid var(--color-borde)";
  card.style.borderRadius = "8px";
  card.style.padding = "0.75rem";
  card.style.cursor = "pointer";

  card.innerHTML = `
    <img src="${p.portada}" alt="${p.titulo}" loading="lazy" style="width:100%;height:280px;object-fit:cover;border-radius:6px;margin-bottom:0.6rem;">
    <h4 style="font-size:1rem;margin-bottom:0.25rem;">${p.titulo}</h4>
    <small style="color:var(--color-texto-atenuado);">${p.genero} • ${p.anio}</small>
  `;

  card.addEventListener("click", () => abrirModal(p));
  return card;
}

function renderCarruseles() {
  filaContinua.innerHTML = "";
  filaTendencias.innerHTML = "";
  filaGenero.innerHTML = "";

  peliculas.forEach((p) => {
    filaContinua.appendChild(crearTarjeta(p));
    filaTendencias.appendChild(crearTarjeta(p));
  });

  // Géneros
  const generosUnicos = [...new Set(peliculas.map((p) => p.genero).filter(Boolean))];
  contenedorGeneros.innerHTML = "";

  generosUnicos.forEach((g) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = g;
    btn.addEventListener("click", () => {
      filaGenero.innerHTML = "";
      peliculas.filter((p) => p.genero === g).forEach((p) => filaGenero.appendChild(crearTarjeta(p)));
    });
    contenedorGeneros.appendChild(btn);
  });

  // Cargar el primer género por defecto
  if (generosUnicos.length > 0) {
    peliculas.filter((p) => p.genero === generosUnicos[0]).forEach((p) => filaGenero.appendChild(crearTarjeta(p)));
  }

  // Spotlight (Obra destacada)
  const spotlightItem = peliculas.find((p) => p.destacada) || peliculas[0];
  if (spotlightItem && spotlight) {
    spotlight.innerHTML = `
      <div style="background:var(--color-tarjeta);border:1px solid var(--color-borde);border-radius:12px;padding:2rem;margin-top:2rem;">
        <span class="sobretitulo">Obra del momento</span>
        <h2 style="margin: 0.5rem 0;">${spotlightItem.titulo}</h2>
        <p style="color:var(--color-texto-atenuado);margin-bottom:1rem;">${spotlightItem.sinopsis}</p>
        <button type="button" class="menu-boton" id="btn-spotlight-ver" style="background:var(--color-acento);color:#fff;">Explorar</button>
      </div>
    `;
    document.getElementById("btn-spotlight-ver").addEventListener("click", () => abrirModal(spotlightItem));
  }
}

function renderCatalogo(categoria) {
  catalogoGrid.innerHTML = "";
  let items = [];

  if (categoria === "peliculas") {
    catalogoTitulo.textContent = "Todas las Películas";
    items = peliculas.filter((p) => p.tipo === "peliculas");
  } else if (categoria === "series") {
    catalogoTitulo.textContent = "Todas las Series";
    items = peliculas.filter((p) => p.tipo === "series");
  } else if (categoria === "mi-lista") {
    catalogoTitulo.textContent = "Mi lista guardada";
    items = peliculas.slice(0, 3);
  }

  items.forEach((p) => catalogoGrid.appendChild(crearTarjeta(p)));
}

// Flechas de desplazamiento en carrusel
document.querySelectorAll(".fila-flechas button").forEach((flecha) => {
  flecha.addEventListener("click", () => {
    const idObjetivo = flecha.dataset.objetivo;
    const carrusel = document.getElementById(idObjetivo);
    const salto = flecha.dataset.flecha === "izquierda" ? -300 : 300;
    carrusel.scrollBy({ left: salto, behavior: "smooth" });
  });
});

// ===================================================
// 8. MODAL DE FICHA Y VOTACIONES
// ===================================================
function abrirModal(p) {
  peliculaSeleccionada = p;
  modalContenido.innerHTML = `
    <h2 id="modal-titulo">${p.titulo} (${p.anio})</h2>
    <p style="margin: 0.5rem 0 1rem; color:var(--color-texto-atenuado);">${p.genero} • ${p.tipo}</p>
    <p>${p.sinopsis}</p>
  `;

  actualizarContadoresVoto();
  modalFicha.showModal();
}

modalCerrar.addEventListener("click", () => modalFicha.close());
modalFicha.addEventListener("click", (e) => {
  if (e.target === modalFicha) modalFicha.close();
});

function actualizarContadoresVoto() {
  if (!peliculaSeleccionada) return;
  document.querySelector('[data-cuenta="bechdel-si"]').textContent = peliculaSeleccionada.votos.bechdelSi;
  document.querySelector('[data-cuenta="bechdel-no"]').textContent = peliculaSeleccionada.votos.bechdelNo;
  document.querySelector('[data-cuenta="violacion-si"]').textContent = peliculaSeleccionada.votos.violacionSi;
  document.querySelector('[data-cuenta="violacion-no"]').textContent = peliculaSeleccionada.votos.violacionNo;
}

botonesVoto.forEach((btn) => {
  btn.addEventListener("click", () => {
    if (!peliculaSeleccionada) return;
    const tipo = btn.dataset.voto;
    const valor = btn.dataset.valor;

    if (tipo === "bechdel") {
      if (valor === "si") peliculaSeleccionada.votos.bechdelSi += 1;
      else peliculaSeleccionada.votos.bechdelNo += 1;
    } else if (tipo === "violacion") {
      if (valor === "si") peliculaSeleccionada.votos.violacionSi += 1;
      else peliculaSeleccionada.votos.violacionNo += 1;
    }

    actualizarContadoresVoto();
  });
});

// ===================================================
// 9. ARRANQUE E INTEGRACIÓN DE TMDB
// ===================================================
async function iniciarApp() {
  // 1. Iniciar en Modo Feminista por defecto
  setModo(true);

  // 2. Render inicial con los datos locales
  renderHero();
  renderCarruseles();

  // 3. Carga asíncrona de tendencias desde TMDB
  try {
    const pelisTMDB = await obtenerTendenciasTMDB();
    const seriesTMDB = await obtenerSeriesTMDB();

    const mapaTitulos = new Set(peliculas.map((p) => p.titulo.toLowerCase()));

    [...pelisTMDB, ...seriesTMDB].forEach((item) => {
      if (!mapaTitulos.has(item.titulo.toLowerCase())) {
        peliculas.push(item);
      }
    });

    // 4. Actualizar interfaz con el catálogo enriquecido
    renderHero();
    renderCarruseles();
  } catch (error) {
    console.warn("No se pudo conectar con TMDB, usando catálogo local.", error);
  }
}

iniciarApp();
