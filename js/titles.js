/* ------------------------------------------------------------------
   Titoli di sezione: ognuno entra a modo suo.
   particles → si forma da particelle · flap → tabellone a palette
   stamp → timbro · wave → onda · chalk → si disegna il contorno
   orbit → gira dentro da un anello · morph → passa per altre lingue
   ------------------------------------------------------------------ */
import { LANGUAGE_MORPH } from './data.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789·—';

/* Divide il testo in parole e caratteri, senza rompere le parole a capo. */
export function splitChars(el) {
  const text = el.textContent;
  el.dataset.text = text;
  el.textContent = '';
  let i = 0;
  const frag = document.createDocumentFragment();
  for (const word of text.split(' ')) {
    const w = document.createElement('span'); w.className = 'word';
    for (const ch of [...word]) {
      const c = document.createElement('span'); c.className = 'ch'; c.textContent = ch; c.style.setProperty('--i', i++);
      w.append(c);
    }
    frag.append(w, document.createTextNode(' '));
  }
  frag.lastChild.remove();
  el.append(frag);
  el.setAttribute('aria-label', text);
  return [...el.querySelectorAll('.ch')];
}

/* Divide in parole conservando i tag inline (em, strong). */
export function splitWords(el) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const parts = node.nodeValue.split(/(\s+)/);
    const frag = document.createDocumentFragment();
    for (const part of parts) {
      if (!part) continue;
      if (/^\s+$/.test(part)) { frag.append(document.createTextNode(part)); continue; }
      const s = document.createElement('span'); s.className = 'w'; s.textContent = part; frag.append(s);
    }
    node.replaceWith(frag);
  }
  return [...el.querySelectorAll('.w')];
}

const effects = {
  rise(el) { el.classList.add('is-in'); },
  stamp(el) { el.classList.add('is-in'); },
  wave(el) { el.classList.add('is-in'); },
  orbit(el) { el.classList.add('is-in'); },

  flap(el, chars) {
    el.classList.add('is-in');
    chars.forEach((c, i) => {
      const final = c.textContent;
      if (final.trim() === '') return;
      const flips = 5 + Math.floor(i * 0.6);
      let n = 0;
      const step = () => {
        n++;
        c.classList.remove('is-flipping'); void c.offsetWidth; c.classList.add('is-flipping');
        setTimeout(() => { c.textContent = n >= flips ? final : ALPHABET[Math.floor(Math.random() * ALPHABET.length)]; }, 90);
        if (n < flips) setTimeout(step, 150);
      };
      setTimeout(step, i * 55);
    });
  },

  particles(el, chars) {
    const rect = el.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(rect.width * dpr); canvas.height = Math.ceil(rect.height * dpr);
    canvas.style.width = rect.width + 'px'; canvas.style.height = rect.height + 'px';
    el.append(canvas);
    const ctx = canvas.getContext('2d');
    /* campiona i glifi: disegna ogni carattere alla sua posizione reale */
    const off = document.createElement('canvas'); off.width = canvas.width; off.height = canvas.height;
    const octx = off.getContext('2d');
    const cs = getComputedStyle(el);
    /* il font shorthand del canvas non accetta lo stretch in percentuale: si passa a parte */
    octx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    try { const st = parseFloat(cs.fontStretch); octx.fontStretch = st >= 118 ? 'expanded' : st >= 106 ? 'semi-expanded' : 'normal'; } catch (_) {}
    octx.textBaseline = 'alphabetic'; octx.fillStyle = '#000';
    octx.scale(dpr, dpr);
    for (const c of chars) {
      const r = c.getBoundingClientRect();
      const fs = parseFloat(cs.fontSize);
      /* baseline ≈ top del box del carattere + ascender (0.88em con line-height .88) */
      octx.fillText(c.textContent, r.left - rect.left, r.top - rect.top + fs * 0.86);
    }
    const data = octx.getImageData(0, 0, off.width, off.height).data;
    const fs = parseFloat(cs.fontSize);
    const step = Math.max(2, Math.round(fs * dpr / 30));
    const targets = [];
    for (let y = 0; y < off.height; y += step) for (let x = 0; x < off.width; x += step) {
      if (data[(y * off.width + x) * 4 + 3] > 128) targets.push(x, y);
    }
    const N = targets.length / 2;
    const P = new Float32Array(N * 6); /* x, y, sx, sy, delay, size */
    const color = cs.color;
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#ff6a2b';
    for (let i = 0; i < N; i++) {
      const tx = targets[i * 2], ty = targets[i * 2 + 1];
      const a = Math.random() * Math.PI * 2, d = (0.4 + Math.random()) * Math.max(canvas.width, canvas.height) * 0.9;
      P[i * 6] = tx; P[i * 6 + 1] = ty;
      P[i * 6 + 2] = tx + Math.cos(a) * d; P[i * 6 + 3] = ty + Math.sin(a) * d * 0.6;
      P[i * 6 + 4] = Math.random() * 0.35; P[i * 6 + 5] = (0.6 + Math.random() * 0.9) * step * 0.55;
    }
    const D = 1.9, start = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    const finish = () => { el.style.setProperty('--pv', 1); el.classList.add('is-in'); canvas.style.transition = 'opacity .5s'; canvas.style.opacity = '0'; setTimeout(() => canvas.remove(), 600); };
    const guard = setTimeout(finish, (D + 0.8) * 1000);
    if (N < 40) { clearTimeout(guard); finish(); return; }
    function draw(now) {
      const t = Math.min(1, (now - start) / 1000 / D);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = color;
      for (let i = 0; i < N; i++) {
        const k = ease(Math.max(0, Math.min(1, (t - P[i * 6 + 4]) / (1 - 0.35))));
        const x = P[i * 6 + 2] + (P[i * 6] - P[i * 6 + 2]) * k;
        const y = P[i * 6 + 3] + (P[i * 6 + 1] - P[i * 6 + 3]) * k;
        /* piccola vibrazione mentre viaggiano */
        const j = (1 - k) * step * 1.5;
        ctx.globalAlpha = 0.25 + 0.75 * k;
        if (i % 9 === 0) ctx.fillStyle = accent; else ctx.fillStyle = color;
        ctx.fillRect(x + (Math.random() - 0.5) * j, y + (Math.random() - 0.5) * j, P[i * 6 + 5], P[i * 6 + 5]);
      }
      if (t < 1) requestAnimationFrame(draw);
      else { clearTimeout(guard); finish(); }
    }
    requestAnimationFrame(draw);
  },

  chalk(el) {
    const fits = el.scrollWidth <= el.clientWidth + 2;
    if (!fits) { el.dataset.title = 'rise'; el.style.color = ''; el.classList.add('is-in'); return; }
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    const text = document.createElementNS(NS, 'text');
    const fs = parseFloat(getComputedStyle(el).fontSize);
    text.setAttribute('x', '0'); text.setAttribute('y', String(fs * 0.86));
    text.textContent = el.dataset.text || el.textContent;
    const len = text.textContent.length * fs * 2.6;
    text.style.strokeDasharray = len; text.style.strokeDashoffset = len;
    svg.append(text); el.append(svg); el.classList.add('has-svg');
    requestAnimationFrame(() => el.classList.add('is-in'));
  },

  morph(el, chars) {
    const finalText = el.dataset.text || el.textContent;
    const seq = LANGUAGE_MORPH.filter((w) => w !== finalText).concat(finalText);
    el.classList.add('is-in', 'is-morphing');
    let i = 0;
    const show = (word) => {
      const words = el.querySelectorAll('.word'); words.forEach((w) => w.remove());
      const w = document.createElement('span'); w.className = 'word';
      [...word].forEach((ch, k) => { const c = document.createElement('span'); c.className = 'ch'; c.textContent = ch; c.style.setProperty('--i', k); c.style.animation = `morphin .28s ${k * 30}ms both`; w.append(c); });
      el.append(w);
    };
    const tick = () => {
      show(seq[i]);
      if (i === seq.length - 1) { el.classList.remove('is-morphing'); return; }
      i++; setTimeout(tick, i === seq.length - 1 ? 420 : 340);
    };
    tick();
  }
};

