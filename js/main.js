import { peliculas, avisos } from "../data/movies.js";

// ==========================================
// 1. ESTADO GLOBAL
// ==========================================
let peliculaSeleccionada = null;
let indiceHero = 0;
const listaHero = peliculas.filter((p) => p.destacada);

// ==========================================
// 2. REFERENCIAS AL DOM
// ==========================================
const btnFeminista = document.getElementById("btn-feminista");
const textoInterruptor = btnFeminista.querySelector(".interruptor-texto");

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

// ==========================================
// 3. INTERRUPTOR DE MODO
// ==========================================
function setModo(esFeminista) {
  if (esFeminista) {
    document.body.setAttribute("data-theme", "feminista");
    btnFeminista.setAttribute("aria-checked", "true");
    textoInterruptor.textContent = "Versión feminista";
  } else {
    document.body.setAttribute("data-theme", "no-feminista");
    btnFeminista.setAttribute("aria-checked", "false");
    textoInterruptor.textContent = "Versión estándar";
  }
}

btnFeminista.addEventListener("click", () => {
  const activo = btnFeminista.getAttribute("aria-checked") === "true";
  setModo(!activo);
});

// ==========================================
// 4. CAMBIO DE VISTAS (MENÚ)
// ==========================================
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

// ==========================================
// 5. PANELES DESPLEGABLES (BUSCADOR Y AVISOS)
// ==========================================
btnBuscar.addEventListener("click", () => {
  const oculto = panelBuscar.hidden;
  panelBuscar.hidden = !oculto;
  btnBuscar.setAttribute("aria-expanded", String(oculto));
  if (oculto) buscador.focus();
});

buscador.addEventListener("input", (e) => {
  const q = e.target.value.toLowerCase().trim();
  resultadosBusqueda.innerHTML = "";
  if (!q) return;

  const filtradas = peliculas.filter((p) => p.titulo.toLowerCase().includes(q));
  filtradas.forEach((p) => {
    const li = document.createElement("li");
    li.style.cursor = "pointer";
    li.textContent = `${p.titulo} (${p.anio}) - ${p.tipo}`;
    li.addEventListener("click", () => {
      abrirModal(p);
      panelBuscar.hidden = true;
    });
    resultadosBusqueda.appendChild(li);
  });
});

btnAvisos.addEventListener("click", () => {
  const oculto = panelAvisos.hidden;
  panelAvisos.hidden = !oculto;
  btnAvisos.setAttribute("aria-expanded", String(oculto));

  if (oculto) {
    listaAvisosEl.innerHTML = avisos.map((aviso) => `<li>• ${aviso}</li>`).join("");
  }
});

// ==========================
// 6. HERO SLIDER
// ==========================
function renderHero() {
  if (listaHero.length === 0) return;
  const p = listaHero[indiceHero];
  heroSlide.innerHTML = `
    <h2>${p.titulo}</h2>
    <p>${p.sinopsis}</p>
    <button type="button" class="menu-boton" style="margin-top:1rem;background:var(--color-acento);color:#fff;" id="btn-hero-ver">Ver ficha</button>
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

// ==========================================
// 7. CARRUSELES Y CATÁLOGO
// ==========================================
function crearTarjeta(p) {
  const card = document.createElement("article");
  card.className = "tarjeta-pelicula";
  card.style.minWidth = "200px";
  card.style.background = "var(--color-tarjeta)";
  card.style.border = "1px solid var(--color-borde)";
  card.style.borderRadius = "8px";
  card.style.padding = "0.75rem";
  card.style.cursor = "pointer";

  card.innerHTML = `
    <img src="${p.portada}" alt="${p.titulo}" style="width:100%;height:260px;object-fit:cover;border-radius:6px;margin-bottom:0.5rem;">
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
    filaGenero.appendChild(crearTarjeta(p));
  });

  // Géneros disponibles
  const generosUnicos = [...new Set(peliculas.map((p) => p.genero))];
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
    items = peliculas.slice(0, 2);
  }

  items.forEach((p) => catalogoGrid.appendChild(crearTarjeta(p)));
}

// Flechas de carrusel horizontal
document.querySelectorAll(".fila-flechas button").forEach((flecha) => {
  flecha.addEventListener("click", () => {
    const idObjetivo = flecha.dataset.objetivo;
    const carrusel = document.getElementById(idObjetivo);
    const desplazamiento = flecha.dataset.flecha === "izquierda" ? -280 : 280;
    carrusel.scrollBy({ left: desplazamiento, behavior: "smooth" });
  });
});

// ==========================================
// 8. MODAL DE FICHA Y VOTACIONES
// ==========================================
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

// ==========================================
// 9. INICIALIZACIÓN AL CARGAR
// ==========================================
setModo(true); // Arranca en modo feminista
renderHero();
renderCarruseles();
