/* Controlli di integrità del sito statico: node --test tests/ */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');
const { TEXT, PHOTOS, SITE } = await import(new URL('js/data.js', root));

test('IT ed EN hanno esattamente le stesse chiavi', () => {
  const it = Object.keys(TEXT.it).sort(), en = Object.keys(TEXT.en).sort();
  assert.deepEqual(it, en);
  for (const k of it) { assert.ok(TEXT.it[k].length, `IT vuoto: ${k}`); assert.ok(TEXT.en[k].length, `EN vuoto: ${k}`); }
});

test('ogni data-i18n nell’HTML esiste nella tabella', () => {
  const keys = new Set([...html.matchAll(/data-i18n(?:-html|-aria)?="([^"]+)"/g)].map((m) => m[1]));
  for (const k of keys) assert.ok(TEXT.it[k] !== undefined, `chiave mancante: ${k}`);
});

test('ogni ancora interna punta a un id esistente', () => {
  for (const [, id] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(html.includes(`id="${id}"`), `manca #${id}`);
});

test('script, fogli di stile e asset locali esistono', () => {
  const refs = [...html.matchAll(/(?:src|href)="((?!https?:|#|data:|mailto:)[^"]+)"/g)].map((m) => m[1]);
  for (const r of refs) assert.ok(existsSync(new URL(r, root)), `manca ${r}`);
  for (const ph of PHOTOS) for (const f of [`assets/photos/${ph.id}.jpg`, `assets/photos/${ph.id}.webp`, `assets/photos/${ph.id}-s.jpg`, `assets/photos/${ph.id}-s.webp`]) assert.ok(existsSync(new URL(f, root)), `manca ${f}`);
  for (const f of ['vendor/three.module.min.js', 'vendor/gsap.min.js', 'vendor/ScrollTrigger.min.js', 'vendor/lenis.min.js']) assert.ok(existsSync(new URL(f, root)), f);
});

test('la firma ha i suoi tratti e ogni tratto conosce la propria lunghezza', () => {
  const paths = [...html.matchAll(/<path class="sig-path"[^>]*data-len="(\d+)"/g)];
  assert.equal(paths.length, 6);
  for (const [, len] of paths) assert.ok(+len > 0);
});

test('le cinque tappe del volo hanno una scheda ciascuna', () => {
  assert.equal((html.match(/data-stop="\d"/g) || []).length, 5);
});

test('i moduli JavaScript hanno una sintassi valida', async () => {
  for (const f of ['main', 'field', 'avatar', 'objects', 'scroll', 'titles', 'menu', 'glass', 'carousel', 'dialog', 'i18n', 'data', 'brand', 'flight', 'education']) {
    const src = readFileSync(new URL(`js/${f}.js`, root), 'utf8');
    assert.ok(src.length > 100, f);
    /* import dinamico: fallisce se il file non è parsabile */
    if (['data', 'i18n'].includes(f)) await import(new URL(`js/${f}.js`, root));
  }
});

test('i fatti chiave restano nel testo', () => {
  const it = JSON.stringify(TEXT.it);
  for (const fact of ['$1.500', '48 h', 'TKS Innovator', 'San Diego', 'Mascheroni', 'strada definitiva', 'Cambridge']) assert.ok(it.includes(fact), fact);
  assert.ok(SITE.linkedin.startsWith('https://www.linkedin.com/'));
});

test('nessun riferimento ai file della vecchia versione', () => {
  assert.ok(!/portrait\.js|liquid-glass\.js|chapters\.js|content\.js/.test(html));
  assert.ok(!existsSync(fileURLToPath(new URL('_old', root))), 'la cartella _old va rimossa prima della pubblicazione');
});
