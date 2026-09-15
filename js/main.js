/* ------------------------------------------------------------------
   Punto d'ingresso. Ordine: lingua → sfondo → avatar → scroll → resto.
   Un solo ciclo di rendering muove tutto il WebGL della pagina.
   ------------------------------------------------------------------ */
import { createField } from './field.js';
import { createAvatar } from './avatar.js';
import { createProjectObjects } from './objects.js';
import { detectLanguage, applyLanguage, initLanguageToggle, onLanguageChange, getLanguage } from './i18n.js';
import { initTitles } from './titles.js';
import { initMenu } from './menu.js';
import { initGlass } from './glass.js';
import { createFan } from './carousel.js';
import { initProjectDialog } from './dialog.js';
import { initScroll } from './scroll.js';
import { fitLockup, createSignature } from './brand.js';
import { createFlight } from './flight.js';
import { createEducation } from './education.js';

const { gsap, ScrollTrigger, Lenis } = window;
gsap.registerPlugin(ScrollTrigger);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
history.scrollRestoration = 'manual';

/* --- lingua (?lang=en forza la lingua, utile per i test) --- */
const params = new URLSearchParams(location.search);
window.__qaLogs = [];
addEventListener('error', (e) => window.__qaLogs.push(String(e.message)));
addEventListener('unhandledrejection', (e) => window.__qaLogs.push('rejection: ' + String(e.reason)));
applyLanguage(params.get('lang') === 'en' ? 'en' : params.get('lang') === 'it' ? 'it' : detectLanguage(), { silent: true });
initLanguageToggle();

/* --- scroll fluido --- */
const lenis = new Lenis({ lerp: 0.085, smoothWheel: !reduced, wheelMultiplier: 0.95, touchMultiplier: 1.3 });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);
const lockScroll = () => lenis.stop();
const unlockScroll = () => lenis.start();
function scrollToTarget(hash) {
  if (!hash || hash === '#top') { lenis.scrollTo(0, { duration: 1.4 }); return; }
  const el = document.querySelector(hash); if (!el) return;
  const pinned = ['#experience', '#education'].includes(hash);
  lenis.scrollTo(el, { offset: pinned ? 0 : -(matchMedia('(max-width: 860px)').matches ? 78 : 12), duration: 1.5 });
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]'); if (!a || a.hasAttribute('data-menu-link')) return;
  e.preventDefault(); scrollToTarget(a.getAttribute('href'));
});

/* --- WebGL --- */
const field = createField(document.getElementById('field'));
const heroCanvas = document.getElementById('avatar');
const avatar = createAvatar(heroCanvas, { framing: 'hero' });
const footerCanvas = document.getElementById('avatar-footer');
const footerAvatar = footerCanvas ? createAvatar(footerCanvas, { framing: 'footer' }) : null;
const expSection = document.querySelector('[data-experience]');
const flight = expSection ? createFlight({ canvas: expSection.querySelector('[data-flight-canvas]'), section: expSection, cards: [...expSection.querySelectorAll('.xcard')], progressBar: expSection.querySelector('[data-exp-progress]') }) : null;
const eduSection = document.querySelector('[data-education]');
const education = eduSection ? createEducation({ canvas: eduSection.querySelector('[data-edu-canvas]') }) : null;
if (education) {
  const items = [...eduSection.querySelectorAll('.edu-item')], index = [...eduSection.querySelectorAll('[data-edu-index] li')];
  education.onStep((k) => {
    items.forEach((el, i) => el.classList.toggle('is-current', i === k));
    index.forEach((el, i) => { el.classList.toggle('is-current', i === k); el.classList.toggle('is-done', i < k); });
  });
}
const grid = document.querySelector('[data-projects-grid]');
const objects = grid ? createProjectObjects({ canvas: grid.querySelector('[data-objects-canvas]'), grid, slots: grid.querySelectorAll('[data-object]') }) : null;

/* puntatore → avatar (solo quando la hero è in vista) */
let pointerOn = 0;
addEventListener('pointermove', (e) => {
  const W = document.documentElement.clientWidth || innerWidth, H = document.documentElement.clientHeight || innerHeight;
  const nx = (e.clientX / W) * 2 - 1, ny = (e.clientY / H) * 2 - 1;
  pointerOn = 1;
  avatar.setPointer(nx, ny, 1);
  education?.setPointer(nx, ny);
  if (footerAvatar) { const r = footerCanvas.getBoundingClientRect(); footerAvatar.setPointer(((e.clientX - (r.left + r.width / 2)) / W) * 2.4, ((e.clientY - (r.top + r.height / 2)) / H) * 2.4, 1); }
}, { passive: true });
document.addEventListener('mouseleave', () => { avatar.releasePointer(); footerAvatar?.releasePointer(); });
heroCanvas.addEventListener('click', () => avatar.wave());
document.querySelector('[data-wave]')?.addEventListener('click', () => footerAvatar?.wave());
footerCanvas?.addEventListener('click', () => footerAvatar?.wave());

