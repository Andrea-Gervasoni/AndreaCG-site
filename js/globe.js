/* ------------------------------------------------------------------
   Globo a puntini (canvas 2D, niente WebGL in più). Ruota verso il paese
   della lingua attiva e traccia un arco da Bergamo: San Diego per
   l'inglese (la vacanza studio), Madrid per lo spagnolo, Pechino per il
   cinese. Proiezione ortografica, solo l'emisfero visibile.
   ------------------------------------------------------------------ */
import { isLand } from './globe-land.js';

const RAD = Math.PI / 180;
export const PLACES = {
  it: { name: 'Bergamo', lat: 45.698, lon: 9.677 },
  en: { name: 'San Diego', lat: 32.715, lon: -117.161 },
  es: { name: 'Madrid', lat: 40.417, lon: -3.704 },
  zh: { name: 'Pechino', nameEn: 'Beijing', lat: 39.904, lon: 116.407 }
};
const HOME = PLACES.it;

const vec = (lat, lon) => { const p = lat * RAD, l = lon * RAD; return [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)]; };
const toLatLon = ([x, y, z]) => [Math.atan2(z, Math.hypot(x, y)) / RAD, Math.atan2(y, x) / RAD];
function slerp(a, b, t) {
  const d = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])), w = Math.acos(d);
  if (w < 1e-6) return a.slice();
  const s = Math.sin(w), k1 = Math.sin((1 - t) * w) / s, k2 = Math.sin(t * w) / s;
  return [a[0] * k1 + b[0] * k2, a[1] * k1 + b[1] * k2, a[2] * k1 + b[2] * k2];
}

/* punti di terra su una griglia quasi uniforme (passo ~2°, righe sfalsate) */
function landDots(step = 2.1) {
  const out = [];
  let row = 0;
  for (let lat = -56; lat <= 80; lat += step, row++) {
    const dl = step / Math.max(0.2, Math.cos(lat * RAD));
    for (let lon = -180 + (row % 2) * dl / 2; lon < 180; lon += dl) {
      if (isLand(lat, lon)) out.push([Math.sin(lat * RAD), Math.cos(lat * RAD), lon * RAD]);
    }
  }
  return out;
}

