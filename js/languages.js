/* ------------------------------------------------------------------
   Lingue: un saluto grande che si ricompone lettera per lettera nelle
   quattro lingue (Ciao → Hello → Hola → 你好), in sincrono con il riquadro
   che "sta parlando" e con il globo, che ruota verso quel paese e traccia
   l'arco da Bergamo. Toccare o puntare un riquadro lo fa parlare subito.
   ------------------------------------------------------------------ */
import { createGlobe } from './globe.js';

const EVERY = 3600;

export function createLanguages({ reduced, lang = 'it' }) {
  const root = document.querySelector('[data-langs]');
  if (!root) return null;
  const word = root.querySelector('[data-hello-word]');
  const meta = root.querySelector('[data-hello-meta]');
  const rows = [...root.querySelectorAll('[data-lang-row]')];
  const canvas = root.querySelector('[data-globe]');
  const globe = canvas ? createGlobe(canvas, { reduced, lang }) : null;
  let index = -1, timer = 0, visible = false, holdUntil = 0;

  function slot(text, cjk) {
    const el = document.createElement('span');
    el.className = 'hello-slot' + (cjk ? ' is-cjk' : '');
    const chars = [...text, cjk ? '。' : '.'];
    chars.forEach((ch, c) => {
      const i = document.createElement('i');
      i.textContent = ch; i.style.setProperty('--c', c);
      if (c === chars.length - 1) i.className = 'hello-dot';
      el.append(i);
    });
    return el;
  }

  function metaText(row) {
    return `${row.querySelector('h3')?.textContent || ''} · ${row.querySelector('.lang-level')?.textContent || ''}`;
  }

  function speak(i, { instant = false } = {}) {
    if (i === index) return;
    index = i;
    const row = rows[i];
    rows.forEach((r, k) => r.classList.toggle('is-speaking', k === i));
    globe?.focus(row.dataset.code);
    const next = slot(row.dataset.hello, row.hasAttribute('data-cjk'));
    if (instant || reduced) { word.replaceChildren(next); }
    else {
      word.querySelectorAll('.hello-slot:not(.is-out)').forEach((old) => {
        old.classList.remove('is-in'); old.classList.add('is-out');
        setTimeout(() => old.remove(), 900);
      });
      next.classList.add('is-in'); word.append(next);
    }
    if (meta) {
      meta.textContent = metaText(row);
      if (!instant && !reduced) { meta.classList.remove('i18n-swap'); void meta.offsetWidth; meta.classList.add('i18n-swap'); }
    }
  }

  function tick() {
    timer = 0;
    if (!visible || reduced) return;
    if (performance.now() >= holdUntil) speak((index + 1) % rows.length);
    timer = setTimeout(tick, EVERY);
  }
  function start() { if (!timer && !reduced) timer = setTimeout(tick, EVERY); }
  function stop() { clearTimeout(timer); timer = 0; }

  new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); }, { threshold: 0.25 }).observe(root);

  rows.forEach((row, i) => {
    const hold = () => { holdUntil = performance.now() + 5200; speak(i); };
    row.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') hold(); });
    row.addEventListener('click', hold);
  });

  speak(0, { instant: true });
  return {
    refresh(l) { if (meta && rows[index]) meta.textContent = metaText(rows[index]); if (l) globe?.setLanguage(l); }
  };
}
