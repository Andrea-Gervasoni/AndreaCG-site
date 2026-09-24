/* ------------------------------------------------------------------
   Scritti: un portatile low-poly (a faccette, come l'avatar) che si apre
   con lo scroll. Sullo schermo il profilo Medium di Andrea; il cursore
   clicca "Scrivi", una bozza si batte da sola — i tasti si abbassano
   davvero, lettera per lettera — poi "Pubblica". Tutto è legato allo
   scroll: tornando su, il testo si cancella e il portatile si richiude.
   ------------------------------------------------------------------ */
import * as THREE from '../vendor/three.module.min.js';
import { t } from './i18n.js';

const GRAPH = 0x2b2f3a, GRAPH_HI = 0x3a3f4d, KEY = 0x1c1f28, PAD = 0x353a47, ACCENT = 0xff6a2b;
const flat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .62, metalness: .12, flatShading: true, ...o });
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const seg = (p, a, b) => clamp01((p - a) / (b - a));
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const lerp = (a, b, k) => a + (b - a) * k;

/* le fasi, in frazioni dello scroll della sezione */
const PH = { open: [0.02, 0.16], power: [0.12, 0.2], toWrite: [0.26, 0.36], editor: 0.38, title: [0.42, 0.5], body: [0.52, 0.8], toPublish: [0.81, 0.86], published: 0.87 };

/* tappe della camera: distanza (in multipli di "portatile intero nell'inquadratura"),
   elevazione, punto guardato (y, z) e rotazione del portatile */
const CAM = [
  { p: 0, dist: 1.02, elev: 0.66, ty: 0.3, tz: 0, rot: -0.62 },
  { p: 0.18, dist: 0.98, elev: 0.36, ty: 0.8, tz: -0.3, rot: -0.3 },
  { p: 0.36, dist: 0.92, elev: 0.26, ty: 0.9, tz: -0.55, rot: -0.2 },
  { p: 0.46, dist: 0.78, elev: 0.12, ty: 1.02, tz: -1.05, rot: -0.07 },
  { p: 0.8, dist: 0.76, elev: 0.12, ty: 1.02, tz: -1.05, rot: -0.05 },
  { p: 0.92, dist: 0.92, elev: 0.24, ty: 0.9, tz: -0.35, rot: -0.28 },
  { p: 1, dist: 0.94, elev: 0.26, ty: 0.9, tz: -0.35, rot: -0.32 }
];
function camAt(p) {
  let i = 0; while (i < CAM.length - 2 && p > CAM[i + 1].p) i++;
  const a = CAM[i], b = CAM[i + 1], k = ease(seg(p, a.p, b.p)), o = {};
  for (const key of ['dist', 'elev', 'ty', 'tz', 'rot']) o[key] = lerp(a[key], b[key], k);
  return o;
}

/* sagoma arrotondata a pochi lati, estrusa: spigoli smussati a faccette */
function slab(w, d, h, r) {
  const s = new THREE.Shape(), x = w / 2, y = d / 2;
  s.moveTo(-x + r, -y); s.lineTo(x - r, -y); s.quadraticCurveTo(x, -y, x, -y + r); s.lineTo(x, y - r); s.quadraticCurveTo(x, y, x - r, y);
  s.lineTo(-x + r, y); s.quadraticCurveTo(-x, y, -x, y - r); s.lineTo(-x, -y + r); s.quadraticCurveTo(-x, -y, -x + r, -y);
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 1, curveSegments: 2 });
  g.translate(0, 0, -h / 2);
  return g;
}

