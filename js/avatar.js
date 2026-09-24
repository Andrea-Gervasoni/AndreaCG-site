/* ------------------------------------------------------------------
   Andrea in 3D, stile gioco retrò: pochi poligoni, ombreggiatura piatta,
   volumi veri. Viso maschile (mascella definita, zigomi, arcata
   sopracciliare), taglio con la riga in mezzo fatto di ciocche-nastro
   che scendono attorno alla fronte. Segue il cursore con testa e occhi,
   sbatte le palpebre, respira e sa salutare con la mano.
   ------------------------------------------------------------------ */
import * as THREE from '../vendor/three.module.min.js';

const COL = {
  skin: 0xefc3a4, skinShade: 0xe1ad8c, hair: 0x3f2b1c, hairHi: 0x58412c, hairLo: 0x2c1e13, brow: 0x2e1d10, freckle: 0xd9a080,
  eyeWhite: 0xf7f3ea, iris: 0x7f96a3, pupil: 0x15130f, lips: 0xc77e70, lipsLo: 0xd58f80,
  linen: 0xf5f2eb, linenShade: 0xe3ded3, button: 0xefebe2, cord: 0x141414, gold: 0xd6ab4f
};
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: .92, metalness: 0, ...o });
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* ---------- Testa: loft di sezioni superellittiche ----------
   Ogni anello ha larghezza, profondità davanti/dietro e "quadratura" proprie:
   fronte larga, zigomi, guance piatte, angolo della mandibola netto, mento squadrato. */
/* [y, larghezza, profondità davanti, profondità dietro, esponente (2 = tondo, >3 = squadrato)] */
const HEAD = [
  [1.15, 0.02, 0.02, 0.02, 2.0], [1.05, 0.44, 0.40, 0.46, 2.0], [0.90, 0.74, 0.66, 0.78, 2.2], [0.70, 0.90, 0.84, 0.96, 2.3], [0.50, 0.98, 0.93, 1.02, 2.4],
  [0.30, 0.99, 0.99, 1.02, 2.5], [0.15, 0.99, 0.96, 1.00, 2.6], [0.00, 1.00, 0.98, 0.98, 2.7], [-0.15, 0.97, 0.96, 0.94, 2.8],
  [-0.30, 0.95, 0.95, 0.88, 3.0], [-0.45, 0.93, 0.93, 0.8, 3.2], [-0.56, 0.9, 0.91, 0.66, 3.4], [-0.68, 0.76, 0.9, 0.46, 3.4],
  [-0.80, 0.6, 0.88, 0.3, 3.3], [-0.90, 0.46, 0.84, 0.2, 3.2], [-0.99, 0.34, 0.66, 0.14, 3.0]
];
const HEAD_WX = 0.94;
/* sezione interpolata alla quota y */
function sectionAt(y) {
  if (y >= HEAD[0][0]) return HEAD[0].slice(1);
  for (let i = 0; i < HEAD.length - 1; i++) {
    const a = HEAD[i], b = HEAD[i + 1];
    if (y <= a[0] && y >= b[0]) { const t = (a[0] - y) / (a[0] - b[0]); return [1, 2, 3, 4].map((k) => a[k] + (b[k] - a[k]) * t); }
  }
  return HEAD[HEAD.length - 1].slice(1);
}
/* punto della superficie della testa nella direzione (x, z) alla quota y, spostato di `offset` lungo la normale approssimata */
function surfacePoint(x, y, z, offset = 0) {
  const [W, F, B, n] = sectionAt(y);
  const D = z >= 0 ? F : B, w = Math.max(1e-4, W * HEAD_WX);
  const len = Math.hypot(x, z) || 1e-4;
  const k = Math.pow(Math.pow(Math.abs(x) / w, n) + Math.pow(Math.abs(z) / Math.max(1e-4, D), n), -1 / n);
  const sx = x * k, sz = z * k;
  const nrm = new THREE.Vector3(sx, (y - 0.1) * 0.85, sz).normalize();
  return new THREE.Vector3(sx, y, sz).addScaledVector(nrm, offset);
}

function headGeometry() {
  const P = HEAD.slice(1);
  const SEG = 24, pos = [], idx = [];
  pos.push(0, 1.15, 0);                                        /* polo superiore */
  for (const [y, W, F, B, n] of P) {
    for (let i = 0; i < SEG; i++) {
      const a = (i / SEG) * Math.PI * 2;                        /* 0 = davanti (+z) */
      const c = Math.cos(a), sn = Math.sin(a);
      const z = Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * (c >= 0 ? F : B);
      const x = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / n) * W * HEAD_WX;
      pos.push(x, y, z);
    }
  }
  pos.push(0, -1.06, -0.05);                                   /* polo inferiore, dentro il collo */
  const ring = (r, i) => 1 + r * SEG + (i % SEG);
  for (let i = 0; i < SEG; i++) idx.push(0, ring(0, i), ring(0, i + 1));
  for (let r = 0; r < P.length - 1; r++) for (let i = 0; i < SEG; i++) {
    const a = ring(r, i), b = ring(r, i + 1), c = ring(r + 1, i + 1), d = ring(r + 1, i);
    idx.push(a, c, b, a, d, c);                                  /* facce rivolte all'esterno */
  }
  const last = pos.length / 3 - 1;
  for (let i = 0; i < SEG; i++) idx.push(last, ring(P.length - 1, i + 1), ring(P.length - 1, i));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/* ---------- Capelli: massa aderente alla testa, con la riga in mezzo ---------- */
