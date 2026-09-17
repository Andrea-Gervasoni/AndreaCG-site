/* ------------------------------------------------------------------
   Oggetti 3D dei progetti, generati in codice.
   Postilla → una pila di documenti con evidenziazioni e timbro
   Orizzonte → un ventaglio di futuri possibili (Monte Carlo)
   Formularium → una superficie matematica viva con glifi in orbita
   Il prossimo → un solido in costruzione
   Un solo renderer disegna dentro le schede della griglia (scissor);
   un secondo, piccolo, serve la scheda di dettaglio.
   ------------------------------------------------------------------ */
import * as THREE from '../vendor/three.module.min.js';

const PAPER = 0xf3f1ea, INK = 0x161923, INK2 = 0x262b38, ACCENT = 0xff6a2b, MUTED = 0x8f96a8, SOFT = 0xffb28a;
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .8, metalness: 0, flatShading: true, ...o });

function lights(scene) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0x30343f, 1.0));
  const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(2.5, 3.5, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(ACCENT, 0.9); rim.position.set(-3, -1, -3); scene.add(rim);
  return key;
}

/* --- Postilla --- */
function buildPostilla() {
  const g = new THREE.Group();
  const sheets = [];
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.72, 0.025), std(i === 2 ? PAPER : 0xe4e1d8, { roughness: .95 }));
    s.position.set((i - 1) * 0.05, (i - 1) * -0.03, -0.14 + i * 0.07); s.rotation.z = (i - 1) * 0.07;
    g.add(s); sheets.push(s);
  }
  const top = sheets[2];
  const line = (w, y, x = -0.46 + w / 2, color = MUTED, h = 0.035) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.01), std(color, { roughness: 1 })); m.position.set(x, y, 0.02); top.add(m); return m; };
  line(0.5, 0.66, -0.21, INK, 0.07);
  line(0.22, 0.66, 0.35, ACCENT, 0.05);
  const widths = [0.92, 0.8, 0.88, 0.62, 0.9, 0.84, 0.5, 0.86, 0.7];
  widths.forEach((w, i) => {
    const y = 0.46 - i * 0.11;
    if (i === 2 || i === 5) { const hl = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, 0.075, 0.008), std(ACCENT, { roughness: 1 })); hl.position.set(-0.46 + w / 2, y, 0.016); top.add(hl); line(w, y, undefined, INK); }
    else line(w, y);
  });
  /* timbro */
  const stamp = new THREE.Group(); stamp.position.set(0.32, -0.55, 0.03); stamp.rotation.z = -0.35; top.add(stamp);
  stamp.add(new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.014, 6, 32), std(ACCENT, { roughness: .9 })));
  stamp.add(new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.008, 6, 32), std(ACCENT, { roughness: .9 })));
  const tick = new THREE.Group(); stamp.add(tick);
  const t1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.01), std(ACCENT)); t1.position.set(-0.03, -0.02, 0); t1.rotation.z = 0.8; tick.add(t1);
  const t2 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 0.01), std(ACCENT)); t2.position.set(0.03, 0.0, 0); t2.rotation.z = -0.7; tick.add(t2);
  /* linguetta laterale */
  const tab = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.26, 0.02), std(ACCENT)); tab.position.set(0.68, 0.2, -0.005); top.add(tab);
  /* evidenziatore che fluttua */
  const marker = new THREE.Group(); marker.position.set(0.95, 0.15, 0.5); marker.rotation.set(0.2, 0.3, -0.8); g.add(marker);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.72, 8), std(ACCENT, { roughness: .6 })); marker.add(body);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.2, 8), std(INK2, { roughness: .5 })); cap.position.y = 0.44; marker.add(cap);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 8), std(SOFT)); tip.position.y = -0.42; tip.rotation.x = Math.PI; marker.add(tip);
  g.userData.update = (t) => {
    sheets.forEach((s, i) => { s.position.y = (i - 1) * -0.03 + Math.sin(t * 1.1 + i) * 0.02; s.rotation.x = Math.sin(t * 0.7 + i) * 0.03; });
    top.position.z = 0 + Math.sin(t * 0.9) * 0.02 + 0.02;
    marker.position.y = 0.15 + Math.sin(t * 1.4) * 0.06; marker.rotation.z = -0.8 + Math.sin(t * 0.8) * 0.08;
    stamp.scale.setScalar(1 + Math.max(0, Math.sin(t * 0.9)) * 0.02);
  };
  g.rotation.set(0.12, -0.3, 0);
  return g;
}

