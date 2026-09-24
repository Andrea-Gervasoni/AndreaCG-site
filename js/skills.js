/* ------------------------------------------------------------------
   Competenze: un mazzo di sette carte su fondo arancio. La sezione resta
   ferma sullo schermo e lo scroll sfoglia il mazzo: la carta davanti vola
   via (a sinistra, poi a destra), la successiva sale e il suo disegno si
   traccia a linea, come la firma. Col cursore la carta davanti si inclina.
   ------------------------------------------------------------------ */
const NS = 'http://www.w3.org/2000/svg';

/* viewBox 240×240 — ln: tratto d'inchiostro, acc: tratto arancio, thin: guida sottile, dot: punto pieno */
const ART = [
  /* tecnologia: < / > e un cursore che lampeggia */
  [['ln', 'M92 76 L50 120 L92 164'], ['ln', 'M148 76 L190 120 L148 164'], ['acc', 'M134 58 L106 182'],
   ['thin', 'M50 204 H118'], ['dot blink', 'M126 198 h16 v12 h-16 z']],
  /* prodotto: il ciclo costruisci → misura → migliora */
  [['acc', 'M120 48 A72 72 0 1 1 57.6 84'], ['acc', 'M44 92 L57.6 84 L57.6 100'],
   ['dot', 'M120 42 a6 6 0 1 0 0.01 0 z'], ['dot', 'M182.4 150 a6 6 0 1 0 0.01 0 z'], ['dot', 'M57.6 150 a6 6 0 1 0 0.01 0 z'],
   ['thin', 'M104 120 L116 132 L140 106']],
  /* design: una curva di Bézier con le sue maniglie */
  [['thin', 'M44 178 L82 62'], ['thin', 'M196 178 L158 62'], ['acc', 'M44 178 C82 62 158 62 196 178'],
   ['ln', 'M38 172 h12 v12 h-12 z'], ['ln', 'M190 172 h12 v12 h-12 z'],
   ['ln', 'M82 55 a7 7 0 1 0 0.01 0 z'], ['ln', 'M158 55 a7 7 0 1 0 0.01 0 z']],
  /* business: barre che crescono e la linea della crescita */
  [['ln', 'M46 50 L46 194 L204 194'], ['ln', 'M78 194 V164'], ['ln', 'M110 194 V142'], ['ln', 'M142 194 V118'], ['ln', 'M174 194 V92'],
   ['acc', 'M62 152 L98 130 L130 104 L164 76 L196 58'], ['acc', 'M180 54 L196 58 L192 74']],
  /* leadership: una persona al centro che collega le altre */
  [['ln', 'M120 108 V52'], ['ln', 'M131 116 L184 99'], ['ln', 'M127 130 L160 174'], ['ln', 'M113 130 L80 174'], ['ln', 'M109 116 L56 99'],
   ['dot pulse', 'M120 108 a12 12 0 1 0 0.01 0 z'],
   ['ln', 'M120 36 a8 8 0 1 0 0.01 0 z'], ['ln', 'M192 88.5 a8 8 0 1 0 0.01 0 z'], ['ln', 'M165 173.5 a8 8 0 1 0 0.01 0 z'], ['ln', 'M75 173.5 a8 8 0 1 0 0.01 0 z'], ['ln', 'M48 88.5 a8 8 0 1 0 0.01 0 z']],
  /* analisi: una funzione, un punto e le sue proiezioni */
  [['ln', 'M36 124 H206'], ['ln', 'M58 204 V40'], ['acc', 'M36 124 C66 40 98 40 122 124 S176 208 206 124'],
   ['thin', 'M81 61 V124'], ['thin', 'M81 61 H58'], ['dot', 'M81 54 a7 7 0 1 0 0.01 0 z']],
  /* comunicazione: un fumetto e le righe di un'idea resa leggibile */
  [['ln', 'M58 58 H182 Q200 58 200 76 V138 Q200 156 182 156 H114 L84 186 L90 156 H58 Q40 156 40 138 V76 Q40 58 58 58 Z'],
   ['ln', 'M66 90 H174'], ['ln', 'M66 110 H150'], ['acc', 'M66 130 H122']]
];

function buildArt(svg, index) {
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('class', 'art'); g.dataset.art = index;
  ART[index].forEach(([kind, d], k) => {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('class', kind === 'acc' || kind === 'thin' ? `ln ${kind}` : kind);
    p.style.setProperty('--k', k);
    g.append(p);
  });
  svg.append(g);
  return g;
}

/* le lunghezze vere, in px del disegno: niente pathLength (Safari lo gestisce male coi tratteggi) */
function measure(g) {
  g.querySelectorAll('.ln').forEach((p) => { try { p.style.setProperty('--len', Math.ceil(p.getTotalLength()) + 1); } catch (_) {} });
}