/* ---------- Capelli: massa aderente alla testa, con la riga in mezzo ---------- */
function hairMassGeometry() {
  const LON = 28, LAT = 10, THICK = 0.1;
  const pos = [], idx = [];
  const hairlineAt = (phi) => {
    const a = Math.abs(phi) / Math.PI, back = Math.pow(a, 2.3);
    let h = 0.5 * (1 - back) + (-0.56) * back;
    const part = Math.max(0, 1 - Math.abs(phi) / 0.42);
    h += 0.34 * part * part;                                       /* la fronte si vede tra le tende */
    const temple = Math.exp(-Math.pow((Math.abs(phi) - 1.55) / 0.5, 2));
    h -= 0.06 * temple;                                            /* sopra le orecchie, corti */
    return h;
  };
  const bump = (phi, u) => {
    let b = 1 + 0.4 * Math.sin(phi * 3.1 + u * 5) * Math.cos(u * 6 + 0.6) + 0.25 * Math.sin(phi * 6.3 + 1.7) * Math.sin(u * 9);
    const top = 1 - smooth(0.3, 0.9, u);
    b -= 0.7 * Math.exp(-Math.pow(phi / 0.16, 2)) * top;           /* la riga: un solco al centro */
    b += 0.55 * Math.exp(-Math.pow((Math.abs(phi) - 0.42) / 0.26, 2)) * top; /* volume ai due lati della riga */
    return b;
  };
  const ring = (i, j) => i * (LAT + 2) + j;
  for (let i = 0; i <= LON; i++) {
    const phi = (i / LON) * Math.PI * 2 - Math.PI;                 /* -π..π, 0 = davanti */
    const yTop = 1.14, yEdge = hairlineAt(phi);
    for (let j = 0; j <= LAT; j++) {
      const u = j / LAT, y = yTop + (yEdge - yTop) * Math.pow(u, 0.85);
      const sp = surfacePoint(Math.sin(phi), y, Math.cos(phi), THICK * bump(phi, u) * (j === LAT ? 1.15 : 1));
      pos.push(sp.x, sp.y, sp.z);
    }
    const inner = surfacePoint(Math.sin(phi), yEdge - 0.04, Math.cos(phi), -0.08);  /* fascia che rientra nella testa */
    pos.push(inner.x, inner.y, inner.z);
  }
  for (let i = 0; i < LON; i++) for (let j = 0; j < LAT + 1; j++) {
    const a = ring(i, j), b = ring(i + 1, j), c = ring(i + 1, j + 1), d = ring(i, j + 1);
    idx.push(a, d, b, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/* Una ciocca-nastro: segue una curva sulla testa, con larghezza che si assottiglia e spessore vero. */
function strandGeometry(points, width, thickness, taper = 0.35) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const N = 14, pos = [], idx = [];
  const center = new THREE.Vector3(0, 0.15, 0);
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const P = curve.getPoint(u), T = curve.getTangent(u).normalize();
    const Nn = P.clone().sub(center).normalize();                 /* verso l'esterno della testa */
    const B = new THREE.Vector3().crossVectors(T, Nn).normalize();
    Nn.crossVectors(B, T).normalize();
    const w = width * (1 - (1 - taper) * u * u), d = thickness * (1 - 0.35 * u);
    const c = [
      P.clone().addScaledVector(B, w / 2).addScaledVector(Nn, d / 2), P.clone().addScaledVector(B, -w / 2).addScaledVector(Nn, d / 2),
      P.clone().addScaledVector(B, -w / 2).addScaledVector(Nn, -d / 2), P.clone().addScaledVector(B, w / 2).addScaledVector(Nn, -d / 2)
    ];
    for (const v of c) pos.push(v.x, v.y, v.z);
  }
  for (let i = 0; i < N; i++) {
    const a = i * 4, b = (i + 1) * 4;
    for (let k = 0; k < 4; k++) { const k2 = (k + 1) % 4; idx.push(a + k, b + k, b + k2, a + k, b + k2, a + k2); }
  }
  idx.push(0, 1, 2, 0, 2, 3);                                      /* tappo iniziale */
  const e = N * 4; idx.push(e, e + 2, e + 1, e, e + 3, e + 2);      /* tappo finale */
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

export function buildCharacter() {
  const root = new THREE.Group();

  /* --- Corpo low-poly a piani netti: pochi lati e sezioni decise, ogni faccia si legge
     (lo stile retrò). Sezioni [y, mezza larghezza, mezza profondità, quadratura] --- */
  const TOR = [
    [-1.1, 0.3, 0.28, 2.2], [-1.2, 0.86, 0.44, 2.8], [-1.38, 1.26, 0.52, 3.2], [-1.62, 1.44, 0.58, 3.4],
    [-2.0, 1.4, 0.64, 3.2], [-2.5, 1.26, 0.6, 3.0], [-3.0, 1.15, 0.56, 2.9], [-3.45, 1.15, 0.56, 2.9]
  ];
  const LON = 20;
  const sectionT = (y) => {
    if (y >= TOR[0][0]) return TOR[0].slice(1);
    for (let i = 0; i < TOR.length - 1; i++) { const a = TOR[i], b = TOR[i + 1]; if (y <= a[0] && y >= b[0]) { const t = (a[0] - y) / (a[0] - b[0]); return [1, 2, 3].map((k) => a[k] + (b[k] - a[k]) * t); } }
    return TOR[TOR.length - 1].slice(1);
  };
  /* pieghe della stoffa: onde larghe che scendono verso la vita e partono dalle ascelle;
     davanti al centro restano piatte (lì c'è l'abbottonatura). Con le facce piatte si
     leggono come piani di tessuto, non come righe. */
  const fold = (phi, y) => {
    const down = smooth(-1.55, -2.6, y), front = 1 - Math.exp(-Math.pow(phi / 0.32, 2)) - Math.exp(-Math.pow((Math.abs(phi) - Math.PI) / 0.3, 2)) * 0.5;
    const arm = Math.exp(-Math.pow((Math.abs(phi) - 1.25) / 0.35, 2)) * Math.exp(-Math.pow((y + 1.95) / 0.35, 2));
    return (0.03 * Math.sin(phi * 7 + 0.8 + y * 0.9) * down + 0.035 * arm * Math.sin(y * 9 + Math.abs(phi) * 4)) * front;
  };
  const ringPoint = (phi, row) => { const [y, hx, hz, n] = row; const sn = Math.sin(phi), c = Math.cos(phi); const k = 1 + fold(phi, y); return [Math.sign(sn) * Math.pow(Math.abs(sn), 2 / n) * hx * k, y, Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * hz * k]; };
  /* profondità della superficie davanti, nel punto (x, y) */
  const frontZ = (x, y) => { const [hx, hz, n] = sectionT(y); const u = Math.min(0.995, Math.abs(x) / hx); return hz * Math.pow(1 - Math.pow(u, n), 1 / n); };
  const onFront = (x, y, lift) => new THREE.Vector3(x, y, frontZ(x, y) + lift);
  const meshFrom = (pos, idx) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); if (idx) g.setIndex(idx); g.computeVertexNormals(); return g; };
  /* griglia appoggiata sul petto: xs(v) → [xmin, xmax], y(v) */
  const patch = (cols, rows, xAt, yAt, lift) => {
    const pos = [], idx = [];
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) { const v = j / rows, u = i / cols, [x0, x1] = xAt(v), y = yAt(v), x = x0 + (x1 - x0) * u, p = onFront(x, y, lift); pos.push(p.x, p.y, p.z); }
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const a = j * (cols + 1) + i, b = a + cols + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    return meshFrom(pos, idx);
  };
  /* sagoma piana (punti 2D sul petto) estrusa con spessore, sollevata dalla camicia */
  const plate = (pts2, liftAt, thick) => {
    const top = pts2.map(([x, y], k) => onFront(x, y, liftAt(k))), bot = top.map((p) => p.clone().add(new THREE.Vector3(0, 0, -thick)));
    const tris = THREE.ShapeUtils.triangulateShape(pts2.map(([x, y]) => new THREE.Vector2(x, y)), []);
    const pos = [], push = (v) => pos.push(v.x, v.y, v.z);
    for (const [a, b, c] of tris) { push(top[a]); push(top[b]); push(top[c]); push(bot[a]); push(bot[c]); push(bot[b]); }
    for (let k = 0; k < top.length; k++) { const k2 = (k + 1) % top.length; push(top[k]); push(bot[k]); push(top[k2]); push(top[k2]); push(bot[k]); push(bot[k2]); }
    return meshFrom(pos);
  };

  const torso = new THREE.Group(); root.add(torso);
  {
    const shirt = mat(COL.linen, { roughness: .95, side: THREE.DoubleSide });
    const shade = mat(COL.linenShade, { roughness: .95, side: THREE.DoubleSide });
    const collarMat = mat(0xfbf8f1, { roughness: .85, side: THREE.DoubleSide });
    /* busto */
    const pos = [], idx = [];
    const ROWS = []; for (let j = 0; j < TOR.length; j++) { ROWS.push(TOR[j]); if (j < TOR.length - 1) { const y = (TOR[j][0] + TOR[j + 1][0]) / 2; ROWS.push([y, ...sectionT(y)]); } }
    for (const row of ROWS) for (let i = 0; i < LON; i++) pos.push(...ringPoint((i / LON) * Math.PI * 2, row));
    for (let j = 0; j < ROWS.length - 1; j++) for (let i = 0; i < LON; i++) { const a = j * LON + i, b = j * LON + (i + 1) % LON, c = (j + 1) * LON + i, d = (j + 1) * LON + (i + 1) % LON; idx.push(a, c, b, b, c, d); }
    const top = pos.length / 3; pos.push(0, -1.08, -0.04); for (let i = 0; i < LON; i++) idx.push(top, i, (i + 1) % LON);
    torso.add(new THREE.Mesh(meshFrom(pos, idx), shirt));
    /* scollo a V: pelle */
    /* sbottonata in alto (due bottoni aperti): lo scollo scende fino al primo bottone chiuso */
    torso.add(new THREE.Mesh(patch(3, 6, (v) => { const w = 0.4 * Math.pow(1 - v, 1.1) + 0.005; return [-w, w]; }, (v) => -1.05 - 0.97 * v, 0.04), mat(COL.skinShade)));
    /* colletto: fascetta attorno al collo, aperta davanti… */
    {
      const A0 = 0.64, SEG = 12, p = [], ix = [];
      for (let k = 0; k <= SEG; k++) {
        const a = A0 + (Math.PI * 2 - 2 * A0) * (k / SEG), s = Math.sin(a), c = Math.cos(a);
        p.push(s * 0.5, -1.18, c * 0.46 - 0.02, s * 0.46, -0.95, c * 0.43 - 0.02);
      }
      for (let k = 0; k < SEG; k++) { const a = k * 2; ix.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      torso.add(new THREE.Mesh(meshFrom(p, ix), collarMat));
      /* …e le due ali che si aprono e si adagiano sul petto, con la punta verso lo scollo */
      for (const sd of [-1, 1]) {
        const pts = [[0.32, -0.96], [0.66, -1.05], [1.0, -1.36], [0.44, -1.74], [0.28, -1.3]].map(([x, y]) => [sd * x, y]);
        const lifts = [0.13, 0.11, 0.09, 0.1, 0.12];
        if (sd < 0) { pts.reverse(); lifts.reverse(); }
        torso.add(new THREE.Mesh(plate(pts, (k) => lifts[k], 0.045), collarMat));
      }
    }
    /* i due lembi del davanti, aperti e rovesciati: bordo con spessore dal colletto al primo bottone */
    for (const sd of [-1, 1]) {
      const pts = [[0.3, -1.3], [0.5, -1.4], [0.13, -2.06], [0.02, -2.04]].map(([x, y]) => [sd * x, y]);
      const lifts = [0.08, 0.07, 0.035, 0.04];
      if (sd < 0) { pts.reverse(); lifts.reverse(); }
      torso.add(new THREE.Mesh(plate(pts, (k) => lifts[k], 0.035), collarMat));
    }
    /* abbottonatura dal primo bottone chiuso in giù */
    torso.add(new THREE.Mesh(patch(1, 6, () => [-0.09, 0.09], (v) => -2.0 - 1.45 * v, 0.01), shade));
    for (const by of [-2.12, -2.46, -2.8, -3.14]) {
      const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.024, 6), mat(COL.button, { roughness: .4 }));
      btn.rotation.x = Math.PI / 2; btn.position.set(0, by, frontZ(0, by) + 0.025); torso.add(btn);
    }
  }
  /* collo a otto lati */
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.41, 0.66, 8), mat(COL.skinShade));
  neck.position.set(0, -1.02, -0.04); root.add(neck);
  /* collanina: cordino scuro che scende nello scollo, due nodini e un piccolo polpo d'oro */
  {
    const pts = [];
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2, f = Math.max(0, Math.cos(a));
      const y = -1.3 - 0.26 * f * f * f, x = 0.44 * Math.sin(a) * (1 - 0.45 * f * f);
      let z = 0.42 * Math.cos(a) - 0.02;
      /* nello scollo appoggia sulla pelle; ai lati passa sotto le ali del colletto */
      const vHalf = 0.4 * Math.pow(Math.max(0, 1 - (-1.05 - y) / 0.97), 1.1);
      if (f > 0.3) z = Math.max(z, frontZ(x, y) + (Math.abs(x) < vHalf - 0.02 ? 0.05 : 0.012));
      pts.push(new THREE.Vector3(x, y, z));
    }
    root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 64, 0.014, 5, true), mat(COL.cord, { roughness: .7 })));
    for (const sd of [-1, 1]) { const knot = new THREE.Mesh(new THREE.SphereGeometry(0.02, 5, 4), mat(COL.cord, { roughness: .7 })); knot.position.set(sd * 0.07, -1.5, frontZ(sd * 0.07, -1.5) + 0.052); root.add(knot); }
    const charm = new THREE.Group(); charm.position.set(0, -1.585, frontZ(0, -1.585) + 0.06); root.add(charm);
    const gold = mat(COL.gold, { roughness: .35, metalness: .4, emissive: 0x6b4a10, emissiveIntensity: .35 });
    const bail = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.005, 5, 10), gold); bail.position.y = 0.05; charm.add(bail);
    const headO = new THREE.Mesh(new THREE.SphereGeometry(0.036, 9, 8), gold); headO.scale.set(1, 1.25, 0.8); headO.position.y = 0.006; charm.add(headO);
    for (const sd of [-1, 1]) { const eyeO = new THREE.Mesh(new THREE.SphereGeometry(0.006, 5, 4), mat(COL.cord)); eyeO.position.set(sd * 0.014, -0.004, 0.03); charm.add(eyeO); }
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + 0.2, r0 = 0.026, curl = 0.045 + (k % 3) * 0.008, tp = [];
      for (let t = 0; t <= 6; t++) { const u = t / 6; const rr = r0 + u * 0.03 + Math.sin(u * 2.4) * curl * 0.5; tp.push(new THREE.Vector3(Math.cos(a) * rr * (1 - u * 0.2) + Math.sin(u * 3) * 0.004, -0.028 - u * 0.055 + Math.sin(u * 4) * 0.006, Math.sin(a) * rr * 0.55 + 0.01)); }
      charm.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tp), 10, 0.0075, 5, false), gold));
    }
    charm.rotation.y = 0.15;
  }

  /* --- Braccia a otto lati: partono dentro la spalla, il saluto ruota verso l'esterno --- */
  const arms = {};
  for (const s of [-1, 1]) {
    const shoulder = new THREE.Group(); shoulder.position.set(s * 1.28, -1.74, 0); root.add(shoulder);
    const sleeveMat = mat(COL.linen, { roughness: .95 });
    const delt = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), sleeveMat); delt.scale.set(1, 0.92, 1.05); delt.position.set(s * 0.02, 0.02, 0); shoulder.add(delt);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.235, 0.76, 8), sleeveMat); sleeve.position.y = -0.37; shoulder.add(sleeve);
    const elbow = new THREE.Group(); elbow.position.y = -0.74; shoulder.add(elbow);
    elbow.add(new THREE.Mesh(new THREE.SphereGeometry(0.235, 8, 6), sleeveMat));
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.195, 0.78, 8), sleeveMat); arm.position.y = -0.39; elbow.add(arm);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.2, 0.14, 8), mat(COL.linenShade, { roughness: .95 })); cuff.position.y = -0.82; elbow.add(cuff);
    const handMat = mat(COL.skin, { roughness: .7 });
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.24, 0.1), handMat); palm.position.y = -1.0; elbow.add(palm);
    const fingers = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.2, 0.085), handMat); fingers.position.set(0, -1.2, 0.01); fingers.rotation.x = 0.12; elbow.add(fingers);
    const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.15, 0.07), handMat); thumb.position.set(-s * 0.12, -1.02, 0.05); thumb.rotation.z = -s * 0.35; elbow.add(thumb);
    shoulder.rotation.z = s * 0.1;
    arms[s < 0 ? 'left' : 'right'] = { shoulder, elbow, restZ: s * 0.1 };
  }

  /* --- Testa --- */
  const head = new THREE.Group(); head.position.set(0, -1.0, 0); root.add(head);
  const H = new THREE.Group(); H.position.set(0, 1.0, 0); H.scale.setScalar(0.97); head.add(H);
  H.add(new THREE.Mesh(headGeometry(), mat(COL.skin)));
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.19, 7, 6), mat(COL.skinShade));
    ear.scale.set(0.4, 1, 0.7); ear.position.set(s * 0.95, -0.1, -0.12); ear.rotation.y = s * 0.3; H.add(ear);
  }
  /* naso dritto: dorso + punta */
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.5, 0.15), mat(COL.skinShade));
  bridge.position.set(0, 0.04, 0.97); bridge.rotation.x = 0.2; H.add(bridge);
  const nose = new THREE.Mesh(new THREE.OctahedronGeometry(0.17), mat(COL.skinShade));
  nose.scale.set(0.78, 1.05, 1.5); nose.position.set(0, -0.24, 1.0); H.add(nose);
  /* bocca: labbro superiore sottile, inferiore più pieno, angoli appena su */
  const mouth = new THREE.Group(); H.add(mouth);
  const lipUp = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.08), mat(COL.lips)); lipUp.position.set(0, -0.52, 0.93); mouth.add(lipUp);
  const lipLo = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.085, 0.09), mat(COL.lipsLo)); lipLo.position.set(0, -0.585, 0.92); mouth.add(lipLo);
  for (const sd of [-1, 1]) {
    const corner = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.045, 0.07), mat(COL.lips));
    corner.position.set(sd * 0.225, -0.522, 0.9); corner.rotation.z = sd * 0.1; corner.rotation.y = sd * 0.35; mouth.add(corner);
  }
  /* sopracciglia: dritte, folte, basse */
  const brows = new THREE.Group(); H.add(brows);
  for (const s of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.105, 0.1), mat(COL.brow));
    b.position.set(s * 0.37, 0.3, 0.99); b.rotation.z = s * -0.06; b.rotation.y = s * 0.36; brows.add(b);
  }
  /* occhi */
  const eyes = { groups: [], irises: [], lids: [] };
  for (const s of [-1, 1]) {
    const eye = new THREE.Group(); eye.position.set(s * 0.35, 0.1, 0.9); eye.rotation.y = s * 0.28; H.add(eye);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.16, 9, 7), mat(COL.eyeWhite, { roughness: .5 })); ball.scale.set(1, 0.68, 0.55); eye.add(ball);
    const irisG = new THREE.Group(); irisG.position.z = 0.035; eye.add(irisG);
    const iris = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.03, 10), mat(COL.iris, { roughness: .4 })); iris.rotation.x = Math.PI / 2; iris.position.z = 0.04; irisG.add(iris);
    const pupil = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.02, 8), mat(COL.pupil, { roughness: .3 })); pupil.rotation.x = Math.PI / 2; pupil.position.z = 0.062; irisG.add(pupil);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.014, 5, 4), new THREE.MeshBasicMaterial({ color: 0xffffff })); glint.position.set(0.026, 0.028, 0.08); irisG.add(glint);
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.175, 9, 5, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(COL.skin));
    lid.scale.set(1, 0.8, 0.6); lid.position.z = -0.005; lid.rotation.x = -0.18; lid.userData.open = -0.18; eye.add(lid);
    eyes.groups.push(eye); eyes.irises.push(irisG); eyes.lids.push(lid);
  }
  /* lentiggini: piccoli esagoni piatti su naso e zigomi, come nella foto */
  {
    const fg = new THREE.CircleGeometry(0.013, 6), fm = mat(COL.freckle), out = new THREE.Vector3();
    let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 16; k++) {
      const sd = k % 2 ? 1 : -1, x = sd * (0.1 + rnd() * 0.46), y = -0.02 - rnd() * 0.26;
      if (Math.abs(x) < 0.12 && y < -0.12) continue;             /* non sulla punta del naso */
      const p = surfacePoint(x, y, 1, 0.006), f = new THREE.Mesh(fg, fm);
      f.position.copy(p); f.lookAt(out.copy(p).multiplyScalar(2)); f.scale.setScalar(0.6 + rnd() * 0.6); H.add(f);
    }
  }

  /* --- Capelli: massa con la riga + ciocche-nastro --- */
  const hair = new THREE.Group(); H.add(hair);
  hair.add(new THREE.Mesh(hairMassGeometry(), mat(COL.hair)));
  const strands = [
    /* tende frontali: dalla riga, giù attorno alla fronte fino alla tempia (per lato) */
    { pts: [[0.04, 1.06, 0.62], [0.18, 0.96, 0.86], [0.46, 0.72, 0.92], [0.72, 0.42, 0.8], [0.88, 0.16, 0.6]], w: 0.4, d: 0.14, col: COL.hairHi },
    { pts: [[0.03, 1.1, 0.42], [0.32, 1.02, 0.72], [0.62, 0.8, 0.84], [0.88, 0.5, 0.66], [0.98, 0.28, 0.44]], w: 0.34, d: 0.13, col: COL.hair },
    { pts: [[0.12, 0.92, 0.88], [0.34, 0.76, 0.98], [0.56, 0.54, 0.92], [0.7, 0.36, 0.8]], w: 0.22, d: 0.1, col: COL.hairLo },
    /* ciocche laterali che vanno all'indietro sopra l'orecchio */
    { pts: [[0.74, 0.82, 0.5], [0.98, 0.6, 0.2], [1.04, 0.42, -0.2], [0.96, 0.3, -0.55]], w: 0.36, d: 0.12, col: COL.hair },
    { pts: [[0.58, 1.02, 0.1], [0.9, 0.84, -0.3], [0.94, 0.62, -0.7], [0.72, 0.48, -0.96]], w: 0.36, d: 0.12, col: COL.hairHi },
    /* dietro */
    { pts: [[0.22, 1.02, -0.5], [0.42, 0.72, -0.96], [0.4, 0.32, -1.06], [0.3, 0.02, -1.0]], w: 0.42, d: 0.12, col: COL.hairLo }
  ];
  for (const sd of [-1, 1]) for (const st of strands) {
    /* i punti di controllo vengono appoggiati sulla superficie della testa (sopra la massa dei capelli) */
    const pts = st.pts.map(([x, y, z]) => { const sp = surfacePoint(sd * x, y, z, 0.1 + st.d / 2 + 0.01); return [sp.x, sp.y, sp.z]; });
    const m = new THREE.Mesh(strandGeometry(pts, st.w, st.d), mat(sd < 0 ? st.col : (st.col === COL.hairHi ? COL.hair : st.col), { side: THREE.DoubleSide }));
    hair.add(m);
  }

  return { root, head, brows, eyes, mouth, arms, torso };
}

