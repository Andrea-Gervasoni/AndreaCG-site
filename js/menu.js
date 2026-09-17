/* Menu a schermo intero: apertura a cerchio dal pulsante, focus gestito, Esc per chiudere. */
export function initMenu({ onNavigate, lockScroll, unlockScroll }) {
  const menu = document.querySelector('[data-menu]');
  const button = document.querySelector('[data-menu-toggle]');
  const panel = menu?.querySelector('.menu-panel');
  if (!menu || !button || !panel) return { close() {} };
  let open = false, lastFocus = null;

  /* la dimensione in CSS (clamp legato all'altezza) non sa quanto è largo lo schermo:
     su mobile le voci più lunghe (ESPERIENZE, FORMAZIONE…) uscivano dal bordo.
     Qui si misura ogni voce e, se non ci sta, si restringe il font finché non entra. */
  const links = [...menu.querySelectorAll('.menu-list a')];
  /* la voce si sposta di qualche px al passaggio/tocco (:hover): si toglie quel margine
     dallo spazio disponibile PRIMA di calcolare la dimensione, altrimenti una voce
     lunga già al limite usciva dal bordo (tagliata) proprio mentre si accende d'arancio */
  const HOVER_SHIFT = 10;
  function fitMenu() {
    links.forEach((a) => {
      a.style.fontSize = '';
      const avail = a.clientWidth - HOVER_SHIFT;
      const full = a.scrollWidth;
      if (avail > 0 && full > avail) {
        const base = parseFloat(getComputedStyle(a).fontSize);
        a.style.fontSize = (base * (avail / full) * 0.97) + 'px';
      }
    });
  }
  window.addEventListener('resize', fitMenu);

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
        menu.classList.add('is-open');
      });
      lockScroll?.();
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
