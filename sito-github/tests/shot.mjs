#!/usr/bin/env node
/**
 * Screenshot deterministici del sito con il Chrome locale (DevTools Protocol, nessuna dipendenza).
 *
 *   node tests/shot.mjs --url http://127.0.0.1:4180/ --w 1440 --h 900 --at 0,900,1800 --out /tmp/shots [--lang en] [--mobile]
 *
 * Per ogni valore di --at la pagina viene portata a quella posizione di scroll (istantanea, senza
 * smoothing) e fotografata dopo --settle ms. Produce PNG numerati nella cartella --out.
 */
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true'] : []).filter(Boolean));
const url = args.url || 'http://127.0.0.1:4180/';
const W = +args.w || 1440, H = +args.h || 900, dpr = +args.dpr || 1;
const positions = (args.at || '0').split(',').map(Number);
const out = args.out || '/tmp/ag-shots';
const settle = +args.settle || 1400;
const chrome = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9300 + Math.floor(Math.random() * 500);
const profile = join(out, 'profile');
await mkdir(out, { recursive: true });

const proc = spawn(chrome, [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
  '--hide-scrollbars', ...(args.gpu === 'true' ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']), `--window-size=${W},${H}`, 'about:blank'
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getTarget() {
  for (let i = 0; i < 60; i++) {
    try { const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); const page = list.find((t) => t.type === 'page'); if (page) return page; } catch (_) {}
    await sleep(200);
  }
  throw new Error('Chrome non risponde');
}
const target = await getTarget();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); return r.result?.result?.value; };

await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: dpr, mobile: args.mobile === 'true' });
if (args.mobile === 'true') await send('Emulation.setTouchEmulationEnabled', { enabled: true });
if (args.reduced === 'true') await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
const errors = [];
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text); });
await send('Page.navigate', { url: url + (url.includes('?') ? '&' : '?') + 'qa=1' + (args.lang ? '&lang=' + args.lang : '') });
await sleep(2200);
await evaluate('document.fonts.ready.then(()=>true)');
if (args.pre) { await evaluate(`(async function(){ ${args.pre} })()`); await sleep(+args.presettle || 1200); }

for (const [i, y] of positions.entries()) {
  await evaluate(`(function(){ if (window.AG && AG.lenis) { AG.lenis.scrollTo(${y}, { immediate: true, force: true }); } window.scrollTo(0, ${y}); if (window.ScrollTrigger) ScrollTrigger.update(); return scrollY; })()`);
  await sleep(settle);
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const name = `${String(i).padStart(2, '0')}-y${y}.png`;
  await writeFile(join(out, name), Buffer.from(shot.result.data, 'base64'));
  const info = await evaluate('JSON.stringify({scrollY, theme: document.body.dataset.theme, heroP: window.AG && AG.scroll ? +AG.scroll.heroProgress().toFixed(3) : null})');
  console.log(name, info);
  if (args.eval) console.log('  eval:', await evaluate(`JSON.stringify((function(){ return (${args.eval}); })())`));
}
if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
const logs = await evaluate('JSON.stringify(window.__qaLogs || [])');
if (logs && logs !== '[]') console.log('LOGS:', logs);
ws.close(); proc.kill();