/* animazione per i caratteri del morph (iniettata una volta) */
const style = document.createElement('style');
style.textContent = '@keyframes morphin{0%{opacity:0;transform:translateY(.2em) scale(.9)}100%{opacity:1;transform:none}}';
document.head.append(style);

const played = new WeakSet();

function prepare(el) {
  const type = el.dataset.title;
  el.querySelectorAll('canvas, svg').forEach((n) => n.remove());
  el.classList.remove('is-in', 'is-morphing', 'has-svg');
  el.style.removeProperty('--pv');
  const chars = ['rise', 'stamp', 'chalk'].includes(type) ? [] : splitChars(el);
  if (type === 'chalk') el.dataset.text = el.textContent;
  return chars;
}

function play(el) {
  const type = el.dataset.title;
  if (reduced || !effects[type]) { el.classList.add('is-in'); el.style.setProperty('--pv', 1); return; }
  played.add(el);
  const chars = [...el.querySelectorAll('.ch')];
  effects[type](el, chars);
}

export function initTitles() {
  const titles = [...document.querySelectorAll('.title[data-title]')];
  titles.forEach(prepare);
  /* soglia bassa e nessun margine negativo: una sezione corta (es. Contatti, appena
     prima del footer) può attraversare la sua "finestra" di visibilità in un solo
     scatto di rotellina — con una soglia più alta capitava di scorrere oltre senza
     che il titolo si mostrasse mai. */
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting && !played.has(e.target)) { play(e.target); io.unobserve(e.target); }
    }
  }, { threshold: 0, rootMargin: '0px 0px -2% 0px' });
  titles.forEach((t) => io.observe(t));
  /* rete di sicurezza: una sezione corta scavalcata da uno scroll molto rapido può
     restare invisibile per tutto il fotogramma in cui l'osservatore avrebbe dovuto
     accorgersene. Se un titolo finisce sopra lo schermo senza essere mai comparso,
     lo si mostra comunque invece di lasciarlo bianco per sempre. */
  addEventListener('scroll', () => {
    for (const t of titles) {
      if (played.has(t)) continue;
      if (t.getBoundingClientRect().bottom < 0) { play(t); io.unobserve(t); }
    }
  }, { passive: true });

  /* al cambio lingua: ritaglia di nuovo; se già visto, mostra subito lo stato finale (o rigioca se in vista) */
  return {
    refresh() {
      for (const el of titles) {
        const wasPlayed = played.has(el);
        prepare(el);
        if (!wasPlayed) continue;
        const r = el.getBoundingClientRect();
        const visible = r.bottom > 0 && r.top < innerHeight;
        if (visible) play(el);
        else { el.classList.add('is-in'); el.style.setProperty('--pv', 1); }
      }
    }
  };
}
