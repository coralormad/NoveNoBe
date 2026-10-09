// Coloca aquí tu clave de TMDB (v3 API key)
export const TMDB_API_KEY = "3afd3119f6a994c509baa39b8c576708"; 
const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";

// Títulos o IDs que tú quieras destacar manualmente como aclamados o comentados
export const TITULOS_CURADOS = [
  "Promising Young Woman",
  "Mad Max: Fury Road",
  "Fleabag",
  "Portrait of a Lady on Fire",
  "The Assistant"
];

// 1. Obtener películas populares o en tendencia desde TMDB
export async function obtenerTendenciasTMDB() {
  try {
    const res = await fetch(`${BASE_URL}/trending/movie/week?api_key=${TMDB_API_KEY}&language=es-ES`);
    const data = await res.json();
    return formatearResultados(data.results || [], "peliculas");
  } catch (error) {
    console.error("Error al cargar tendencias de TMDB:", error);
    return [];
  }
}

// 2. Obtener series populares
export async function obtenerSeriesTMDB() {
  try {
    const res = await fetch(`${BASE_URL}/trending/tv/week?api_key=${TMDB_API_KEY}&language=es-ES`);
    const data = await res.json();
    return formatearResultados(data.results || [], "series");
  } catch (error) {
    console.error("Error al cargar series de TMDB:", error);
    return [];
  }
}

// 3. Buscar cualquier película o serie en tiempo real en todo el catálogo de TMDB
export async function buscarEnTMDB(query) {
  if (!query) return [];
  try {
    const res = await fetch(`${BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&language=es-ES&query=${encodeURIComponent(query)}`);
    const data = await res.json();
    const validos = (data.results || []).filter(r => r.media_type === "movie" || r.media_type === "tv");
    return formatearResultados(validos);
  } catch (error) {
    console.error("Error al buscar en TMDB:", error);
    return [];
  }
}

// 4. Adaptar el formato de TMDB al formato que usa tu aplicación
function formatearResultados(items, tipoPorDefecto = "peliculas") {
  return items.map((item) => {
    const esPeli = item.title !== undefined;
    const titulo = item.title || item.name;
    const esCurada = TITULOS_CURADOS.some(t => t.toLowerCase() === titulo.toLowerCase());

    return {
      id: item.id,
      titulo: titulo,
      tipo: esPeli ? "peliculas" : "series",
      genero: "Popular",
      anio: (item.release_date || item.first_air_date || "").slice(0, 4) || "N/A",
      portada: item.poster_path 
        ? `${IMAGE_BASE_URL}${item.poster_path}` 
        : "https://via.placeholder.com/500x750?text=Sin+Imagen",
      sinopsis: item.overview || "Sin descripción disponible.",
      destacada: esCurada,
      // Votos iniciales para la perspectiva de género
      votos: { bechdelSi: 0, bechdelNo: 0, violacionSi: 0, violacionNo: 0 }
    };
  });
}