/* --- Orizzonte --- */
function buildOrizzonte() {
  const g = new THREE.Group();
  const N = 30, STEPS = 48;
  const lines = [];
  const rnd = (seed) => { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; };
  const r = rnd(1234);
  const spreads = [];
  for (let i = 0; i < N; i++) { const u = (i + 0.5) / N; const k = (u - 0.5) * 2; spreads.push(Math.sign(k) * Math.pow(Math.abs(k), 1.4) * 1.15 + 0.15); }
  const curvePts = (k) => {
    const pts = []; let noise = 0;
    for (let i = 0; i <= STEPS; i++) {
      const u = i / STEPS; noise += (r() - 0.5) * 0.035; noise *= 0.96;
      pts.push(new THREE.Vector3(-1.45 + 2.9 * u, -0.55 + Math.pow(u, 1.5) * k + noise * u * 2 + u * 0.25, (r() - 0.5) * 0.04));
    }
    return pts;
  };
  for (let i = 0; i < N; i++) {
    const k = spreads[i];
    const pts = curvePts(k);
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const near = 1 - Math.min(1, Math.abs(k - 0.15) / 1.3);
    const color = k > 0.8 ? ACCENT : (k < -0.5 ? MUTED : PAPER);
    const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.25 + near * 0.55 });
    const l = new THREE.Line(geo, m); l.userData.pts = pts; g.add(l); lines.push(l);
  }
  /* mediana spessa */
  const median = new THREE.CatmullRomCurve3(curvePts(0.15));
  const tube = new THREE.Mesh(new THREE.TubeGeometry(median, 48, 0.022, 6, false), std(ACCENT, { roughness: .5, emissive: ACCENT, emissiveIntensity: .35 }));
  g.add(tube);
  /* cono di probabilità */
  const lo = curvePts(-0.7), hi = curvePts(1.0);
  const pos = [];
  for (let i = 0; i < STEPS; i++) { const a = lo[i], b = hi[i], c = lo[i + 1], d = hi[i + 1]; pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, b.x, b.y, b.z, d.x, d.y, d.z, c.x, c.y, c.z); }
  const cone = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)), new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.09, side: THREE.DoubleSide, depthWrite: false }));
  g.add(cone);
  /* assi e traguardo */
  const axis = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.012, 0.012), std(MUTED)); axis.position.set(0, -0.62, 0); g.add(axis);
  const today = new THREE.Mesh(new THREE.BoxGeometry(0.012, 1.9, 0.012), std(MUTED)); today.position.set(-1.45, 0.2, 0); g.add(today);
  /* il traguardo è solo il pallino arancione che pulsa: l'anello bianco intorno sembrava
     una lucina estranea alla palette, sul fondo scuro della scheda */
  const goalDot = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), std(ACCENT, { emissive: ACCENT, emissiveIntensity: .5 })); goalDot.position.set(1.52, 0.8, 0); g.add(goalDot);
  const CYCLE = 7;
  g.userData.update = (t) => {
    const p = (t % CYCLE) / CYCLE;
    const reveal = Math.min(1, p / 0.55);
    const e = 1 - Math.pow(1 - reveal, 3);
    lines.forEach((l, i) => { const d = Math.max(0, Math.min(1, (e * 1.25 - i * 0.008))); l.geometry.setDrawRange(0, Math.floor(d * (STEPS + 1))); });
    tube.geometry.setDrawRange(0, Math.floor(e * 48 * 6 * 6));
    cone.material.opacity = 0.09 * e;
    goalDot.scale.setScalar(1 + Math.sin(t * 3) * 0.2);
    g.rotation.x = 0.28 + Math.sin(t * 0.4) * 0.05;
  };
  g.rotation.set(0.28, -0.35, 0.04);
  return g;
}