export function createGlobe(canvas, { reduced = false, lang = 'it' } = {}) {
  const ctx = canvas.getContext('2d');
  const dots = landDots();
  const st = {
    lon: HOME.lon, lat: 38, vlon: 0, vlat: 0, tlon: HOME.lon, tlat: 38,
    px: 0, py: 0, tpx: 0, tpy: 0,
    code: 'it', arc: 0, t: 0, w: 0, h: 0, dpr: 1, visible: false, raf: 0
  };

  function resize() {
    const r = canvas.getBoundingClientRect();
    st.dpr = Math.min(devicePixelRatio || 1, 2);
    st.w = Math.round(r.width * st.dpr); st.h = Math.round(r.height * st.dpr);
    if (canvas.width !== st.w || canvas.height !== st.h) { canvas.width = st.w; canvas.height = st.h; }
  }

  /* centro della vista: tra Bergamo e la meta, con una latitudine che mostri bene l'emisfero nord */
  function viewFor(code) {
    if (code === 'it') return [38, HOME.lon];
    const p = PLACES[code];
    const [la, lo] = toLatLon(slerp(vec(HOME.lat, HOME.lon), vec(p.lat, p.lon), 0.5));
    return [Math.min(42, Math.max(18, la)), lo];
  }

  function focus(code) {
    if (!PLACES[code] || code === st.code && st.arc > 0) return;
    st.code = code; st.arc = 0;
    const [la, lo] = viewFor(code);
    st.tlat = la;
    st.tlon = st.lon + ((((lo - st.lon) % 360) + 540) % 360 - 180);   /* la via più corta */
    if (reduced) { st.lat = st.tlat; st.lon = st.tlon; st.arc = 1; }
    kick();
  }

  function draw() {
    const { w, h, dpr } = st;
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.42;
    const lat0 = (st.lat + st.py) * RAD, lon0 = (st.lon + st.px) * RAD;
    const s0 = Math.sin(lat0), c0 = Math.cos(lat0);
    /* proiezione: [x, y, z] con z > 0 sull'emisfero visibile */
    const proj = (sp, cp, lon, alt = 0) => {
      const dl = lon - lon0, cd = Math.cos(dl);
      const k = 1 + alt;
      return [cx + R * k * cp * Math.sin(dl), cy - R * k * (c0 * sp - s0 * cp * cd), s0 * sp + c0 * cp * cd];
    };

    /* atmosfera e sfera */
    let g = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.28);
    g.addColorStop(0, 'rgba(255,106,43,0.16)'); g.addColorStop(1, 'rgba(255,106,43,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.28, 0, Math.PI * 2); ctx.fill();
    g = ctx.createRadialGradient(cx - R * 0.38, cy - R * 0.42, R * 0.1, cx, cy, R);
    g.addColorStop(0, '#2a3144'); g.addColorStop(1, '#10131b');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(243,241,234,0.12)'; ctx.lineWidth = dpr; ctx.stroke();

    /* reticolo: paralleli e meridiani, appena accennati */
    ctx.strokeStyle = 'rgba(243,241,234,0.07)'; ctx.lineWidth = dpr * 0.8;
    const line = (pts) => { ctx.beginPath(); let on = false; for (const [x, y, z] of pts) { if (z > 0) { on ? ctx.lineTo(x, y) : ctx.moveTo(x, y); on = true; } else on = false; } ctx.stroke(); };
    for (let la = -60; la <= 60; la += 30) { const pts = []; for (let lo = -180; lo <= 180; lo += 4) pts.push(proj(Math.sin(la * RAD), Math.cos(la * RAD), lo * RAD)); line(pts); }
    for (let lo = -180; lo < 180; lo += 30) { const pts = []; for (let la = -84; la <= 84; la += 4) pts.push(proj(Math.sin(la * RAD), Math.cos(la * RAD), lo * RAD)); line(pts); }

    /* terre: puntini più grandi e luminosi verso il centro */
    const buckets = [[], [], [], [], []];
    for (const [sp, cp, lon] of dots) {
      const p = proj(sp, cp, lon);
      if (p[2] <= 0.02) continue;
      buckets[Math.min(4, Math.floor(p[2] * 5))].push(p);
    }
    const unit = Math.max(1, R / 240);
    buckets.forEach((b, i) => {
      const z = (i + 0.5) / 5, s = (0.9 + 1.25 * z) * unit * dpr * 0.9;
      ctx.fillStyle = `rgba(243,241,234,${(0.16 + 0.7 * Math.pow(z, 0.8)).toFixed(3)})`;
      for (const [x, y] of b) ctx.fillRect(x - s / 2, y - s / 2, s, s);
    });

    /* arco da Bergamo alla meta: si traccia, poi resta acceso con una cometa in testa */
    const target = PLACES[st.code];
    const home = vec(HOME.lat, HOME.lon), dest = vec(target.lat, target.lon);
    if (st.code !== 'it') {
      const w0 = Math.acos(Math.min(1, home[0] * dest[0] + home[1] * dest[1] + home[2] * dest[2]));
      const lift = 0.1 + 0.3 * (w0 / Math.PI);
      const head = st.arc, N = 64, pts = [];
      for (let i = 0; i <= N; i++) {
        const t = (i / N) * head;
        const [la, lo] = toLatLon(slerp(home, dest, t));
        const p = proj(Math.sin(la * RAD), Math.cos(la * RAD), lo * RAD, Math.sin(Math.PI * t) * lift);
        const r2 = ((p[0] - cx) ** 2 + (p[1] - cy) ** 2) / (R * R);
        pts.push([p[0], p[1], p[2] > 0 || r2 > 1]);
      }
      const stroke = (width, color) => {
        ctx.lineWidth = width; ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.beginPath();
        let on = false; for (const [x, y, vis] of pts) { if (vis) { on ? ctx.lineTo(x, y) : ctx.moveTo(x, y); on = true; } else on = false; }
        ctx.stroke();
      };
      stroke(6 * dpr, 'rgba(255,106,43,0.18)');
      stroke(2 * dpr, 'rgba(255,140,90,0.95)');
      const tip = pts[pts.length - 1];
      if (tip[2] && head < 1) { ctx.fillStyle = '#fff4ec'; ctx.beginPath(); ctx.arc(tip[0], tip[1], 3.2 * dpr, 0, Math.PI * 2); ctx.fill(); }
    }

    /* luoghi: puntino per ciascuno, la meta attiva pulsa e ha il suo nome */
    const pulse = (st.t % 1.8) / 1.8;
    for (const [code, p] of Object.entries(PLACES)) {
      const q = proj(Math.sin(p.lat * RAD), Math.cos(p.lat * RAD), p.lon * RAD);
      if (q[2] <= 0.05) continue;
      const active = code === st.code, isHome = code === 'it';
      if (active || isHome) {
        const rr = (4 + 16 * pulse) * dpr;
        ctx.strokeStyle = `rgba(255,106,43,${(0.7 * (1 - pulse)).toFixed(3)})`; ctx.lineWidth = 1.5 * dpr;
        ctx.beginPath(); ctx.arc(q[0], q[1], rr, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = active || isHome ? '#ff6a2b' : 'rgba(243,241,234,0.75)';
      ctx.beginPath(); ctx.arc(q[0], q[1], (active ? 4.2 : 2.6) * dpr, 0, Math.PI * 2); ctx.fill();
      if (active && (st.arc > 0.92 || code === 'it')) {
        const label = (lang === 'en' && p.nameEn) || p.name;
        ctx.font = `700 ${11 * dpr}px "Mona Sans", "Helvetica Neue", Arial, sans-serif`;
        ctx.textBaseline = 'middle';
        const tw = ctx.measureText(label.toUpperCase()).width + 16 * dpr;
        const lx = Math.min(w - tw - 4 * dpr, q[0] + 12 * dpr), ly = q[1] - 16 * dpr;
        ctx.fillStyle = 'rgba(16,19,27,0.85)'; ctx.strokeStyle = 'rgba(255,106,43,0.7)'; ctx.lineWidth = dpr;
        const rh = 20 * dpr;
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(lx, ly - rh / 2, tw, rh, rh / 2) : ctx.rect(lx, ly - rh / 2, tw, rh); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#f3f1ea'; ctx.fillText(label.toUpperCase(), lx + 8 * dpr, ly + 0.5 * dpr);
      }
    }
  }

  let last = performance.now();
  function frame(now) {
    st.raf = 0;
    if (!st.visible) return;
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
    st.t += dt;
    /* molla sulla rotazione, poi l'arco parte quando il globo è quasi arrivato */
    const k = 26, c = 9.5;
    st.vlon += ((st.tlon - st.lon) * k - st.vlon * c) * dt; st.lon += st.vlon * dt;
    st.vlat += ((st.tlat - st.lat) * k - st.vlat * c) * dt; st.lat += st.vlat * dt;
    st.px += (st.tpx - st.px) * (1 - Math.exp(-dt * 5)); st.py += (st.tpy - st.py) * (1 - Math.exp(-dt * 5));
    const near = Math.abs(st.tlon - st.lon) < 14 && Math.abs(st.tlat - st.lat) < 10;
    if (near && st.arc < 1) st.arc = Math.min(1, st.arc + dt / 1.1);
    draw();
    if (!reduced) st.raf = requestAnimationFrame(frame);
  }
  function kick() { if (!st.raf && st.visible) { last = performance.now(); st.raf = requestAnimationFrame(frame); } else if (reduced && st.visible) { resize(); draw(); } }

  new IntersectionObserver(([e]) => { st.visible = e.isIntersecting; if (st.visible) { resize(); kick(); } }, { rootMargin: '80px' }).observe(canvas);
  addEventListener('resize', () => { resize(); if (reduced) draw(); });

  /* col cursore il globo si sporge un poco verso di te */
  if (matchMedia('(hover: hover) and (pointer: fine)').matches && !reduced) {
    canvas.parentElement?.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      st.tpx = -((e.clientX - r.left) / r.width - 0.5) * 16;
      st.tpy = ((e.clientY - r.top) / r.height - 0.5) * 10;
    });
    canvas.parentElement?.addEventListener('pointerleave', () => { st.tpx = 0; st.tpy = 0; });
  }

  resize();
  return { focus, setLanguage(l) { lang = l; } };
}
