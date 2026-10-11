// Avisos y eventos propios de NoveNoBé (TMDB no tiene eventos).
// Alimentan el hero y el panel de la campana: una sola fuente de datos.
export const AVISOS = Object.freeze([
  {
    id: 'lo-que-no-se-ve',
    etiqueta: 'Aviso de NoveNoBé',
    titulo: 'Ya puedes contar lo que no se ve',
    texto: 'Tras ver una película, responde a «Lo que no se ve» y suma tu mirada a la comunidad.',
    accion: 'Cómo funciona',
    hasta: '2026-10-31', // formato AAAA-MM-DD; sin este campo, el aviso no caduca
  },
].map(Object.freeze));