/* --- Formularium --- */
function glyphTexture(text, color = '#f3f1ea') {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `italic 400 ${text.length > 1 ? 120 : 170}px "Instrument Serif", Georgia, serif`;
  ctx.fillText(text, 128, 138);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}
function buildFormularium() {
  const g = new THREE.Group();
  const S = 26, EXT = 1.15;
  const surf = new THREE.PlaneGeometry(EXT * 2, EXT * 2, S, S);
  const mesh = new THREE.Mesh(surf, new THREE.MeshStandardMaterial({ color: INK2, roughness: .85, metalness: 0, flatShading: true, side: THREE.DoubleSide, transparent: true, opacity: .92 }));
  const wire = new THREE.LineSegments(new THREE.WireframeGeometry(surf), new THREE.LineBasicMaterial({ color: SOFT, transparent: true, opacity: 0.5 }));
  const inner = new THREE.Group(); inner.rotation.x = -Math.PI / 2 + 0.95; inner.add(mesh, wire); g.add(inner);
  const base = surf.attributes.position.array.slice();
  const glyphs = new THREE.Group(); g.add(glyphs);
  const syms = [['Δ', '#f3f1ea'], ['∫', '#ff6a2b'], ['π', '#f3f1ea'], ['√', '#f3f1ea'], ['Σ', '#ffb28a'], ['lim', '#f3f1ea']];
  const plates = syms.map(([s, col], i) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({ map: glyphTexture(s, col), transparent: true, depthWrite: false }));
    p.userData.phase = (i / syms.length) * Math.PI * 2; glyphs.add(p); return p;
  });
  /* linea del grafico: una parabola che passa sulla superficie */
  const curvePts = []; for (let i = 0; i <= 40; i++) { const u = i / 40, x = -1 + 2 * u; curvePts.push(new THREE.Vector3(x, 0.02, x * x * 0.8 - 0.6)); }
  const curve = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curvePts), new THREE.LineBasicMaterial({ color: ACCENT }));
  curve.rotation.x = -Math.PI / 2; inner.add(curve);
  g.userData.update = (t) => {
    const a = 0.32 + Math.sin(t * 0.5) * 0.22, b = -0.32 + Math.cos(t * 0.37) * 0.22;
    const arr = surf.attributes.position.array;
    for (let i = 0; i < arr.length; i += 3) { const x = base[i], y = base[i + 1]; arr[i + 2] = a * x * x + b * y * y + Math.sin(x * 2 + t) * 0.04; }
    surf.attributes.position.needsUpdate = true; surf.computeVertexNormals();
    wire.geometry.dispose(); wire.geometry = new THREE.WireframeGeometry(surf);
    plates.forEach((p) => { const ph = p.userData.phase + t * 0.35; p.position.set(Math.cos(ph) * 1.45, Math.sin(ph * 1.3) * 0.5 + 0.2, Math.sin(ph) * 1.0); p.material.opacity = 0.55 + 0.45 * ((Math.sin(ph) + 1) / 2); });
    inner.rotation.z = t * 0.12;
  };
  g.rotation.set(0.1, 0, 0);
  return g;
}