/* --- badge TKS: inclinazione col cursore, riflesso, giro al tocco --- */
const badge = document.querySelector('[data-badge]');
if (badge) {
  badge.addEventListener('pointermove', (e) => {
    const r = badge.getBoundingClientRect(), nx = (e.clientX - r.left) / r.width - 0.5, ny = (e.clientY - r.top) / r.height - 0.5;
    badge.style.setProperty('--ry', `${nx * 26}deg`); badge.style.setProperty('--rx', `${-ny * 22}deg`);
    badge.style.setProperty('--mx', `${(nx + 0.5) * 100}%`); badge.style.setProperty('--my', `${(ny + 0.5) * 100}%`);
  });
  badge.addEventListener('pointerleave', () => { badge.style.setProperty('--ry', '0deg'); badge.style.setProperty('--rx', '0deg'); });
}

/* --- moduli UI --- */
initGlass();
const titles = initTitles();
const menu = initMenu({ onNavigate: scrollToTarget, lockScroll, unlockScroll });
const dialog = initProjectDialog({ objects, lockScroll, unlockScroll });
const fanEl = document.querySelector('[data-fan]');
const fan = fanEl ? createFan(fanEl, { lang: getLanguage(), gsap }) : null;
const signature = createSignature(document.querySelector('[data-signature]'), { gsap, speed: 2600 });
const scroll = initScroll({ field, gsap, ScrollTrigger, lenis, signature, flight, education });
fitLockup(document.querySelector('[data-lockup]'), { width: 150 });

/* --- cambio lingua: aggiorna ciò che dipende dal testo --- */
onLanguageChange((lang) => {
  titles.refresh();
  fan?.relabel(lang);
  dialog.refresh();
  scroll.rebindStatement();
});

/* --- visibilità: rendiamo solo ciò che si vede --- */
const visible = new Map();
const vio = new IntersectionObserver((entries) => entries.forEach((e) => visible.set(e.target, e.isIntersecting)), { rootMargin: '10% 0px' });
[document.querySelector('[data-hero]'), grid, expSection, eduSection, document.querySelector('[data-footer]')].forEach((el) => el && vio.observe(el));
const isVisible = (el) => visible.get(el) !== false;
const heroEl = document.querySelector('[data-hero]');
const footerEl = document.querySelector('[data-footer]');

/* --- ciclo unico --- */
let last = performance.now(), t = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  t += dt;
  field?.frame(now);
  scroll.marqueeFrame(dt, lenis.velocity || 0);
  if (isVisible(heroEl) && scroll.heroProgress() < 1) { avatar.setOrbiterVisible(scroll.heroProgress() < 0.1); avatar.frame(now, dt); }
  if (objects && isVisible(grid)) objects.frame(now, dt, t);
  else objects?.frame(now, dt, t); /* la scheda di dettaglio può essere aperta ovunque */
  if (flight && isVisible(expSection)) flight.frame(now, dt);
  fan?.frame(now);
  if (education && isVisible(eduSection)) education.frame(now, dt);
  if (footerAvatar && isVisible(footerEl)) footerAvatar.frame(now, dt);
}
requestAnimationFrame(loop);

/* --- avvio --- */
const boot = document.querySelector('[data-boot]');
const bar = boot?.querySelector('.boot-bar i');
const bootSign = boot ? createSignature(boot.querySelector('[data-boot-sign]'), { gsap, speed: reduced ? 100000 : 4200, relief: false }) : null;
bar?.style.setProperty('--p', 0.15);
bootSign?.play();
const started = performance.now();
Promise.all([Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1800))]), new Promise((r) => setTimeout(r, 300))]).then(() => {
  bar?.style.setProperty('--p', 1);
  const minimum = reduced ? 300 : (bootSign ? bootSign.duration * 1000 + 250 : 800);
  const wait = Math.max(0, minimum - (performance.now() - started));
  setTimeout(() => {
    boot?.classList.add('is-done');
    boot?.setAttribute('aria-hidden', 'true');
    ScrollTrigger.refresh();
    if (!reduced) setTimeout(() => avatar.wave(), 450);
  }, wait);
});
addEventListener('load', () => ScrollTrigger.refresh());

window.AG = { field, avatar, footerAvatar, objects, flight, education, fan, lenis, scroll, menu, dialog };
