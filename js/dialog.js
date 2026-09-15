/* Scheda di dettaglio di un progetto: testi dalla tabella, oggetto 3D montato dentro. */
import { SITE } from './data.js';
import { t, getLanguage } from './i18n.js';

const KEY = { postilla: 'p1', orizzonte: 'p2', formularium: 'p3' };

export function initProjectDialog({ objects, lockScroll, unlockScroll }) {
  const root = document.querySelector('[data-pdialog]');
  if (!root) return { close() {} };
  const objSlot = root.querySelector('[data-pdialog-obj]');
  const fields = { tag: root.querySelector('[data-pd="tag"]'), name: root.querySelector('[data-pd="name"]'), deck: root.querySelector('[data-pd="deck"]'), facts: root.querySelector('[data-pd="facts"]'), links: root.querySelector('[data-pd="links"]') };
  let current = null, lastFocus = null;

  function fill(name) {
    const k = KEY[name]; if (!k) return;
    fields.tag.textContent = t(`${k}.tag`);
    fields.name.textContent = t(`${k}.name`);
    fields.deck.textContent = t(`${k}.deck`);
    fields.facts.innerHTML = '';
    for (let i = 1; i <= 4; i++) {
      const row = document.createElement('div');
      const dt = document.createElement('dt'); dt.textContent = t(`${k}.f${i}.k`);
      const dd = document.createElement('dd'); dd.textContent = t(`${k}.f${i}.v`);
      row.append(dt, dd); fields.facts.append(row);
    }
    fields.links.innerHTML = '';
    const links = SITE.projects[name];
    if (links?.live) { const a = document.createElement('a'); a.href = links.live; a.target = '_blank'; a.rel = 'noreferrer'; a.className = 'is-primary'; a.textContent = t('projects.visit') + ' ↗'; fields.links.append(a); }
    if (links?.code) { const a = document.createElement('a'); a.href = links.code; a.target = '_blank'; a.rel = 'noreferrer'; a.textContent = t('projects.code') + ' ↗'; fields.links.append(a); }
    if (!links) { const s = document.createElement('span'); s.className = 'kicker'; s.textContent = getLanguage() === 'it' ? 'Prototipo · demo su richiesta' : 'Prototype · demo on request'; fields.links.append(s); }
  }

  function open(name) {
    current = name; lastFocus = document.activeElement;
    fill(name);
    root.hidden = false;
    requestAnimationFrame(() => root.classList.add('is-open'));
    objects?.mountDialog(name, objSlot);
    lockScroll?.(); document.body.classList.add('is-locked');
    setTimeout(() => root.querySelector('[data-pdialog-close]')?.focus({ preventScroll: true }), 50);
  }
  function close() {
    if (!current) return;
    current = null;
    root.classList.remove('is-open');
    objects?.unmountDialog();
    setTimeout(() => { if (!current) root.hidden = true; }, 420);
    unlockScroll?.(); document.body.classList.remove('is-locked');
    lastFocus?.focus?.({ preventScroll: true });
  }

  document.querySelectorAll('[data-open-project]').forEach((b) => b.addEventListener('click', () => open(b.dataset.openProject)));
  root.querySelectorAll('[data-pdialog-close]').forEach((b) => b.addEventListener('click', close));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && current) close(); });
  return { open, close, refresh() { if (current) fill(current); }, isOpen: () => !!current };
}