/* --- Il prossimo --- */
function buildNext() {
  const g = new THREE.Group();
  const ico = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.95, 1)), new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: .75 }));
  g.add(ico);
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.42), std(PAPER, { roughness: .6 })); g.add(core);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.006, 6, 64), std(MUTED)); ring.rotation.x = Math.PI / 2.4; g.add(ring);
  const cursor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.1), std(ACCENT, { emissive: ACCENT, emissiveIntensity: .6 })); g.add(cursor);
  g.userData.update = (t) => {
    ico.rotation.set(t * 0.2, t * 0.31, 0); core.rotation.set(-t * 0.4, t * 0.25, 0);
    const a = t * 0.9; cursor.position.set(Math.cos(a) * 1.25, Math.sin(a) * 1.25 * Math.cos(Math.PI / 2.4), Math.sin(a) * 1.25 * Math.sin(Math.PI / 2.4));
    cursor.visible = Math.floor(t * 2) % 2 === 0 || true; cursor.material.emissiveIntensity = 0.3 + 0.5 * ((Math.sin(t * 6) + 1) / 2);
  };
  return g;
}

const BUILDERS = { postilla: buildPostilla, orizzonte: buildOrizzonte, formularium: buildFormularium, next: buildNext };

export function createProjectObjects({ canvas, grid, slots }) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.setScissorTest(true);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 40);
  camera.position.set(0, 0.3, 5.3); camera.lookAt(0, 0, 0);

  const items = [...slots].map((slot) => {
    const name = slot.dataset.object;
    const scene = new THREE.Scene();
    const key = lights(scene);
    const obj = BUILDERS[name] ? BUILDERS[name]() : new THREE.Group();
    const pivot = new THREE.Group(); pivot.add(obj); scene.add(pivot);
    const it = { name, slot, scene, obj, pivot, key, rot: { x: 0, y: 0, tx: 0, ty: 0, vx: 0, vy: 0 }, hover: 0, tHover: 0, drag: null, auto: 0 };
    bindPointer(() => it, slot, { touchDrag: false });
    return it;
  });
  const byName = Object.fromEntries(items.map((i) => [i.name, i]));

  /* touchDrag: false nella griglia — su un tocco, distinguere "voglio ruotare" da "voglio
     scorrere" è troppo fragile (varia da motore a motore); col dito si scorre e basta, si
     ruota con il mouse o nella scheda a schermo intero, che non è dentro una pagina che scorre. */
  function bindPointer(get, el, { touchDrag = true } = {}) {
    el.addEventListener('pointerenter', () => { const it = get(); if (it) it.tHover = 1; });
    el.addEventListener('pointerleave', () => { const it = get(); if (!it) return; it.tHover = 0; it.rot.tx = 0; it.rot.ty = 0; });
    el.addEventListener('pointermove', (e) => {
      const it = get(); if (!it) return;
      if (e.pointerType === 'touch' && !touchDrag) return;
      /* col dito (dove è permesso), il primo tocco non trascina subito: si aspetta di
         capire se il gesto è orizzontale (ruota l'oggetto) o verticale (si vuole scorrere
         la pagina, e allora non si cattura nulla). */
      if (it.pending && !it.drag) {
        const dx = e.clientX - it.pending.x, dy = e.clientY - it.pending.y;
        if (Math.hypot(dx, dy) > 8) {
          if (Math.abs(dx) > Math.abs(dy)) { it.drag = { x: e.clientX, y: e.clientY }; it.rot.vx = it.rot.vy = 0; el.setPointerCapture?.(e.pointerId); }
          it.pending = null;
        }
      }
      const r = el.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1, ny = ((e.clientY - r.top) / r.height) * 2 - 1;
      if (it.drag) { it.rot.vy = (e.clientX - it.drag.x) * 0.012; it.rot.vx = (e.clientY - it.drag.y) * 0.012; it.rot.y += it.rot.vy; it.rot.x += it.rot.vx; it.drag = { x: e.clientX, y: e.clientY }; }
      else if (!it.pending) { it.rot.ty = nx * 0.45; it.rot.tx = ny * 0.3; }
    });
    el.addEventListener('pointerdown', (e) => {
      const it = get(); if (!it) return;
      if (e.pointerType === 'touch') { if (touchDrag) it.pending = { x: e.clientX, y: e.clientY }; return; }
      it.drag = { x: e.clientX, y: e.clientY }; it.rot.vx = it.rot.vy = 0; el.setPointerCapture?.(e.pointerId);
    });
    const end = () => { const it = get(); if (it) { it.drag = null; it.pending = null; } };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  }

  let gw = 0, gh = 0;
  function frame(now, dt, t) {
    const gr = grid.getBoundingClientRect();
    if (gr.bottom < 0 || gr.top > innerHeight) return;
    const w = Math.round(gr.width), h = Math.round(gr.height);
    if (w !== gw || h !== gh) { gw = w; gh = h; renderer.setSize(w, h, false); }
    for (const it of items) {
      const r = it.slot.getBoundingClientRect();
      if (r.bottom < gr.top || r.top > gr.bottom || r.bottom < 0 || r.top > innerHeight) continue;
      stepItem(it, dt, t);
      const left = r.left - gr.left, bottom = gr.bottom - r.bottom;
      renderer.setViewport(left, bottom, r.width, r.height);
      renderer.setScissor(left, bottom, r.width, r.height);
      camera.aspect = r.width / r.height; camera.updateProjectionMatrix();
      renderer.render(it.scene, camera);
    }
  }
  function stepItem(it, dt, t) {
    it.obj.userData.update?.(t);
    it.hover += (it.tHover - it.hover) * (1 - Math.exp(-dt * 6));
    if (!it.drag) {
      it.rot.vx *= Math.exp(-dt * 2.2); it.rot.vy *= Math.exp(-dt * 2.2);
      it.rot.x += it.rot.vx; it.rot.y += it.rot.vy;
      /* torna dolcemente verso l'orientamento naturale + inclinazione del puntatore */
      const k = 1 - Math.exp(-dt * 3);
      it.rot.x += (it.rot.tx - it.rot.x) * k * (1 - Math.min(1, Math.abs(it.rot.vx) * 30));
      it.rot.y += ((it.rot.ty + Math.sin(t * 0.25 + it.auto) * 0.2) - it.rot.y) * k * 0.6;
    }
    it.pivot.rotation.set(it.rot.x, it.rot.y, 0);
    const s = 1 + it.hover * 0.06; it.pivot.scale.setScalar(s);
    it.key.intensity = 1.5 + it.hover * 0.8;
  }

  /* --- scheda di dettaglio --- */
  let dialog = null;
  function mountDialog(name, container) {
    const it = byName[name]; if (!it) return;
    if (!dialog) {
      const c = document.createElement('canvas'); container.append(c);
      const r = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: true }); r.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); r.setClearColor(0, 0);
      const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 40); cam.position.set(0, 0.3, 5.6); cam.lookAt(0, 0, 0);
      dialog = { renderer: r, canvas: c, camera: cam, item: null, container, w: 0, h: 0 };
      /* anche nella scheda a schermo intero: da mobile l'oggetto e il testo sono impilati
         in un unico pannello che scorre (overflow: auto) — stesso motivo della griglia,
         un tocco deve poter scorrere quel pannello invece di restare sull'oggetto */
      bindPointer(() => dialog.item, container, { touchDrag: false });
    }
    dialog.item = it;
  }
  function unmountDialog() { if (dialog) dialog.item = null; }
  function frameDialog(dt, t) {
    if (!dialog?.item) return;
    const r = dialog.container.getBoundingClientRect();
    const w = Math.round(r.width), h = Math.round(r.height);
    if (!w || !h) return;
    if (w !== dialog.w || h !== dialog.h) { dialog.w = w; dialog.h = h; dialog.renderer.setSize(w, h, false); dialog.camera.aspect = w / h; dialog.camera.updateProjectionMatrix(); }
    const it = dialog.item;
    stepItem(it, dt, t);
    dialog.renderer.render(it.scene, dialog.camera);
  }

  return { frame: (now, dt, t) => { frame(now, dt, t); frameDialog(dt, t); }, mountDialog, unmountDialog, items };
}