export function createSkills({ ScrollTrigger, reduced }) {
  const root = document.querySelector('[data-skills]');
  if (!root) return null;
  const cards = [...root.querySelectorAll('[data-deck-card]')];
  const deck = root.querySelector('[data-deck]');
  const ghost = root.querySelector('[data-skill-ghost]');
  const count = root.querySelector('[data-deck-count]');
  const bar = root.querySelector('[data-deck-bar]');
  const N = cards.length;
  const arts = cards.map((c, i) => { const g = buildArt(c.querySelector('.deck-art'), i); measure(g); return g; });
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  const st = { target: 0, p: 0, drawn: -1, front: -1, visible: false, tx: 0, ty: 0, x: 0, y: 0 };
  /* ogni carta resta ferma per un tratto prima di partire: il tempo di leggerla */
  const dwell = (t) => { const i = Math.floor(t), f = t - i, u = Math.min(1, Math.max(0, (f - 0.22) / 0.56)); return i + u * u * (3 - 2 * u); };

  function layout() {
    const t = dwell(st.p * (N - 1));
    const vw = innerWidth, vh = innerHeight;
    cards.forEach((card, i) => {
      const d = i - t;
      let tf, op = 1, shade = 0;
      if (d < 0) {
        /* in uscita: vola via ruotando, alternando i lati */
        const u = Math.min(1, -d), side = i % 2 ? 1 : -1, e = u * u;
        tf = `translate3d(${side * e * vw * 0.62}px, ${-u * vh * 0.16 - e * vh * 0.1}px, 0) rotate(${side * u * 16}deg) rotateY(${side * u * -22}deg)`;
        op = u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4;
      } else {
        /* nel mazzo: le carte dietro spuntano sotto, più piccole e in ombra */
        const depth = Math.min(d, 3.2);
        const tilt = i === st.front ? `rotateX(${st.y.toFixed(2)}deg) rotateY(${st.x.toFixed(2)}deg)` : '';
        tf = `translate3d(0, ${depth * 22}px, ${-depth * 40}px) scale(${1 - depth * 0.055}) ${tilt}`;
        shade = Math.min(0.55, depth * 0.2);
        op = d > 3.2 ? 0 : 1;
      }
      card.style.transform = tf;
      card.style.opacity = op.toFixed(3);
      card.style.setProperty('--shade', shade.toFixed(3));
      card.style.zIndex = String(100 - i);
    });
    const front = Math.min(N - 1, Math.round(t));
    if (front !== st.front) {
      st.front = front;
      cards.forEach((c, i) => { c.classList.toggle('is-front', i === front); c.setAttribute('aria-current', String(i === front)); });
      arts.forEach((g, i) => g.classList.toggle('is-on', i === front));
      const label = String(front + 1).padStart(2, '0');
      if (count) count.textContent = `${label} / ${String(N).padStart(2, '0')}`;
      if (ghost) { ghost.textContent = label; ghost.classList.remove('is-rolling'); void ghost.offsetWidth; ghost.classList.add('is-rolling'); }
    }
    if (bar) bar.style.transform = `scaleX(${(st.p).toFixed(4)})`;
    st.drawn = st.p;
  }

  let last = performance.now(), raf = 0;
  function frame(now) {
    raf = 0;
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
    /* lo scroll dà il bersaglio, la carta lo insegue: niente scatti con la rotella */
    st.p += (st.target - st.p) * (reduced ? 1 : 1 - Math.exp(-dt * 9));
    st.x += (st.tx - st.x) * (1 - Math.exp(-dt * 7)); st.y += (st.ty - st.y) * (1 - Math.exp(-dt * 7));
    if (Math.abs(st.target - st.p) < 1e-4) st.p = st.target;
    layout();
    if (st.visible && (st.p !== st.target || Math.abs(st.tx - st.x) + Math.abs(st.ty - st.y) > 0.01)) raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };

  ScrollTrigger.create({
    trigger: root, start: 'top top', end: 'bottom bottom',
    onUpdate: (self) => { st.target = self.progress; kick(); },
    onRefresh: (self) => { st.target = self.progress; st.p = self.progress; layout(); }
  });
  new IntersectionObserver(([e]) => { st.visible = e.isIntersecting; if (st.visible) kick(); }).observe(root);

  /* la carta davanti si inclina verso il cursore, con un riflesso che lo segue */
  if (fine && !reduced && deck) {
    deck.addEventListener('pointermove', (e) => {
      const card = cards[st.front]; if (!card) return;
      const r = card.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5, ny = (e.clientY - r.top) / r.height - 0.5;
      st.tx = nx * 9; st.ty = -ny * 7;
      card.style.setProperty('--gx', `${(nx + 0.5) * 100}%`); card.style.setProperty('--gy', `${(ny + 0.5) * 100}%`);
      card.classList.add('is-lit'); kick();
    });
    deck.addEventListener('pointerleave', () => { st.tx = 0; st.ty = 0; cards.forEach((c) => c.classList.remove('is-lit')); kick(); });
  }

  layout();
  return {
    refresh() { arts.forEach(measure); const f = st.front; st.front = -1; layout(); if (f < 0) layout(); }
  };
}
