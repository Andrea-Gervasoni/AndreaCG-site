/* Menu a schermo intero: apertura a cerchio dal pulsante, focus gestito, Esc per chiudere. */
export function initMenu({ onNavigate, lockScroll, unlockScroll }) {
  const menu = document.querySelector('[data-menu]');
  const button = document.querySelector('[data-menu-toggle]');
  const panel = menu?.querySelector('.menu-panel');
  if (!menu || !button || !panel) return { close() {} };
  let open = false, lastFocus = null;

  /* Tutte le voci alla stessa dimensione: quella che fa stare in una riga la voce più
     lunga (COMPETENZE, FORMAZIONE…). Voci di taglie diverse sembravano un errore.
     Si toglie dallo spazio il piccolo spostamento dell'hover, per non tagliarle mentre
     si accendono d'arancio. */
  const list = menu.querySelector('.menu-list');
  const links = [...menu.querySelectorAll('.menu-list a')];
  const names = links.map((a) => a.querySelector('.menu-name'));
  const HOVER_SHIFT = 14;
  function fitMenu() {
    if (menu.hidden) return;
    list.style.removeProperty('--menu-fs');
    const base = parseFloat(getComputedStyle(links[0]).fontSize);
    let ratio = 1;
    names.forEach((n) => { const avail = n.clientWidth - HOVER_SHIFT; if (avail > 0 && n.scrollWidth > avail) ratio = Math.min(ratio, avail / n.scrollWidth); });
    if (ratio < 1) list.style.setProperty('--menu-fs', `${base * ratio * 0.98}px`);
  }
  window.addEventListener('resize', fitMenu);

  /* la voce della sezione in cui ti trovi è già accesa quando apri il menu */
  function markCurrent() {
    const mid = innerHeight * 0.4;
    let current = null;
    links.forEach((a) => { const el = document.querySelector(a.getAttribute('href')); if (el && el.getBoundingClientRect().top <= mid) current = a; });
    links.forEach((a) => { if (a === current) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
  }

  function setOpen(next) {
    if (next === open) return;
    open = next;
    button.setAttribute('aria-expanded', String(open));
    if (open) {
      lastFocus = document.activeElement;
      menu.hidden = false;
      const r = button.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      panel.style.clipPath = `circle(0px at ${cx}px ${cy}px)`;
      requestAnimationFrame(() => {
        panel.style.transition = 'clip-path .9s cubic-bezier(.16,1,.3,1)';
        panel.style.clipPath = `circle(${Math.hypot(document.documentElement.clientWidth, document.documentElement.clientHeight) * 1.1}px at ${cx}px ${cy}px)`;
        menu.classList.add('is-open', 'is-entering');
        setTimeout(() => menu.classList.remove('is-entering'), 1100);
      });
      lockScroll?.();
      markCurrent();
      fitMenu();
      setTimeout(() => menu.querySelector('a')?.focus({ preventScroll: true }), 350);
    } else {
      const r = button.getBoundingClientRect();
      panel.style.transition = 'clip-path .6s cubic-bezier(.65,0,.35,1)';
      panel.style.clipPath = `circle(0px at ${r.left + r.width / 2}px ${r.top + r.height / 2}px)`;
      menu.classList.remove('is-open');
      setTimeout(() => { if (!open) menu.hidden = true; }, 620);
      unlockScroll?.();
      lastFocus?.focus?.({ preventScroll: true });
    }
  }

  button.addEventListener('click', () => setOpen(!open));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) setOpen(false); });
  menu.querySelectorAll('[data-menu-link]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const target = a.getAttribute('href');
      setOpen(false);
      setTimeout(() => onNavigate?.(target), 250);
    });
  });
  /* trappola del focus minima */
  menu.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const focusables = [...menu.querySelectorAll('a, button')];
    const first = focusables[0], last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); button.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); button.focus(); }
  });
  return { close: () => setOpen(false), isOpen: () => open, fit: fitMenu };
}
