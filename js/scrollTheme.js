// Devuelve el progreso de scroll entre 0 y 1 (función pura)
export function getScrollProgress(scrollY, scrollHeight, viewportHeight) {
  const maxScroll = scrollHeight - viewportHeight;
  if (maxScroll <= 0) return 0;
  return Math.min(Math.max(scrollY / maxScroll, 0), 1);
}

/**
 * Escribe --scroll (0-1) en `target` mientras se desplaza la página. Se escribe solo en la capa del fondo,
 * no en <html>: así cada frame recalcula los estilos de una capa, no los de toda la página.
 * Con movimiento reducido no se activa (el CSS deja el fondo quieto).
 * @param {HTMLElement} [target=document.documentElement]
 */
export function initScrollTheme(target = document.documentElement) {
  if (!target || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const root = document.documentElement;
  let ticking = false;

  function update() {
    const progress = getScrollProgress(
      window.scrollY,
      root.scrollHeight,
      window.innerHeight
    );
    target.style.setProperty('--scroll', progress.toFixed(3));
    ticking = false;
  }

  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true }); // cambia la altura útil: se recalcula
  update();
}