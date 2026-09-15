/* ------------------------------------------------------------------
   Carosello a ventaglio: le foto sono carte disposte su un arco, quella
   al centro è dritta e in primo piano. Trascina, usa le frecce, la rotella
   orizzontale o la tastiera; da solo avanza piano quando nessuno lo tocca.
   ------------------------------------------------------------------ */
import { PHOTOS } from './data.js';

export function createFan(root, { lang = 'it', gsap } = {}) {
  const stage = root.querySelector('[data-fan-stage]');
  const caption = root.querySelector('[data-fan-caption]');
  const counter = root.querySelector('[data-fan-counter]');
  const prev = root.querySelector('[data-fan-prev]');
  const next = root.querySelector('[data-fan-next]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* carte */
  stage.replaceChildren();
  const cards = PHOTOS.map((ph, i) => {
    const card = document.createElement('figure');
    card.className = 'fan-card'; card.dataset.index = i;
    const pic = document.createElement('picture');
    const src = document.createElement('source'); src.type = 'image/webp';
    src.srcset = `assets/photos/${ph.id}-s.webp 540w, assets/photos/${ph.id}.webp 1050w`; src.sizes = '(max-width: 860px) 62vw, 26vw';
    const img = document.createElement('img');
    img.src = `assets/photos/${ph.id}.jpg`; img.srcset = `assets/photos/${ph.id}-s.jpg 540w, assets/photos/${ph.id}.jpg 1050w`; img.sizes = '(max-width: 860px) 62vw, 26vw';
    img.width = ph.w; img.height = ph.h; img.loading = i < 4 ? 'eager' : 'lazy'; img.decoding = 'async'; img.draggable = false; img.alt = ph[lang] || ph.it;
    const n = document.createElement('span'); n.className = 'fan-n'; n.textContent = String(i + 1).padStart(2, '0');
    pic.append(src, img); card.append(pic, n); stage.append(card);
    card.addEventListener('click', () => { if (Math.abs(dragDist) < 6) { let d = i - st.pos; d = ((d % N) + N) % N; if (d > N / 2) d -= N; goTo(Math.round(st.pos + d)); } });
    return card;
  });
  const N = cards.length;

  const st = { pos: 0, target: 0, vel: 0, dragging: false, lastX: 0, lastT: 0, idle: 0, hover: false, w: 0 };
  let dragDist = 0;
  const geo = () => {
    const narrow = root.clientWidth < 860 || innerHeight < 560;
    const cardW = cards[0]?.offsetWidth || 300;
    const radius = narrow ? Math.max(1400, root.clientWidth * 3.2) : Math.max(2400, root.clientWidth * 2.1);
    /* passo angolare tale che le carte si sovrappongano di circa un quinto */
    const step = (cardW * 0.82 / radius) * 180 / Math.PI;
    return { step, radius, lift: narrow ? 0.5 : 0.5 };
  };

  function layout() {
    const { step, radius, lift } = geo();
    const active = ((Math.round(st.pos) % N) + N) % N;
    for (let i = 0; i < N; i++) {
      /* distanza ciclica: il ventaglio è infinito, ci sono sempre carte da entrambi i lati */
      let d = i - st.pos; d = ((d % N) + N) % N; if (d > N / 2) d -= N;
      const ang = d * step;
      const abs = Math.abs(d);
      const scale = 1 - Math.min(0.18, abs * 0.045);
      const op = abs > 5.2 ? 0 : 1 - Math.max(0, abs - 3.4) * 0.5;
      cards[i].style.transform = `translate(-50%, -50%) rotate(${ang}deg) translateY(${-radius}px) scale(${scale})`;
      cards[i].style.opacity = String(op);
      cards[i].style.zIndex = String(100 - Math.round(abs * 10));
      cards[i].classList.toggle('is-active', i === active);
      cards[i].style.pointerEvents = op > 0.05 ? 'auto' : 'none';
    }
    stage.style.setProperty('--lift', lift); stage.style.setProperty('--fan-r', radius + 'px');
    const ph = PHOTOS[active];
    if (caption && ph) caption.textContent = ph[lang] || ph.it;
    if (counter) counter.textContent = `${String(active + 1).padStart(2, '0')} / ${String(N).padStart(2, '0')}`;
  }

  function goTo(i) { st.target = i; st.idle = 0; }
  prev?.addEventListener('click', () => goTo(Math.round(st.target) - 1));
  next?.addEventListener('click', () => goTo(Math.round(st.target) + 1));
  root.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(Math.round(st.target) - 1); } if (e.key === 'ArrowRight') { e.preventDefault(); goTo(Math.round(st.target) + 1); } });

  /* trascinamento */
  stage.addEventListener('pointerdown', (e) => { st.dragging = true; st.lastX = e.clientX; st.lastT = performance.now(); dragDist = 0; st.vel = 0; stage.setPointerCapture?.(e.pointerId); stage.classList.add('is-dragging'); });
  stage.addEventListener('pointermove', (e) => {
    if (!st.dragging) return;
    const dx = e.clientX - st.lastX, now = performance.now(), dt = Math.max(1, now - st.lastT);
    const per = Math.max(120, root.clientWidth * 0.18);   /* px per carta */
    st.pos -= dx / per; st.target = st.pos; st.vel = -(dx / per) / dt * 1000; st.lastX = e.clientX; st.lastT = now; dragDist += Math.abs(dx); st.idle = 0;
  });
  const endDrag = () => { if (!st.dragging) return; st.dragging = false; stage.classList.remove('is-dragging'); st.target = Math.round(st.pos + st.vel * 0.12); };
  stage.addEventListener('pointerup', endDrag); stage.addEventListener('pointercancel', endDrag); stage.addEventListener('lostpointercapture', endDrag);
  /* rotella orizzontale (trackpad) */
  let wheelAcc = 0;
  stage.addEventListener('wheel', (e) => { if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return; e.preventDefault(); wheelAcc += e.deltaX; if (Math.abs(wheelAcc) > 60) { goTo(Math.round(st.target) + Math.sign(wheelAcc)); wheelAcc = 0; } }, { passive: false });
  root.addEventListener('pointerenter', () => { st.hover = true; }); root.addEventListener('pointerleave', () => { st.hover = false; });

  let last = performance.now(), visible = true;
  const io = new IntersectionObserver((en) => { visible = en[0]?.isIntersecting ?? true; }, { threshold: 0.05 });
  io.observe(root);
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!visible) return;
    if (!st.dragging) {
      st.pos += (st.target - st.pos) * (1 - Math.exp(-dt * 7));
      st.idle += dt;
      if (!reduced && !st.hover && st.idle > 4.5) { goTo(Math.round(st.target) + 1); }
    }
    layout();
  }
  function relabel(l) { lang = l; cards.forEach((c, i) => { c.querySelector('img').alt = PHOTOS[i][l] || PHOTOS[i].it; }); layout(); }
  layout();
  return { frame, goTo, relabel, get index() { return ((Math.round(st.pos) % N) + N) % N; } };
}
