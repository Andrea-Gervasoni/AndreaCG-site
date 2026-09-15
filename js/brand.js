/* ------------------------------------------------------------------
   Identità: il lockup del nome e la firma che si scrive.
   - fitLockup: "ANDREA" (serif) e "GERVASONI" (sans) vengono misurati e
     ridimensionati finché le due righe hanno esattamente la stessa
     larghezza, come nel lockup SVG di Lando.
   - createSignature: clona i tratti della firma dentro un <svg> e li
     scrive in sequenza con una penna, a velocità reale.
   ------------------------------------------------------------------ */

export async function fitLockup(svg, { width = 150 } = {}) {
  const first = svg.querySelector('[data-lockup-first]');
  const last = svg.querySelector('[data-lockup-last]');
  if (!first || !last) return;
  await document.fonts.ready;
  const measure = (text, font, stretch) => {
    const c = document.createElement('canvas').getContext('2d');
    c.font = font; try { c.fontStretch = stretch; } catch (_) {}
    return c.measureText(text).width;
  };
  const w1 = measure(first.textContent, '400 100px "Instrument Serif", Georgia, serif', 'normal');
  const w2 = measure(last.textContent, '850 100px "Mona Sans", Arial, sans-serif', 'expanded');
  if (!w1 || !w2) return;
  const s1 = (width / w1) * 100, s2 = (width / w2) * 100;
  /* altezze delle maiuscole: serif ≈ .70em, sans ≈ .72em */
  const cap1 = s1 * 0.70, cap2 = s2 * 0.72, gap = Math.max(2, s2 * 0.12);
  first.setAttribute('font-size', s1.toFixed(2)); first.setAttribute('y', cap1.toFixed(2));
  last.setAttribute('font-size', s2.toFixed(2)); last.setAttribute('y', (cap1 + gap + cap2).toFixed(2));
  for (const t of [first, last]) { t.setAttribute('textLength', width); t.setAttribute('lengthAdjust', 'spacingAndGlyphs'); }
  const h = cap1 + gap + cap2;
  svg.setAttribute('viewBox', `0 0 ${width} ${h.toFixed(2)}`);
  svg.style.aspectRatio = `${width} / ${h.toFixed(2)}`;
  svg.classList.add('is-ready');
}

/* Unisce i tratti della firma in un'unica linea continua (raccordi morbidi dove la penna si sollevava),
   la disegna in rilievo (estrusione scura sotto, luce sopra) e la scrive con una penna a velocità costante. */
function continuousPath(sourcePaths) {
  const NS = 'http://www.w3.org/2000/svg';
  const probe = document.createElementNS(NS, 'svg'); probe.setAttribute('width', '0'); probe.setAttribute('height', '0'); probe.style.position = 'absolute'; document.body.append(probe);
  const paths = [...sourcePaths].map((p) => { const c = p.cloneNode(false); c.removeAttribute('pathLength'); probe.append(c); return c; });
  let d = '';
  for (let i = 0; i < paths.length; i++) {
    const dd = paths[i].getAttribute('d').trim();
    if (i === 0) { d = dd; continue; }
    const prev = paths[i - 1], cur = paths[i];
    const Lp = prev.getTotalLength();
    const pEnd = prev.getPointAtLength(Lp), pTan = prev.getPointAtLength(Math.max(0, Lp - 14));
    const cStart = cur.getPointAtLength(0), cTan = cur.getPointAtLength(Math.min(cur.getTotalLength(), 14));
    const gap = Math.hypot(cStart.x - pEnd.x, cStart.y - pEnd.y), k = Math.min(0.45 * gap, 120);
    const t1 = norm(pEnd.x - pTan.x, pEnd.y - pTan.y), t2 = norm(cStart.x - cTan.x, cStart.y - cTan.y);
    const c1 = [pEnd.x + t1[0] * k, pEnd.y + t1[1] * k], c2 = [cStart.x + t2[0] * k, cStart.y + t2[1] * k];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${cStart.x.toFixed(1)} ${cStart.y.toFixed(1)}`;
    d += ' ' + dd.replace(/^M[^CLQ]*/, '');            /* prosegue senza sollevare la penna */
  }
  probe.remove();
  return d;
}
const norm = (x, y) => { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };

export function createSignature(svg, { gsap, speed = 900, pen = true, relief = true } = {}) {
  const NS = 'http://www.w3.org/2000/svg';
  const d = continuousPath(document.querySelectorAll('#signature-paths path'));
  /* campiona l'intera firma in punti fitti: ogni frame il tracciato disegnato è il prefisso di questa polilinea */
  const probe = document.createElementNS(NS, 'svg'); probe.style.position = 'absolute'; probe.style.width = '0'; probe.style.height = '0'; document.body.append(probe);
  const full = document.createElementNS(NS, 'path'); full.setAttribute('d', d); probe.append(full);
  const L = full.getTotalLength(), STEP = 2.5, N = Math.max(2, Math.ceil(L / STEP));
  const pts = new Float32Array((N + 1) * 2);
  for (let i = 0; i <= N; i++) { const q = full.getPointAtLength((i / N) * L); pts[i * 2] = q.x; pts[i * 2 + 1] = q.y; }
  probe.remove();
  const prefix = (n) => { let out = `M${pts[0].toFixed(1)} ${pts[1].toFixed(1)}`; for (let i = 1; i <= n; i++) out += `L${pts[i * 2].toFixed(1)} ${pts[i * 2 + 1].toFixed(1)}`; return out; };

  svg.replaceChildren();
  const make = (cls) => { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', 'M0 0'); p.setAttribute('class', cls); p.setAttribute('fill', 'none'); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round'); svg.append(p); return p; };
  const layers = [];
  if (relief) for (let i = 6; i >= 1; i--) { const p = make('sig-side'); p.setAttribute('transform', `translate(${i * 1.6} ${i * 2.1})`); layers.push(p); }
  layers.push(make('sig-face'));
  const hi = make('sig-hi'); hi.setAttribute('transform', 'translate(-1.5 -2.2)'); layers.push(hi);
  let dot = null;
  if (pen) { dot = document.createElementNS(NS, 'circle'); dot.setAttribute('r', '7'); dot.setAttribute('class', 'sig-pen'); dot.style.opacity = '0'; svg.append(dot); }

  let drawn = -1;
  const draw = (n) => {
    n = Math.max(0, Math.min(N, Math.round(n)));
    if (n === drawn) return; drawn = n;
    const dd = n === 0 ? 'M0 0' : prefix(n);
    layers.forEach((p) => p.setAttribute('d', dd));
    if (dot) { dot.setAttribute('cx', pts[n * 2].toFixed(1)); dot.setAttribute('cy', pts[n * 2 + 1].toFixed(1)); }
  };
  const state = { n: 0 };
  const tl = gsap.timeline({ paused: true, onStart: () => { if (dot) dot.style.opacity = '1'; }, onComplete: () => { if (dot) gsap.to(dot, { opacity: 0, duration: .3 }); } });
  tl.to(state, { n: N, duration: L / speed, ease: 'none', onUpdate: () => draw(state.n) });
  draw(0);
  return {
    play() { tl.play(); },
    replay() { if (dot) dot.style.opacity = '1'; tl.restart(); },
    reset(animated = false) { if (animated) tl.reverse(); else { tl.pause(0); draw(0); if (dot) dot.style.opacity = '0'; } },
    get progress() { return tl.progress(); },
    get active() { return tl.isActive(); },
    get done() { return tl.progress() >= 1; },
    duration: tl.duration(),
    timeline: tl
  };
}
