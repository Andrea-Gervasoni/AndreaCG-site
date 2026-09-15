/* ------------------------------------------------------------------
   IT / EN. Ogni elemento con data-i18n="chiave" riceve il testo dalla
   tabella in data.js; data-i18n-html per i valori con markup;
   data-i18n-aria per aria-label. La scelta viene ricordata.
   ------------------------------------------------------------------ */
import { TEXT } from './data.js';

const STORAGE = 'ag-lang';
let current = 'it';
const listeners = new Set();

export function detectLanguage() {
  try { const saved = localStorage.getItem(STORAGE); if (saved === 'it' || saved === 'en') return saved; } catch (_) {}
  const nav = (navigator.language || 'it').toLowerCase();
  return nav.startsWith('it') ? 'it' : 'en';
}

export function t(key, lang = current) {
  const table = TEXT[lang] || TEXT.it;
  return table[key] ?? TEXT.it[key] ?? '';
}

export function getLanguage() { return current; }

export function applyLanguage(lang, { silent = false } = {}) {
  current = lang === 'en' ? 'en' : 'it';
  const table = TEXT[current];
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const v = table[el.dataset.i18n]; if (v !== undefined) el.textContent = v;
  });
  document.querySelectorAll('[data-i18n-html]').forEach((el) => {
    const v = table[el.dataset.i18nHtml]; if (v !== undefined) el.innerHTML = v;
  });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    const v = table[el.dataset.i18nAria]; if (v !== undefined) el.setAttribute('aria-label', v);
  });
  document.documentElement.lang = current;
  document.body.dataset.lang = current;
  document.title = table['meta.title'];
  document.querySelector('meta[name="description"]')?.setAttribute('content', table['meta.description']);
  const toggle = document.querySelector('[data-lang-toggle]');
  if (toggle) {
    toggle.dataset.lang = current;
    toggle.querySelectorAll('[data-lang-opt]').forEach((o) => o.setAttribute('aria-current', String(o.dataset.langOpt === current)));
    toggle.setAttribute('aria-label', table['nav.lang.aria']);
  }
  try { localStorage.setItem(STORAGE, current); } catch (_) {}
  if (!silent) listeners.forEach((fn) => fn(current));
}

export function onLanguageChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function initLanguageToggle() {
  const toggle = document.querySelector('[data-lang-toggle]');
  toggle?.addEventListener('click', () => applyLanguage(current === 'it' ? 'en' : 'it'));
}
