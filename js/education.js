/* ------------------------------------------------------------------
   Formazione come pila di libri che cresce con lo scroll.
   Ogni volume è un vero libro: copertine rigide che sporgono, dorso
   arrotondato rivolto a chi guarda (con gli anni stampati), blocco pagine
   con il taglio a righe, ombre reali. Lo spessore è la durata. Il liceo
   ha un segnalibro arancione perché è in corso; TKS è un quaderno
   arancione posato di sbieco (corre in parallelo); il certificato
   Cambridge è appoggiato alla pila; in cima, traslucido, il prossimo
   volume ancora da scrivere: l'università. Nulla fluttua.
   ------------------------------------------------------------------ */
import * as THREE from '../vendor/three.module.min.js';

const ACCENT = 0xff6a2b;
const easeOut = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const clamp01 = (v) => Math.min(1, Math.max(0, v));

/* ---------- texture ---------- */
const FONT = '"Mona Sans", Arial, sans-serif', SERIF = '"Instrument Serif", Georgia, serif';
const texOf = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };

/* grana di tela: viene moltiplicata per il colore della copertina */
function clothTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const ctx = c.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 256, 256);
  const img = ctx.getImageData(0, 0, 256, 256), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = 235 + Math.random() * 20; d[i] = d[i + 1] = d[i + 2] = n; }
  ctx.putImageData(img, 0, 0);
  ctx.globalAlpha = 0.08; ctx.strokeStyle = '#000';
  for (let x = 0; x < 256; x += 3) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke(); }
  for (let y = 0; y < 256; y += 3) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke(); }
  const t = texOf(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); return t;
}
/* il dorso: la texture avvolge il mezzo cilindro; il testo corre lungo l'asse del libro (v) */
function spineTexture(text, fg, bg, { serif = false } = {}) {
  const c = document.createElement('canvas'); c.width = 160; c.height = 640;
  const ctx = c.getContext('2d'); ctx.fillStyle = bg; ctx.fillRect(0, 0, 160, 640);
  /* leggera vignettatura sui bordi (la piega del dorso) */
  const g = ctx.createLinearGradient(0, 0, 160, 0); g.addColorStop(0, 'rgba(0,0,0,.22)'); g.addColorStop(.25, 'rgba(0,0,0,0)'); g.addColorStop(.75, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.22)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 160, 640);
  ctx.save(); ctx.translate(80, 320); ctx.rotate(Math.PI / 2);
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = serif ? `italic 400 58px ${SERIF}` : `700 52px ${FONT}`; try { ctx.fontStretch = 'expanded'; } catch (_) {}
  ctx.fillText(text, 0, 0); ctx.restore();
  /* filetti dorati alle estremità */
  ctx.fillStyle = 'rgba(214,171,79,.9)'; ctx.fillRect(0, 34, 160, 4); ctx.fillRect(0, 46, 160, 2); ctx.fillRect(0, 602, 160, 4); ctx.fillRect(0, 592, 160, 2);
  return texOf(c);
}
function pagesTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const ctx = c.getContext('2d'); ctx.fillStyle = '#efe8d8'; ctx.fillRect(0, 0, 64, 256);
  for (let y = 0; y < 256; y += 2) { ctx.fillStyle = y % 8 ? 'rgba(110,90,60,.16)' : 'rgba(110,90,60,.3)'; ctx.fillRect(0, y, 64, 1); }
  const t = texOf(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
/* copertina del quaderno TKS: arancione con il logo (svg caricato come immagine) */
function tksCoverTexture() {
  const c = document.createElement('canvas'); c.width = 640; c.height = 448;
  const ctx = c.getContext('2d'); ctx.fillStyle = '#ff6a2b'; ctx.fillRect(0, 0, 640, 448);
  ctx.fillStyle = 'rgba(22,25,35,.9)'; ctx.font = `700 26px ${FONT}`; ctx.textAlign = 'left';
  ctx.fillText('INNOVATOR · 2026 — 2027', 56, 392);
  ctx.fillRect(56, 340, 110, 4);
  const tex = texOf(c);
  const img = new Image(); img.onload = () => { ctx.save(); ctx.filter = 'brightness(0.1)'; ctx.drawImage(img, 56, 80, 330, 169); ctx.restore(); tex.needsUpdate = true; };
  img.src = 'assets/tks-logo.svg';
  return tex;
}
/* il certificato Cambridge: foglio con intestazione, titolo, sigillo e riga della firma */
function certificateTexture() {
  const c = document.createElement('canvas'); c.width = 560; c.height = 400;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f7f4ec'; ctx.fillRect(0, 0, 560, 400);
  ctx.strokeStyle = '#1f2a5a'; ctx.lineWidth = 6; ctx.strokeRect(18, 18, 524, 364); ctx.lineWidth = 1.5; ctx.strokeRect(30, 30, 500, 340);
  ctx.fillStyle = '#1f2a5a'; ctx.textAlign = 'center';
  ctx.font = `700 20px ${FONT}`; ctx.fillText('CAMBRIDGE ASSESSMENT ENGLISH', 280, 72);
  ctx.font = `italic 400 44px ${SERIF}`; ctx.fillText('Certificate', 280, 128);
  ctx.font = `800 54px ${FONT}`; ctx.fillText('B1 PRELIMINARY', 280, 190);
  ctx.font = `400 17px ${FONT}`; ctx.fillStyle = '#3a4260';
  ctx.fillText('Preliminary English Test · CEFR Level B1', 280, 224);
  ctx.font = `italic 400 26px ${SERIF}`; ctx.fillStyle = '#1f2a5a'; ctx.fillText('Andrea Gervasoni', 280, 268);
  ctx.strokeStyle = '#1f2a5a'; ctx.beginPath(); ctx.moveTo(150, 320); ctx.lineTo(320, 320); ctx.stroke();
  ctx.font = `400 11px ${FONT}`; ctx.fillStyle = '#6a7190'; ctx.fillText('Cambridge English Language Assessment', 235, 338);
  ctx.beginPath(); ctx.arc(450, 300, 40, 0, Math.PI * 2); ctx.fillStyle = '#c0362c'; ctx.fill();
  ctx.beginPath(); ctx.arc(450, 300, 31, 0, Math.PI * 2); ctx.strokeStyle = '#f2d16b'; ctx.lineWidth = 2; ctx.stroke();
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(450 + Math.cos(a) * 40, 300 + Math.sin(a) * 40); ctx.lineTo(450 + Math.cos(a) * 46, 300 + Math.sin(a) * 46); ctx.strokeStyle = '#c0362c'; ctx.lineWidth = 6; ctx.stroke(); }
  ctx.fillStyle = '#f2d16b'; ctx.font = `700 14px ${FONT}`; ctx.fillText('B1', 450, 305);
  return texOf(c);
}
/* etichetta piatta (trasparente) per il dorso del volume traslucido */
function spineLabel(text) {
  const c = document.createElement('canvas'); c.width = 640; c.height = 128;
  const ctx = c.getContext('2d'); ctx.clearRect(0, 0, 640, 128);
  ctx.fillStyle = '#d94f14'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `800 64px ${FONT}`; try { ctx.fontStretch = 'expanded'; } catch (_) {}
  ctx.fillText(text, 320, 64);
  return texOf(c);
}

