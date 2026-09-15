/* ------------------------------------------------------------------
   Vetro liquido. Tre ingredienti:
   1. sfocatura + saturazione del fondo (CSS)
   2. riflesso speculare che segue il cursore (variabili --mx/--my)
   3. rifrazione vera del bordo, dove il browser sa applicare un filtro SVG
      al backdrop (Chromium): una mappa di spostamento "a lente" generata qui.
   ------------------------------------------------------------------ */

function lensMap(size = 160, strength = 0.9) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const nx = (x / (size - 1)) * 2 - 1, ny = (y / (size - 1)) * 2 - 1;
    const r = Math.pow(Math.pow(Math.abs(nx), 4) + Math.pow(Math.abs(ny), 4), 0.25);
    const f = smooth(0.5, 1.0, r) * strength;
    const i = (y * size + x) * 4;
    img.data[i] = Math.round(128 + nx * f * 120);
    img.data[i + 1] = Math.round(128 + ny * f * 120);
    img.data[i + 2] = 128; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}

export function initGlass() {
  const isChromium = !!navigator.userAgentData?.brands?.some((b) => /Chromium/i.test(b.brand)) || (/Chrome\//.test(navigator.userAgent) && !/Edg\//.test(navigator.userAgent) && !/OPR\//.test(navigator.userAgent));
  const supportsUrl = CSS.supports('backdrop-filter', 'url(#x)') || CSS.supports('-webkit-backdrop-filter', 'url(#x)');
  if (isChromium && supportsUrl) {
    const NS = 'http://www.w3.org/2000/svg';
    const defs = document.querySelector('.svg-defs defs');
    const filter = document.createElementNS(NS, 'filter');
    filter.setAttribute('id', 'liquid-lens');
    filter.setAttribute('x', '0'); filter.setAttribute('y', '0'); filter.setAttribute('width', '100%'); filter.setAttribute('height', '100%');
    filter.setAttribute('color-interpolation-filters', 'sRGB');
    const img = document.createElementNS(NS, 'feImage');
    img.setAttribute('href', lensMap()); img.setAttribute('result', 'map');
    img.setAttribute('x', '0'); img.setAttribute('y', '0'); img.setAttribute('width', '100%'); img.setAttribute('height', '100%');
    img.setAttribute('preserveAspectRatio', 'none');
    const disp = document.createElementNS(NS, 'feDisplacementMap');
    disp.setAttribute('in', 'SourceGraphic'); disp.setAttribute('in2', 'map'); disp.setAttribute('scale', '22');
    disp.setAttribute('xChannelSelector', 'R'); disp.setAttribute('yChannelSelector', 'G');
    filter.append(img, disp); defs?.append(filter);
    document.documentElement.classList.add('has-refraction');
  }

  /* riflesso che segue il cursore */
  let px = -1, py = -1, ticking = false;
  const elements = () => document.querySelectorAll('.glass, .glass-heavy');
  function update() {
    ticking = false;
    for (const el of elements()) {
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > innerHeight + 200 || r.width === 0) continue;
      const mx = ((px - r.left) / r.width) * 100, my = ((py - r.top) / r.height) * 100;
      el.style.setProperty('--mx', Math.max(-40, Math.min(140, mx)) + '%');
      el.style.setProperty('--my', Math.max(-40, Math.min(140, my)) + '%');
    }
  }
  addEventListener('pointermove', (e) => { px = e.clientX; py = e.clientY; if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  /* feedback alla pressione */
  document.addEventListener('pointerdown', (e) => { const g = e.target.closest?.('.glass'); if (g) { g.classList.add('is-pressed'); } });
  document.addEventListener('pointerup', () => document.querySelectorAll('.glass.is-pressed').forEach((g) => g.classList.remove('is-pressed')));
  document.addEventListener('pointercancel', () => document.querySelectorAll('.glass.is-pressed').forEach((g) => g.classList.remove('is-pressed')));
}
