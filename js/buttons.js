/* ------------------------------------------------------------------
   Tasti: un solo linguaggio di movimento per tutto il sito.
   - pressione: scende subito, torna su con una piccola molla (vale
     soprattutto al tocco, dove l'hover non esiste)
   - riempimento (.fx-fill) che parte dal punto in cui entra il cursore
     o il dito, e si ritira verso il punto in cui esce
   - magnetismo (data-magnetic) solo con un puntatore preciso
   ------------------------------------------------------------------ */
const PRESSABLE = 'button, a[href], [data-press]';

export function initButtons({ reduced }) {
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* origine del riempimento, in % della scatola */
  function origin(el, e) {
    const r = el.getBoundingClientRect();
    el.style.setProperty('--fx', `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty('--fy', `${((e.clientY - r.top) / r.height) * 100}%`);
  }
  document.addEventListener('pointerover', (e) => {
    const el = e.target.closest?.('.fx-fill');
    if (el && !el.contains(e.relatedTarget)) origin(el, e);
  });
  document.addEventListener('pointerout', (e) => {
    const el = e.target.closest?.('.fx-fill');
    if (el && !el.contains(e.relatedTarget)) origin(el, e);
  });

  /* pressione */
  let pressed = null;
  function release() {
    if (!pressed) return;
    const el = pressed; pressed = null;
    el.classList.remove('is-pressing');
    if (reduced) return;
    el.classList.remove('is-released'); void el.offsetWidth; el.classList.add('is-released');
  }
  document.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    const el = e.target.closest?.(PRESSABLE);
    if (!el || el.closest('[data-no-press]')) return;
    if (el.classList.contains('fx-fill')) origin(el, e);
    pressed = el;
    el.classList.remove('is-released');
    el.classList.add('is-pressing');
  });
  addEventListener('pointerup', release);
  addEventListener('pointercancel', release);
  addEventListener('blur', release);
  document.addEventListener('animationend', (e) => { if (e.animationName === 'press-release') e.target.classList.remove('is-released'); });
  /* un dito che parte premendo e poi scorre la pagina non deve restare "schiacciato" */
  addEventListener('scroll', release, { passive: true });

  /* magnetismo: una molla leggera che segue il cursore e torna al centro */
  if (fine && !reduced) {
    document.querySelectorAll('[data-magnetic]').forEach((el) => {
      const pull = Number(el.dataset.magnetic) || 0.22;
      const s = { x: 0, y: 0, tx: 0, ty: 0, raf: 0 };
      const step = () => {
        s.x += (s.tx - s.x) * 0.2; s.y += (s.ty - s.y) * 0.2;
        el.style.translate = `${s.x.toFixed(2)}px ${s.y.toFixed(2)}px`;
        if (Math.abs(s.tx - s.x) + Math.abs(s.ty - s.y) > 0.05) s.raf = requestAnimationFrame(step);
        else { s.raf = 0; if (!s.tx && !s.ty) el.style.translate = ''; }
      };
      const kick = () => { if (!s.raf) s.raf = requestAnimationFrame(step); };
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        s.tx = (e.clientX - (r.left + r.width / 2)) * pull;
        s.ty = (e.clientY - (r.top + r.height / 2)) * pull;
        kick();
      });
      el.addEventListener('pointerleave', () => { s.tx = 0; s.ty = 0; kick(); });
    });
  }
}

/* Cambio lingua: il testo visibile non scatta, si ricompone. */
export function animateLanguageSwap() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const vh = innerHeight;
  document.querySelectorAll('[data-i18n], [data-i18n-html]').forEach((el) => {
    if (el.closest('.title, [data-reveal-words], .sr-only')) return;
    const r = el.getBoundingClientRect();
    if (!r.width || r.bottom < 0 || r.top > vh) return;
    el.classList.remove('i18n-swap'); void el.offsetWidth; el.classList.add('i18n-swap');
  });
}