/* ---------- geometria ---------- */
let CLOTH = null, PAGES = null;
const hex = (c) => '#' + new THREE.Color(c).getHexString();

/* Un libro sdraiato, dorso verso +z. w = larghezza (x), h = spessore (y), d = profondità (z). */
function book({ w, h, d, cover, ink = '#f3f1ea', spine, serif = false, topMap = null, ghost = false }) {
  const g = new THREE.Group();
  const ov = 0.035, ct = 0.022;                                   /* sporgenza e spessore delle copertine */
  const coverMat = ghost
    ? new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .4, transparent: true, opacity: .5 })
    : new THREE.MeshStandardMaterial({ color: cover, map: CLOTH, roughness: .62, metalness: 0 });
  const pageMat = ghost ? coverMat : new THREE.MeshStandardMaterial({ map: PAGES, roughness: 1 });
  const plain = ghost ? coverMat : new THREE.MeshStandardMaterial({ color: 0xefe8d8, roughness: 1 });
  /* blocco pagine: taglio a righe su ±x e davanti (−z); dietro c'è il dorso */
  const block = new THREE.Mesh(new THREE.BoxGeometry(w, h - ct * 2 + 0.004, d - 0.03), [pageMat, pageMat, plain, plain, plain, pageMat]);
  block.position.z = -0.012; g.add(block);
  const coverGeo = new THREE.BoxGeometry(w + ov * 2, ct, d + ov);
  const topMats = [coverMat, coverMat, topMap ? new THREE.MeshStandardMaterial({ map: topMap, roughness: .6 }) : coverMat, coverMat, coverMat, coverMat];
  const top = new THREE.Mesh(coverGeo, topMats); top.position.set(0, h / 2 - ct / 2, -ov / 2); g.add(top);
  const bottom = new THREE.Mesh(coverGeo, coverMat); bottom.position.set(0, -h / 2 + ct / 2, -ov / 2); g.add(bottom);
  /* dorso arrotondato: mezzo cilindro con asse lungo x, rigonfio verso +z */
  const spineMat = ghost ? coverMat : new THREE.MeshStandardMaterial({ map: spine ? spineTexture(spine, ink, hex(cover), { serif }) : null, color: spine ? 0xffffff : cover, roughness: .62 });
  const sp = new THREE.Mesh(new THREE.CylinderGeometry(h / 2, h / 2, w + ov * 2, 18, 1, true, -Math.PI / 2, Math.PI), spineMat);
  sp.rotation.z = Math.PI / 2; sp.position.set(0, 0, d / 2 - 0.02); g.add(sp);
  if (ghost) {
    if (spine) { const lab = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, h * 0.62), new THREE.MeshBasicMaterial({ map: spineLabel(spine), transparent: true })); lab.position.set(0, 0, d / 2 + h / 2 - 0.005); g.add(lab); }
  }
  g.traverse((o) => { if (o.isMesh && !ghost) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData.h = h;
  return g;
}

export function createEducation({ canvas }) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9a8f80, 0.75));
  const key = new THREE.DirectionalLight(0xffffff, 1.9); key.position.set(2.2, 5.5, 3.2); scene.add(key);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 4;
  Object.assign(key.shadow.camera, { left: -2.6, right: 2.6, top: 3.2, bottom: -1.5, near: 0.5, far: 14 }); key.shadow.camera.updateProjectionMatrix();
  const fill = new THREE.DirectionalLight(0xdfe6ff, 0.5); fill.position.set(-3.5, 2.2, 2.5); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffb28a, 0.55); rim.position.set(-2, 3, -4); scene.add(rim);

  CLOTH = CLOTH || clothTexture(); PAGES = PAGES || pagesTexture();
  const root = new THREE.Group(); scene.add(root);
  /* il piano riceve solo l'ombra: fuori dall'ombra è invisibile (niente riquadri grigi) */
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ opacity: .22 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.001; ground.receiveShadow = true; root.add(ground);

  /* volumi, dal basso: primaria, medie, liceo, TKS (quaderno), Cambridge (certificato), università (traslucido) */
  const items = [];
  let y = 0;
  const stack = (obj, { dx = 0, dz = 0, rot = 0, drop = true } = {}) => {
    const h = obj.userData.h || 0; const restY = y + h / 2; y += h;
    obj.position.set(dx, restY + 3, dz); obj.rotation.y = rot; obj.visible = false; root.add(obj);
    items.push({ obj, restY, rot, drop }); return obj;
  };
  stack(book({ w: 1.86, h: 0.34, d: 1.34, cover: 0xd7cdb6, ink: '#161923', spine: '2015 – 2020' }), { rot: -0.03 });
  stack(book({ w: 1.78, h: 0.22, d: 1.28, cover: 0x44536f, spine: '2020 – 2023' }), { dx: 0.04, rot: 0.05 });
  const liceo = stack(book({ w: 1.9, h: 0.4, d: 1.36, cover: 0x1e2231, spine: '2023 – oggi', serif: true }), { dx: -0.03, rot: -0.02 });
  {                                                            /* segnalibro arancione che esce davanti (−z) */
    const rb = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.01, 0.55), new THREE.MeshStandardMaterial({ color: ACCENT, roughness: .7 }));
    rb.position.set(0.5, -0.05, -0.86); rb.rotation.y = 0.12; rb.castShadow = true; liceo.add(rb);
  }
  stack(book({ w: 1.5, h: 0.08, d: 1.06, cover: ACCENT, ink: '#161923', spine: 'TKS 26 – 27', topMap: tksCoverTexture() }), { dx: 0.1, dz: -0.08, rot: 0.34 });
  const topY = y;
  /* il certificato: appoggiato in piedi contro il fianco destro della pila, la faccia verso chi guarda */
  const cert = new THREE.Group();
  const side = () => new THREE.MeshStandardMaterial({ color: 0xe9e4d8 });
  const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.52, 0.01), [side(), side(), side(), side(), new THREE.MeshStandardMaterial({ map: certificateTexture(), roughness: .85 }), side()]);
  sheet.position.y = 0.26; sheet.rotation.x = -0.16; sheet.castShadow = true; sheet.receiveShadow = true; cert.add(sheet);
  cert.position.set(1.0, 3, 0.9); cert.rotation.y = -0.38; cert.visible = false; root.add(cert);
  items.push({ obj: cert, restY: 0, rot: -0.38, drop: true });
  /* il prossimo volume: traslucido, appoggiato in cima (niente che fluttua) */
  const ghost = book({ w: 1.84, h: 0.3, d: 1.32, cover: 0xffffff, spine: 'UNIVERSITÀ', ghost: true });
  ghost.position.set(0, topY + 0.15, 0); ghost.rotation.y = 0.02; ghost.visible = false; root.add(ghost);
  items.push({ obj: ghost, restY: topY + 0.15, rot: 0.02, drop: false });
  const N = items.length;

  const st = { p: 0, w: 0, h: 0, narrow: false, rot: 0, px: 0, py: 0, time: 0, built: -1 };
  function resize() {
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
    if (w === st.w && h === st.h) return;
    st.w = w; st.h = h; st.narrow = w < 560 || h < 480;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  function frame(now, dt) {
    resize();
    st.time += dt;
    const p = st.p;
    let current = 0;
    items.forEach((it, i) => {
      const a = i / N, b = (i + 1) / N;
      const local = clamp01((p - a) / (b - a));
      const k = easeOut(local / 0.5);                              /* si posa nella prima metà della finestra, poi si legge */
      const target = it.restY + (it.drop ? (1 - k) * 2.6 : 0);
      it.obj.position.y += (target - it.obj.position.y) * (1 - Math.exp(-dt * 14));
      /* si posa con una leggera rotazione che si assesta */
      it.obj.rotation.y = it.rot + (1 - k) * 0.25;
      it.obj.rotation.x = (1 - k) * 0.06;
      if (!it.drop) { it.obj.scale.setScalar(1.03 - 0.03 * k); it.obj.traverse((o) => { if (o.material && o.material.transparent) o.material.opacity = (o.material.map ? 1 : .5) * k; }); }
      it.obj.visible = local > 0.001;
      if (local > 0) current = i;
    });
    /* la pila gira piano e segue appena il puntatore */
    const targetRot = -0.42 + p * 0.3 + st.px * 0.14;
    st.rot += (targetRot - st.rot) * (1 - Math.exp(-dt * 4));
    root.rotation.y = st.rot;
    /* inquadratura: la pila gira sul proprio asse, quindi da qualunque lato la si guardi
       resta dentro un cilindro di raggio R attorno all'asse; basta che la camera inquadri
       quel cilindro (in larghezza) e l'altezza della pila (in verticale) — non si taglia
       mai, a qualunque proporzione dello schermo. Un piccolo scarto verso destra lascia
       spazio al testo senza spingere la pila fuori dal fotogramma. */
    const aspect = st.w / st.h;
    const fovV = camera.fov * Math.PI / 180;
    const fovH = 2 * Math.atan(Math.tan(fovV / 2) * aspect);
    const R = 1.95, halfH = 1.05;
    const distV = (halfH / Math.tan(fovV / 2)) * 1.1;
    const distH = (R / Math.tan(fovH / 2)) * 1.12;
    const dist = Math.max(distV, distH, 3.3);
    const cy = 0.55 + 0.25 * st.py;
    const lookX = 0.12;                                            /* prima era 0.3 (0.2 da mobile): spingeva la pila a sinistra */
    camera.position.set(lookX + 0.12, cy + dist * 0.42, dist * 0.92);
    camera.lookAt(lookX, 0.55, 0);
    renderer.render(scene, camera);
    if (current !== st.built) { st.built = current; onStep?.(current); }
  }
  let onStep = null;
  return {
    frame,
    setProgress(v) { st.p = clamp01(v); },
    setPointer(nx, ny) { st.px = nx; st.py = ny; },
    onStep(fn) { onStep = fn; },
    steps: N,
    resize
  };
}
