/* ------------------------------------------------------------------
   Regia dello scroll.
   - Lenis rende lo scorrimento fluido, GSAP ScrollTrigger lo misura.
   - Hero: il quadro chiaro si chiude in una card, fuori compare lo strato
     scuro con le parole, la firma si scrive, poi tutto sale via.
   - Tema chiaro/scuro del sito, topbar, timeline orizzontale, parallasse.
   ------------------------------------------------------------------ */
import { splitWords } from './titles.js';

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const range = (p, a, b) => clamp01((p - a) / (b - a));
const smooth = (t) => t * t * (3 - 2 * t);
const easeInOut = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const VW = () => document.documentElement.clientWidth || innerWidth;
const VH = () => document.documentElement.clientHeight || innerHeight;

export function initScroll({ field, gsap, ScrollTrigger, lenis, signature, flight, education }) {
  const body = document.body;
  const topbar = document.querySelector('[data-topbar]');
  const state = { bodyDark: false, overDark: 0, heroP: 0 };

  function applyTopbar() { topbar.dataset.onDark = String(state.bodyDark || state.overDark > 0 || (state.heroP > 0.1 && state.heroP < 1)); }
  function setTheme(dark) {
    state.bodyDark = dark;
    body.dataset.theme = dark ? 'dark' : 'light';
    field?.setTheme(dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#161923' : '#f3f1ea');
    applyTopbar();
  }

  /* ---------- Hero ---------- */
  const hero = document.querySelector('[data-hero]');
  const panel = document.querySelector('[data-panel]');
  const stage = document.querySelector('[data-avatar-stage]');
  const ui = document.querySelector('[data-hero-ui]');
  const note = document.querySelector('[data-note]');
  const marquees = [...document.querySelectorAll('.marquee')];
  const sig = document.querySelector('[data-signature]');
  const sigState = { played: false };

  function cardSize(vw, vh) {
    if (vw < 860 || vh < 560) { const w = Math.min(vw * 0.8, 520); return [w, Math.min(w * 1.12, vh * 0.7)]; }
    const w = Math.min(vw * 0.44, 640); return [w, Math.min(w * 0.68, vh * 0.66)];
  }

  function updateHero(p) {
    state.heroP = p;
    const vw = VW(), vh = VH();
    const close = easeInOut(range(p, 0.04, 0.52));
    const exit = smooth(range(p, 0.70, 0.86));   /* card e firma salgono; poi restano solo le parole a scorrere nel nero */
    const [cw, ch] = cardSize(vw, vh);
    const x = ((vw - cw) / 2) * close, y = ((vh - ch) / 2) * close;
    const r = 28 * close;
    const rise = -exit * vh * 1.05;
    panel.style.clipPath = `inset(${y}px ${x}px round ${r}px)`;
    panel.style.transform = `translate3d(0, ${rise}px, 0)`;
    field?.setRect(x, y + rise, vw - 2 * x, vh - 2 * y, r, exit >= 1 ? 0 : 1);
    /* l'avatar si stringe restando centrato nella card */
    const s = 1 - 0.40 * close;
    stage.style.transform = `translate3d(0, ${close * vh * 0.045}px, 0) scale(${s})`;
    ui.style.opacity = String(1 - range(p, 0, 0.1));
    ui.style.pointerEvents = p > 0.05 ? 'none' : '';
    /* parole dietro */
    const nOp = range(p, 0.06, 0.28);
    note.style.opacity = String(nOp);
    note.style.visibility = nOp > 0 ? 'visible' : 'hidden';
    const ms = 1.06 - 0.06 * smooth(range(p, 0.06, 0.4));
    marquees.forEach((m) => { m.style.transform = `scale(${ms})`; });
    /* firma: quando il quadro è quasi chiuso la penna comincia a scrivere, a velocità reale */
    if (signature) {
      if (p > 0.26 && !sigState.played) { signature.replay(); sigState.played = true; }
      if (p < 0.16 && sigState.played) { signature.reset(false); sigState.played = false; }
      /* chi scorre veloce non deve perdersi la firma: lo scroll fa da pavimento alla penna */
      if (sigState.played && !signature.done) { const floor = range(p, 0.28, 0.6); if (floor > signature.progress) signature.timeline.progress(floor); }
    }
    sig.style.opacity = String(p > 0.2 ? 1 : 0);
    sig.style.transform = `translate(-50%, calc(-52% + ${rise}px)) scale(${0.92 + 0.08 * close})`;
    resolveTheme();
    applyTopbar();
  }

  /* Il tema dipende solo dalla posizione: scuro dalla fine della hero fino ai numeri di "Chi sono", poi chiaro. */
  const switchEl = document.querySelector('[data-theme-switch]');
  function resolveTheme() {
    const y = lenis.scroll ?? scrollY, vh = VH();
    const heroEnd = hero.offsetTop + hero.offsetHeight - vh;
    const swY = switchEl ? switchEl.getBoundingClientRect().top + y - vh * 0.72 : heroEnd;
    const inHero = y < heroEnd - 2;                    /* dentro la hero il quadro gestisce chiaro/scuro */
    const dark = inHero ? false : y < swY;
    if (dark !== state.bodyDark) setTheme(dark);
    field?.setTheme(inHero ? state.heroP > 0.02 : dark);
  }
  /* scrub con un piccolo ritardo (invece di 1:1 con la rotella): chi scorre veloce
     non salta la firma, l'animazione la insegue e recupera in una frazione di secondo */
  ScrollTrigger.create({ trigger: hero, start: 'top top', end: 'bottom bottom', scrub: 0.45, onUpdate: (self) => updateHero(self.progress), onRefresh: (self) => updateHero(self.progress) });
  updateHero(0);
  lenis.on('scroll', resolveTheme);
  ScrollTrigger.addEventListener('refresh', resolveTheme);

  /* ---------- Chi sono: parole che si accendono ---------- */
  const statement = document.querySelector('[data-reveal-words]');
  let words = [];
  function bindStatement() {
    words = splitWords(statement);
  }
  bindStatement();
  ScrollTrigger.create({
    trigger: statement, start: 'top 82%', end: 'bottom 40%', scrub: true,
    onUpdate: (self) => { const n = Math.round(self.progress * words.length); words.forEach((w, i) => w.classList.toggle('is-on', i < n)); }
  });

  /* Blocchi scuri sotto la topbar */
  document.querySelectorAll('[data-dark-block], .footer-card').forEach((el) => {
    ScrollTrigger.create({
      trigger: el, start: 'top 60px', end: 'bottom 60px',
      onEnter: () => { state.overDark++; applyTopbar(); }, onLeave: () => { state.overDark--; applyTopbar(); },
      onEnterBack: () => { state.overDark++; applyTopbar(); }, onLeaveBack: () => { state.overDark--; applyTopbar(); }
    });
  });

  /* ---------- Esperienze: lo scroll guida il volo ---------- */
  const exp = document.querySelector('[data-experience]');
  if (exp && flight) {
    ScrollTrigger.create({ trigger: exp, start: 'top top', end: 'bottom bottom', scrub: 0.5, onUpdate: (self) => flight.setProgress(self.progress), onRefresh: (self) => flight.setProgress(self.progress) });
  }
  /* ---------- Formazione: la pila cresce con lo scroll, su ogni schermo (la scena è pinnata) ---------- */
  const edu = document.querySelector('[data-education]');
  if (edu && education) {
    ScrollTrigger.create({ trigger: edu, start: 'top top', end: 'bottom bottom', scrub: 0.6, onUpdate: (self) => education.setProgress(self.progress), onRefresh: (self) => education.setProgress(self.progress) });
  }

  /* ---------- Ingressi semplici ---------- */
  const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { threshold: 0.18 });
  document.querySelectorAll('[data-rise], .lang').forEach((el) => io.observe(el));

  /* ---------- Topbar: si nasconde scendendo veloce, torna risalendo ---------- */
  let lastY = 0;
  lenis.on('scroll', ({ scroll, direction, velocity }) => {
    if (scroll < VH() * 2.4) { topbar.classList.remove('is-hidden'); lastY = scroll; return; }
    if (direction === 1 && velocity > 1.5 && scroll - lastY > 40) { topbar.classList.add('is-hidden'); lastY = scroll; }
    else if (direction === -1) { topbar.classList.remove('is-hidden'); lastY = scroll; }
  });

  /* ---------- Marquee: velocità legata allo scroll ---------- */
  const tracks = marquees.map((m) => ({ el: m.querySelector('.marquee-track'), dir: +m.dataset.marquee || 1, x: 0, w: 0 }));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function marqueeFrame(dt, velocity) {
    if (reduced) return;
    for (const tr of tracks) {
      if (!tr.w) tr.w = tr.el.scrollWidth / (tr.el.children.length) * (tr.el.children.length / 2);
      if (tr.el.offsetParent === null && note.style.visibility === 'hidden') continue;
      const speed = 40 + Math.min(600, Math.abs(velocity) * 22);
      tr.x += tr.dir * speed * dt;
      const half = tr.el.scrollWidth / 2;
      if (tr.x > 0) tr.x -= half; if (tr.x < -half) tr.x += half;
      tr.el.style.transform = `translate3d(${tr.x}px,0,0)`;
    }
  }

  /* ---------- Magnetico ---------- */
  document.querySelectorAll('[data-magnetic]').forEach((el) => {
    el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(); const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); el.style.transform = `translate(${dx * 0.22}px, ${dy * 0.22}px)`; });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });

  return {
    setTheme,
    marqueeFrame,
    heroProgress: () => state.heroP,
    rebindStatement() { bindStatement(); ScrollTrigger.refresh(); },
    refresh: () => ScrollTrigger.refresh()
  };
}
