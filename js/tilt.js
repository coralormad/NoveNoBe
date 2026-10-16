// Posición del puntero dentro de un elemento: la usan la luz de los botones y el foco del escaparate.

const MAX_GRADOS = 5;

/** Pura: posición del puntero dentro de un rectángulo → inclinación (grados) y punto de luz (%). */
export function tiltFromPointer(x, y, rect, max = MAX_GRADOS) {
  const px = Math.min(Math.max((x - rect.left) / rect.width, 0), 1);
  const py = Math.min(Math.max((y - rect.top) / rect.height, 0), 1);
  return {
    rx: (0.5 - py) * 2 * max,
    ry: (px - 0.5) * 2 * max,
    mx: px * 100,
    my: py * 100,
  };
}
