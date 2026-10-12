// Inclinación de las tarjetas que sigue al cursor.
// Solo con ratón y sin movimiento reducido: en táctil no hay cursor que seguir.

const MAX_GRADOS = 5;
const MOVIMIENTO_OK = window.matchMedia(
  '(any-hover: hover) and (any-pointer: fine) and (prefers-reduced-motion: no-preference)'
);
const PROPIEDADES = ['--rx', '--ry', '--mx', '--my'];

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

/** Activa la inclinación con delegación: un único listener para todas las tarjetas, también las futuras. */
export function enableCardTilt(root = document) {
  let frame = 0;

  root.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse' || !MOVIMIENTO_OK.matches) return;
    const link = event.target.closest('.tarjeta-enlace');
    if (!link) return;

    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      // Medimos el <article>, que no gira: medir el enlace inclinado daría un rectángulo deformado
      const rect = link.closest('.tarjeta').getBoundingClientRect();
      const { rx, ry, mx, my } = tiltFromPointer(event.clientX, event.clientY, rect);
      link.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
      link.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
      link.style.setProperty('--mx', `${mx.toFixed(1)}%`);
      link.style.setProperty('--my', `${my.toFixed(1)}%`);
    });
  });

  root.addEventListener('pointerout', (event) => {
    const link = event.target.closest('.tarjeta-enlace');
    if (link && !link.contains(event.relatedTarget)) {
      PROPIEDADES.forEach((prop) => link.style.removeProperty(prop));
    }
  });
}