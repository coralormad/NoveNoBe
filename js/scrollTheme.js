// Devuelve el progreso de scroll entre 0 y 1 (función pura)
export function getScrollProgress(scrollY, scrollHeight, viewportHeight) {
  const maxScroll = scrollHeight - viewportHeight;
  if (maxScroll <= 0) return 0;
  return Math.min(Math.max(scrollY / maxScroll, 0), 1);
}

export function initScrollTheme() {
  const root = document.documentElement;
  let ticking = false;

  function update() {
    const progress = getScrollProgress(
      window.scrollY,
      root.scrollHeight,
      window.innerHeight
    );
    root.style.setProperty('--scroll', progress.toFixed(3));
    ticking = false;
  }

  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  update();
}