/* ---------- lo schermo: un canvas 2D disegnato come una pagina Medium ---------- */
function createScreen() {
  const W = 1280, H = 800;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const photo = new Image(); let photoOk = false;
  photo.onload = () => { photoOk = true; dirty = true; };
  photo.src = 'assets/andrea-s.webp';
  let dirty = true, lastKey = '';
  const SANS = '"Mona Sans", "Helvetica Neue", Arial, sans-serif', SERIF = 'Georgia, "Times New Roman", serif', DISPLAY = '"Instrument Serif", Georgia, serif';
  const INK = '#242424', GREY = '#6b6b6b', LINE = '#f0f0f0', SKEL = '#ececec';

  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
  const text = (s, x, y, font, color, align = 'left') => { ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(s, x, y); return ctx.measureText(s).width; };
  function wrap(s, x, y, maxW, lh, font, color, limit = Infinity) {
    ctx.font = font; ctx.fillStyle = color; ctx.textAlign = 'left';
    const words = s.split(' '); let line = '', yy = y, lx = x;
    for (let i = 0; i < words.length; i++) {
      const test = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, yy); line = words[i]; yy += lh; }
      else line = test;
    }
    if (line) { ctx.fillText(line, x, yy); lx = x + ctx.measureText(line).width; }
    return { x: lx, y: yy };
  }
  const wordmark = (x, y) => text('Medium', x, y, `700 40px ${SERIF}`, '#111');   /* restituisce la larghezza */
  function avatar(cx, cy, r) {
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
    /* la foto è un ritratto: si ingrandisce un poco e si centra sul viso (al 40% dell'altezza) */
    if (photoOk) { const s = (r * 2.5) / photo.width; ctx.drawImage(photo, cx - (photo.width * s) / 2, cy - photo.height * s * 0.4, photo.width * s, photo.height * s); }
    else { ctx.fillStyle = '#d9d4ca'; ctx.fillRect(cx - r, cy - r, r * 2, r * 2); }
    ctx.restore();
  }
  function pencil(x, y) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(-Math.PI / 4); ctx.strokeStyle = GREY; ctx.lineWidth = 2.4;
    ctx.strokeRect(-4, -12, 8, 20); ctx.beginPath(); ctx.moveTo(-4, 8); ctx.lineTo(0, 15); ctx.lineTo(4, 8); ctx.stroke(); ctx.restore();
  }
  function bell(x, y) {
    ctx.save(); ctx.strokeStyle = GREY; ctx.lineWidth = 2.4; ctx.beginPath();
    ctx.moveTo(x - 10, y + 8); ctx.quadraticCurveTo(x - 10, y - 12, x, y - 12); ctx.quadraticCurveTo(x + 10, y - 12, x + 10, y + 8); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y + 12, 3, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  function topbar(editor) {
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, 84);
    const wm = wordmark(48, 56);
    if (!editor) {
      rr(250, 24, 260, 40, 20); ctx.fillStyle = '#f7f7f7'; ctx.fill();
      ctx.strokeStyle = GREY; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(276, 43, 7, 0, Math.PI * 2); ctx.moveTo(281, 48); ctx.lineTo(287, 54); ctx.stroke();
      text(t('wr.scr.search'), 298, 51, `400 19px ${SANS}`, '#8a8a8a');
      pencil(W - 262, 42); text(t('wr.scr.write'), W - 244, 51, `400 20px ${SANS}`, GREY);
      bell(W - 140, 42);
    } else {
      text(t('wr.scr.draft'), 48 + wm + 22, 52, `400 18px ${SANS}`, GREY);
      rr(W - 318, 26, 110, 36, 18); ctx.fillStyle = ACCENT_CSS; ctx.fill();
      text(t('wr.scr.publish'), W - 263, 50, `600 17px ${SANS}`, '#fff', 'center');
      for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(W - 170 + k * 9, 44, 2.6, 0, Math.PI * 2); ctx.fillStyle = GREY; ctx.fill(); }
      bell(W - 122, 42);
    }
    avatar(W - 72, 44, 20);
    ctx.fillStyle = LINE; ctx.fillRect(0, 84, W, 2);
  }
  const ACCENT_CSS = '#ff6a2b';
  function profile() {
    topbar(false);
    /* colonna principale */
    text('Andrea Gervasoni', 120, 196, `700 54px ${SANS}`, INK);
    const hw = text(t('wr.scr.home'), 120, 262, `500 19px ${SANS}`, INK);
    text(t('wr.scr.about'), 120 + hw + 36, 262, `400 19px ${SANS}`, GREY);
    ctx.fillStyle = LINE; ctx.fillRect(120, 282, 640, 2); ctx.fillStyle = INK; ctx.fillRect(120, 281, hw, 3);
    /* storie: sagome, non titoli inventati */
    for (let k = 0; k < 3; k++) {
      const y = 322 + k * 158;
      avatar(132, y + 10, 11);
      rr(152, y + 3, 150, 14, 7); ctx.fillStyle = SKEL; ctx.fill();
      rr(120, y + 36, 440 - k * 40, 26, 8); ctx.fillStyle = '#d8d8d8'; ctx.fill();
      rr(120, y + 76, 470, 13, 6); ctx.fillStyle = SKEL; ctx.fill();
      rr(120, y + 98, 380 - k * 30, 13, 6); ctx.fill();
      rr(620, y + 20, 140, 96, 6); ctx.fillStyle = '#eeebe4'; ctx.fill();
      ctx.fillStyle = k === 0 ? ACCENT_CSS : '#d9d4ca'; rr(650, y + 50, 80, 36, 18); ctx.fill();
    }
    /* colonna a destra */
    ctx.fillStyle = LINE; ctx.fillRect(830, 86, 2, H);
    avatar(916, 170, 54);
    text('Andrea Gervasoni', 870, 262, `600 22px ${SANS}`, INK);
    text('@gervandre09', 870, 292, `400 17px ${SANS}`, GREY);
    wrap(t('wr.scr.bio'), 870, 330, 330, 27, `400 18px ${SANS}`, GREY);
    rr(870, 420, 112, 42, 21); ctx.fillStyle = ACCENT_CSS; ctx.fill();
    text(t('wr.scr.follow'), 926, 448, `600 17px ${SANS}`, '#fff', 'center');
    let x = 870, y = 500;
    for (const k of ['wr.t1', 'wr.t2', 'wr.t3', 'wr.t4']) {
      ctx.font = `400 16px ${SANS}`; const w = ctx.measureText(t(k)).width + 32;
      if (x + w > 1220) { x = 870; y += 50; }
      rr(x, y, w, 38, 19); ctx.fillStyle = '#f2f2f2'; ctx.fill(); text(t(k), x + w / 2, y + 25, `400 16px ${SANS}`, INK, 'center');
      x += w + 10;
    }
  }
  function editor(titleN, bodyN, caretOn, published) {
    topbar(true);
    const title = t('wr.scr.title'), body = t('wr.scr.body');
    const X = 250, MAXW = 780;
    let caret;
    if (titleN === 0) { text(t('wr.scr.phTitle'), X, 236, `400 80px ${DISPLAY}`, '#b3b3b3'); caret = { x: X, y: 236, h: 70 }; }
    else { const w = text(title.slice(0, titleN), X, 236, `400 80px ${DISPLAY}`, INK); caret = { x: X + w + 4, y: 236, h: 70 }; }
    /* barra verticale a sinistra e il "+" dell'editor */
    ctx.strokeStyle = '#d6d6d6'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X - 26, 176); ctx.lineTo(X - 26, 246); ctx.stroke();
    if (bodyN === 0) {
      text(t('wr.scr.phBody'), X, 336, `400 36px ${SERIF}`, '#b3b3b3');
      ctx.strokeStyle = '#9a9a9a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X - 60, 324, 18, 0, Math.PI * 2); ctx.moveTo(X - 68, 324); ctx.lineTo(X - 52, 324); ctx.moveTo(X - 60, 316); ctx.lineTo(X - 60, 332); ctx.stroke();
      if (titleN >= title.length) caret = { x: X, y: 336, h: 38 };
    } else {
      const end = wrap(body.slice(0, bodyN), X, 336, MAXW, 58, `400 36px ${SERIF}`, INK);
      caret = { x: end.x + 3, y: end.y, h: 38 };
    }
    if (caretOn && !published) { ctx.fillStyle = INK; ctx.fillRect(caret.x, caret.y - caret.h * 0.82, 3, caret.h); }
    if (published) {
      const k = published;
      ctx.globalAlpha = Math.min(1, k * 2);
      rr(W / 2 - 200, H - 120 + (1 - Math.min(1, k * 2)) * 30, 400, 64, 32); ctx.fillStyle = '#1a1a1a'; ctx.fill();
      ctx.fillStyle = ACCENT_CSS; ctx.beginPath(); ctx.arc(W / 2 - 160, H - 88 + (1 - Math.min(1, k * 2)) * 30, 16, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3.4; ctx.beginPath(); const cy = H - 88 + (1 - Math.min(1, k * 2)) * 30; ctx.moveTo(W / 2 - 168, cy); ctx.lineTo(W / 2 - 162, cy + 6); ctx.lineTo(W / 2 - 152, cy - 6); ctx.stroke();
      text(t('wr.scr.published'), W / 2 + 16, cy + 7, `600 21px ${SANS}`, '#fff', 'center');
      ctx.globalAlpha = 1;
    }
  }
  function cursor(x, y, click) {
    if (click > 0) { ctx.strokeStyle = `rgba(255,106,43,${(1 - click).toFixed(3)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 8 + click * 34, 0, Math.PI * 2); ctx.stroke(); }
    ctx.save(); ctx.translate(x, y); ctx.scale(1.25, 1.25);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 26); ctx.lineTo(7, 20); ctx.lineTo(12, 31); ctx.lineTo(17, 29); ctx.lineTo(12, 18); ctx.lineTo(21, 18); ctx.closePath();
    ctx.fillStyle = '#111'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
  }

  /* s: { power, mode, titleN, bodyN, caret, published, cur: {x, y, click} | null } */
  function draw(s, lang) {
    const key = [lang, s.power.toFixed(2), s.mode, s.titleN, s.bodyN, s.caret, s.published.toFixed(2), s.cur ? `${s.cur.x | 0},${s.cur.y | 0},${s.cur.click.toFixed(2)}` : '-', photoOk].join('|');
    if (key === lastKey && !dirty) return;
    lastKey = key; dirty = false;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    if (s.mode === 'profile') profile(); else editor(s.titleN, s.bodyN, s.caret, s.published);
    if (s.cur) cursor(s.cur.x, s.cur.y, s.cur.click);
    /* acceso/spento: da nero, passando da un lampo */
    if (s.power < 1) { ctx.fillStyle = `rgba(10,11,16,${(1 - s.power).toFixed(3)})`; ctx.fillRect(0, 0, W, H); }
    tex.needsUpdate = true;
  }
  return { tex, draw, W, H, invalidate() { dirty = true; } };
}

/* ---------- tastiera: ogni lettera ha il suo tasto ---------- */
const ROWS = ['1234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm,.'];
const FOLD = { 'à': 'a', 'è': 'e', 'é': 'e', 'ì': 'i', 'ò': 'o', 'ù': 'u', '’': ',', "'": ',', ':': '.', ';': ',', '…': '.', '—': ' ', '-': ' ' };

export function createMedium({ section, canvas, ScrollTrigger, reduced }) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 60);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3440, 1.05));
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(3, 5, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(ACCENT, 1.1); rim.position.set(-4, 2, -3); scene.add(rim);
  const glow = new THREE.PointLight(0xfff4ea, 0, 5, 1.6); glow.position.set(0, 1.2, 0.2); scene.add(glow);

  const laptop = new THREE.Group(); scene.add(laptop);
  /* base */
  const base = new THREE.Mesh(slab(3.3, 2.25, 0.1, 0.16), flat(GRAPH)); base.rotation.x = -Math.PI / 2; base.position.y = -0.05; laptop.add(base);
  const deck = new THREE.Mesh(slab(3.12, 2.08, 0.01, 0.12), flat(GRAPH_HI)); deck.rotation.x = -Math.PI / 2; deck.position.y = 0.012; laptop.add(deck);
  const pad = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.012, 0.58), flat(PAD, { roughness: .4 })); pad.position.set(0, 0.048, 0.7); laptop.add(pad);
  /* tasti */
  const keys = [], keyIndex = {};
  ROWS.forEach((row, r) => {
    const n = row.length, pitch = 0.262, z = -0.72 + r * 0.25, off = [0, 0.08, 0.16, 0.27][r];
    [...row].forEach((ch, i) => { keyIndex[ch] = keys.length; keys.push({ x: (i - (n - 1) / 2) * pitch + off - 0.1, z, w: 0.21, d: 0.2 }); });
  });
  keyIndex[' '] = keys.length; keys.push({ x: 0, z: 0.28, w: 1.35, d: 0.2 });
  keyIndex.shift = keys.length; keys.push({ x: -1.18, z: 0.03, w: 0.36, d: 0.2 });
  keyIndex.enter = keys.length; keys.push({ x: 1.2, z: -0.22, w: 0.34, d: 0.2 });
  const keyGeo = new THREE.BoxGeometry(1, 0.05, 1);
  const keyMesh = new THREE.InstancedMesh(keyGeo, flat(0xffffff, { roughness: .8 }), keys.length);
  const press = new Float32Array(keys.length), m4 = new THREE.Matrix4(), col = new THREE.Color(), cKey = new THREE.Color(KEY), cHot = new THREE.Color(ACCENT);
  function placeKeys() {
    keys.forEach((k, i) => {
      m4.makeScale(k.w, 1, k.d); m4.setPosition(k.x, 0.066 - press[i] * 0.028, k.z); keyMesh.setMatrixAt(i, m4);
      col.copy(cKey).lerp(cHot, press[i] * 0.85); keyMesh.setColorAt(i, col);
    });
    keyMesh.instanceMatrix.needsUpdate = true; keyMesh.instanceColor.needsUpdate = true;
  }
  placeKeys(); laptop.add(keyMesh);
  /* coperchio: cerniera sul bordo dietro */
  const hinge = new THREE.Group(); hinge.position.set(0, 0.02, -1.08); laptop.add(hinge);
  const lid = new THREE.Mesh(slab(3.3, 2.18, 0.07, 0.16), flat(GRAPH)); lid.position.set(0, 1.09, -0.035); hinge.add(lid);
  /* il coperchio (con lo smusso) va da z -0.095 a 0.025: cornice e schermo appena davanti */
  const bezel = new THREE.Mesh(new THREE.PlaneGeometry(3.14, 2.02), flat(0x0d0f14, { roughness: .3 })); bezel.position.set(0, 1.09, 0.028); hinge.add(bezel);
  const screen = createScreen();
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.96, 1.85), new THREE.MeshBasicMaterial({ map: screen.tex, toneMapped: false }));
  panel.position.set(0, 1.11, 0.032); hinge.add(panel);
  /* sul dorso del coperchio il monogramma: una "A" arancione a faccette */
  const logo = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 6), flat(ACCENT, { emissive: ACCENT, emissiveIntensity: .25 }));
  logo.rotation.x = Math.PI / 2; logo.position.set(0, 1.09, -0.1); hinge.add(logo);
  /* ombra morbida sotto */
  const sh = document.createElement('canvas'); sh.width = sh.height = 128;
  const sg = sh.getContext('2d'), grad = sg.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(22,25,35,.42)'); grad.addColorStop(1, 'rgba(22,25,35,0)'); sg.fillStyle = grad; sg.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 3.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sh), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -0.135; laptop.add(shadow);

  /* ---------- stato guidato dallo scroll ---------- */
  let p = 0, typedPrev = '', lang = document.documentElement.lang || 'it';
  const steps = [...section.querySelectorAll('[data-writing-steps] li')];
  const bar = section.querySelector('[data-writing-progress]');
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  section.addEventListener('pointermove', (e) => { pointer.tx = (e.clientX / innerWidth) * 2 - 1; pointer.ty = (e.clientY / innerHeight) * 2 - 1; });
  section.addEventListener('pointerleave', () => { pointer.tx = pointer.ty = 0; });

  ScrollTrigger.create({
    trigger: section, start: 'top top', end: 'bottom bottom', scrub: reduced ? true : 0.6,
    onUpdate: (s) => setProgress(s.progress), onRefresh: (s) => setProgress(s.progress)
  });
  function setProgress(v) {
    p = v;
    const step = p < PH.editor ? 0 : p < PH.published ? 1 : 2;
    steps.forEach((li, i) => { li.classList.toggle('is-on', i === step); li.classList.toggle('is-done', i < step); });
    section.classList.toggle('is-published', p >= PH.published);
    bar?.style.setProperty('--p', p.toFixed(4));
  }

  /* posizioni sullo schermo (px del canvas) dei due pulsanti che il cursore clicca */
  const WRITE_AT = { x: screen.W - 230, y: 44 }, PUBLISH_AT = { x: screen.W - 263, y: 44 }, REST = { x: 690, y: 560 };
  function screenState(time) {
    const power = ease(seg(p, ...PH.power));
    const title = t('wr.scr.title'), body = t('wr.scr.body');
    const mode = p < PH.editor ? 'profile' : 'editor';
    const titleN = Math.round(title.length * seg(p, ...PH.title)), bodyN = Math.round(body.length * seg(p, ...PH.body));
    let cur = null;
    if (p >= PH.toWrite[0] && p < PH.editor + 0.02) {
      const k = ease(seg(p, PH.toWrite[0], PH.toWrite[1]));
      cur = { x: lerp(REST.x, WRITE_AT.x, k), y: lerp(REST.y, WRITE_AT.y, k), click: seg(p, PH.toWrite[1], PH.editor + 0.02) };
    } else if (p >= PH.toPublish[0] - 0.02) {
      const k = ease(seg(p, ...PH.toPublish));
      cur = { x: lerp(REST.x + 140, PUBLISH_AT.x, k), y: lerp(REST.y - 60, PUBLISH_AT.y, k), click: seg(p, PH.toPublish[1], PH.published + 0.02) };
    }
    const caret = reduced ? true : Math.floor(time * 1.9) % 2 === 0;
    return { power, mode, titleN, bodyN, caret, published: seg(p, PH.published, PH.published + 0.05), cur, typed: title.slice(0, titleN) + body.slice(0, bodyN) };
  }

  /* inquadratura: il portatile intero in ogni formato */
  let cw = 0, ch = 0;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h || (w === cw && h === ch)) return;
    cw = w; ch = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  function frame(now, dt) {
    resize();
    if (!cw) return;
    const time = now / 1000;
    const s = screenState(time);
    screen.draw(s, lang);
    /* i tasti delle lettere appena battute si abbassano (e si accendono d'arancio) */
    if (s.typed !== typedPrev) {
      const added = s.typed.startsWith(typedPrev) ? s.typed.slice(typedPrev.length) : '';
      for (const raw of added.slice(-6)) {
        const c = raw.toLowerCase(), k = keyIndex[FOLD[c] ?? c];
        if (raw !== c) press[keyIndex.shift] = 1;                   /* maiuscola */
        if (k !== undefined) press[k] = 1;
      }
      const tl = t('wr.scr.title').length;
      if (typedPrev.length < tl && s.typed.length >= tl + 1) press[keyIndex.enter] = 1;   /* a capo dopo il titolo */
      typedPrev = s.typed;
    }
    let any = false;
    for (let i = 0; i < press.length; i++) if (press[i] > 0) { press[i] = Math.max(0, press[i] - dt * 5); any = true; }
    if (any) placeKeys();

    /* coperchio, rotazione, camera */
    const open = ease(seg(p, ...PH.open));
    hinge.rotation.x = lerp(Math.PI / 2 - 0.035, -0.26, open);
    glow.intensity = s.power * 1.4;
    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 3); pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 3);
    /* camera a tappe: dall'alto a portatile chiuso, poi di fronte; mentre scrive si
       avvicina allo schermo (si legge), alla pubblicazione torna indietro */
    const k = camAt(p);
    laptop.rotation.y = k.rot + pointer.x * 0.1;
    laptop.position.y = Math.sin(time * 1.1) * 0.02 * (reduced ? 0 : 1);
    const vf = THREE.MathUtils.degToRad(camera.fov), hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
    const dist = k.dist * (2.4 / Math.sin(Math.min(vf, hf) / 2)), elev = k.elev + pointer.y * 0.04;
    camera.position.set(Math.sin(0.08) * dist * Math.cos(elev), k.ty + Math.sin(elev) * dist, k.tz + Math.cos(0.08) * dist * Math.cos(elev));
    camera.lookAt(0, k.ty, k.tz);
    renderer.render(scene, camera);
  }

  return {
    frame,
    setLanguage(l) { lang = l; screen.invalidate(); },
    invalidate() { screen.invalidate(); }
  };
}