export function createAvatar(canvas, { framing = 'hero' } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50);

  scene.add(new THREE.HemisphereLight(0xfff6ec, 0x8a7468, 0.95));
  const key = new THREE.DirectionalLight(0xffffff, 1.9); key.position.set(2.6, 3.4, 4.0); scene.add(key);
  /* ombre morbide: danno corpo al colletto, ai capelli e alla mascella */
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0006; key.shadow.normalBias = 0.03; key.shadow.radius = 3;
  Object.assign(key.shadow.camera, { left: -3.2, right: 3.2, top: 3, bottom: -4.2, near: 0.5, far: 14 }); key.shadow.camera.updateProjectionMatrix();
  const rim = new THREE.DirectionalLight(0xffb28a, 0.9); rim.position.set(-3.5, 1.2, -2.5); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xdfe8ff, 0.45); fill.position.set(-2.5, -1, 3); scene.add(fill);

  const c = buildCharacter();
  c.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(c.root);

  /* Nella hero un aeroplanino di carta in wireframe gira attorno alla testa: quando il cursore è fermo, Andrea lo segue con lo sguardo. */
  let orbiter = null;
  if (framing === 'hero') {
    const g = new THREE.Group();
    const tri = (a, b, cc) => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...cc], 3)); return geo; };
    const N = [0, 0, 0.42], T = [0, 0.02, -0.34], K = [0, -0.14, -0.31], L = [-0.34, 0.04, -0.34], R = [0.34, 0.04, -0.34], Li = [-0.05, 0, -0.34], Ri = [0.05, 0, -0.34];
    const lineMat = new THREE.LineBasicMaterial({ color: 0xff6a2b, transparent: true, opacity: 0.85 });
    for (const [a, b, cc] of [[N, L, Li], [N, Ri, R], [N, Li, T], [N, T, Ri], [N, K, Li], [N, Ri, K]]) g.add(new THREE.LineSegments(new THREE.EdgesGeometry(tri(a, b, cc)), lineMat));
    const fill = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([...N, ...L, ...Li, ...N, ...Ri, ...R], 3)), new THREE.MeshBasicMaterial({ color: 0xff6a2b, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
    g.add(fill);
    /* scia tratteggiata */
    const TR = 40, trailPos = new Float32Array(TR * 3);
    const trail = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(trailPos, 3)), new THREE.LineDashedMaterial({ color: 0xff6a2b, dashSize: 0.08, gapSize: 0.07, transparent: true, opacity: 0.35 }));
    scene.add(g, trail);
    orbiter = { g, trail, trailPos, TR, hist: [], a: 0 };
  }

  const st = {
    yaw: 0, pitch: 0, tYaw: 0, tPitch: 0, pointer: { x: 0, y: 0, on: 0 }, time: 0,
    nextBlink: 2 + Math.random() * 3, blink: -1, wave: -1, scale: 1, w: 1, h: 1, extraYaw: 0,
    sincePointer: 10, nextAct: 5, browT: 0, tiltT: 0, hideOrbiter: false
  };

  function resize() {
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
    if (w === st.w && h === st.h) return;
    st.w = w; st.h = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const aspect = w / h;
    let visH, cy;
    if (framing === 'footer') { visH = Math.max(3.9, 3.3 / aspect); cy = -0.75 - (visH - 3.9) * 0.2; }
    else if (aspect < 0.8) { visH = 6.3; cy = -3.3 + visH / 2 - 0.08; }                 /* telefono: come un ritratto, il busto tocca il fondo */
    else { visH = Math.max(3.9, 4.0 / aspect); cy = -0.22 - (visH - 3.9) * 0.4; }
    const dist = (visH / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.position.set(0, cy + 0.15, dist);
    camera.lookAt(0, cy, 0);
    camera.updateProjectionMatrix();
  }
  resize();

  const ease = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  function frame(now, dt) {
    resize();
    st.time += dt;
    const t = st.time;
    let idleYaw = Math.sin(t * 0.55) * 0.10 + Math.sin(t * 0.23) * 0.06;
    let idlePitch = Math.sin(t * 0.9) * 0.03;
    /* l'aeroplanino gira attorno alla testa; se il cursore è fermo da un po', lo sguardo lo segue */
    st.sincePointer += dt;
    const idle = st.sincePointer > 3.5 || st.pointer.on < 0.05;
    if (orbiter) {
      orbiter.a += dt * 0.55;
      const a = orbiter.a, r = 2.15 + Math.sin(a * 1.7) * 0.15;
      /* orbita sopra la testa: davanti al viso sembrava un errore */
      const px = Math.cos(a) * r, pz = Math.sin(a) * r * 0.7, py = 1.55 + Math.sin(a * 2.3) * 0.12;
      orbiter.g.position.set(px, py, pz);
      orbiter.g.lookAt(Math.cos(a + 0.2) * r, 1.55 + Math.sin((a + 0.2) * 2.3) * 0.12, Math.sin(a + 0.2) * r * 0.7);
      orbiter.g.rotateZ(-0.5);
      orbiter.hist.unshift([px, py - 0.02, pz]); if (orbiter.hist.length > orbiter.TR) orbiter.hist.pop();
      for (let i = 0; i < orbiter.TR; i++) { const h = orbiter.hist[Math.min(i, orbiter.hist.length - 1)]; orbiter.trailPos[i * 3] = h[0]; orbiter.trailPos[i * 3 + 1] = h[1]; orbiter.trailPos[i * 3 + 2] = h[2]; }
      orbiter.trail.geometry.attributes.position.needsUpdate = true; orbiter.trail.computeLineDistances();
      orbiter.g.visible = orbiter.trail.visible = !st.hideOrbiter;
      if (idle && pz > -0.4) {                      /* lo segue solo quando passa davanti o di lato */
        idleYaw = Math.atan2(px, pz + 1.5) * 0.7;
        idlePitch = -Math.atan2(py - 0.2, Math.hypot(px, pz + 1.5)) * 0.6;
      }
    }
    /* micro-azioni casuali quando non succede nulla: sopracciglia, doppio battito, un saluto ogni tanto */
    st.nextAct -= dt;
    if (st.nextAct <= 0) {
      const roll = Math.random();
      if (roll < 0.35) st.browT = 0.9; else if (roll < 0.6) { st.blink = 0; st.nextBlink = t + 0.28; } else if (roll < 0.8) st.tiltT = 1.2; else if (framing === 'hero' && st.wave < 0) st.wave = 0;
      st.nextAct = 6 + Math.random() * 7;
    }
    if (st.browT > 0) { st.browT -= dt; c.brows.position.y = Math.sin(Math.min(1, st.browT / 0.9) * Math.PI) * 0.045; } else if (st.wave < 0) c.brows.position.y = 0;
    if (st.tiltT > 0) { st.tiltT -= dt; }
    const tilt = st.tiltT > 0 ? Math.sin(Math.min(1, st.tiltT / 1.2) * Math.PI) * 0.12 : 0;
    const pOn = idle ? Math.min(st.pointer.on, 0.35) : st.pointer.on;
    st.tYaw = (st.pointer.x * 0.62) * pOn + idleYaw * (1 - pOn * 0.6) + st.extraYaw;
    st.tPitch = (-st.pointer.y * 0.36) * pOn + idlePitch;
    const k = 1 - Math.exp(-dt * 5.5);
    st.yaw += (st.tYaw - st.yaw) * k;
    st.pitch += (st.tPitch - st.pitch) * k;
    c.head.rotation.set(st.pitch, st.yaw, -st.yaw * 0.08 + tilt);
    c.head.position.y = -1.0 + Math.sin(t * 1.6) * 0.012;
    c.root.rotation.y = st.yaw * 0.18;
    c.torso.scale.y = 1 + Math.sin(t * 1.6) * 0.008;
    for (const ir of c.eyes.irises) {
      ir.position.x = (st.pointer.x * 0.045) * pOn + Math.sin(t * 0.5) * 0.006;
      ir.position.y = (st.pointer.y * 0.03) * pOn;
    }
    if (st.blink < 0 && t > st.nextBlink) { st.blink = 0; st.nextBlink = t + 2.2 + Math.random() * 4 + (Math.random() < 0.2 ? 0.25 : 0); }
    if (st.blink >= 0) {
      st.blink += dt / 0.16;
      const b = st.blink >= 1 ? 0 : Math.sin(st.blink * Math.PI);
      for (const lid of c.eyes.lids) lid.rotation.x = lid.userData.open + b * 1.15;
      for (const g of c.eyes.groups) g.scale.y = 1 - b * 0.35;
      if (st.blink >= 1) st.blink = -1;
    }
    const R = c.arms.right, L = c.arms.left;
    if (st.wave >= 0) {
      st.wave += dt;
      const T = 2.3, w = st.wave;
      const up = ease(Math.min(1, w / 0.45)) * (1 - ease(Math.max(0, (w - (T - 0.5)) / 0.5)));
      /* il braccio destro sale verso l'esterno, l'avambraccio oscilla attorno alla verticale */
      R.shoulder.rotation.z = R.restZ + up * 2.35;
      R.shoulder.rotation.x = up * -0.25;
      const osc = w > 0.4 && w < T - 0.5 ? Math.sin((w - 0.4) * 11) * 0.5 : 0;
      R.elbow.rotation.z = up * (0.9 + osc);
      R.elbow.rotation.y = up * -0.2;
      c.brows.position.y = up * 0.035;
      c.mouth.scale.x = 1 + up * 0.18;
      st.extraYaw = up * 0.12;
      if (w >= T) { st.wave = -1; st.extraYaw = 0; R.elbow.rotation.set(0, 0, 0); R.shoulder.rotation.set(0, 0, R.restZ); }
    } else {
      R.shoulder.rotation.z = R.restZ + Math.sin(t * 1.3) * 0.015;
      L.shoulder.rotation.z = L.restZ - Math.sin(t * 1.3 + 1) * 0.015;
    }
    renderer.render(scene, camera);
  }

  return {
    frame,
    setPointer(nx, ny, on = 1) { st.pointer.x = THREE.MathUtils.clamp(nx, -1, 1); st.pointer.y = THREE.MathUtils.clamp(ny, -1, 1); st.pointer.on += (on - st.pointer.on) * 0.5; st.sincePointer = 0; },
    setOrbiterVisible(v) { st.hideOrbiter = !v; },
    releasePointer() { st.pointer.on = 0; },
    wave() { if (st.wave < 0) st.wave = 0; },
    resize,
    renderer, scene, character: c
  };
}
