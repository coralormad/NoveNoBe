// Avisos propios de NoveNoBé (TMDB no tiene eventos).
// Cada aviso tiene versión de día (tema claro) y de noche (tema oscuro): La ventana indiscreta.
export const AVISOS = Object.freeze([
  {
    id: 'lo-que-no-se-ve',
    hasta: '2026-10-31', // AAAA-MM-DD; sin este campo, el aviso no caduca
    dia: {
      etiqueta: 'Aviso de día',
      titulo: 'De día, las persianas están bajadas',
      texto: 'Lo que pasa en el 9ºB se ve cuando apagas la luz.',
      accion: 'Apaga la luz',
      destino: 'tema',
    },
    noche: {
      etiqueta: 'Aviso de noche',
      titulo: 'Ya es de noche en el 9ºB',
      texto: 'Elige una película y escribe lo que solo tú viste.',
      accion: 'Busca una película',
      destino: 'buscar',
    },
  },
].map(Object.freeze));