/* ------------------------------------------------------------------
   Andrea in 3D, stile gioco retrò: pochi poligoni, ombreggiatura piatta,
   volumi veri. Viso maschile (mascella definita, zigomi, arcata
   sopracciliare), taglio con la riga in mezzo fatto di ciocche-nastro
   che scendono attorno alla fronte. Segue il cursore con testa e occhi,
   sbatte le palpebre, respira e sa salutare con la mano.
   ------------------------------------------------------------------ */
import * as THREE from '../vendor/three.module.min.js';

const COL = {
  skin: 0xefc3a4, skinShade: 0xe1ad8c, hair: 0x4f311d, hairHi: 0x684226, hairLo: 0x3f2616, brow: 0x35200f,
  eyeWhite: 0xf7f3ea, iris: 0x7b8a5a, pupil: 0x15130f, lips: 0xc77e70, lipsLo: 0xd58f80,
  shirt: 0x1f3b33, shirtDark: 0x173029, cord: 0x141414, gold: 0xd6ab4f
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
  [-0.30, 0.94, 0.94, 0.90, 2.9], [-0.45, 0.92, 0.92, 0.84, 3.0], [-0.58, 0.90, 0.90, 0.74, 3.1], [-0.70, 0.76, 0.88, 0.60, 3.2],
  [-0.82, 0.62, 0.86, 0.46, 3.3], [-0.92, 0.52, 0.82, 0.36, 3.4], [-1.00, 0.40, 0.60, 0.30, 3.5]
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

function buildCharacter() {
  const root = new THREE.Group();

  /* --- Busto a V: spalle larghe, torace piatto, vita più stretta. Sotto pelle, sopra la camicia. --- */
  const TOR = [[-1.12, 0.42, 0.36], [-1.28, 0.74, 0.42], [-1.44, 1.14, 0.5], [-1.62, 1.34, 0.56], [-1.95, 1.26, 0.6], [-2.4, 1.1, 0.56], [-2.9, 0.98, 0.52], [-3.3, 1.0, 0.52]];
  const sectionT = (y) => { for (let i = 0; i < TOR.length - 1; i++) { const a = TOR[i], b = TOR[i + 1]; if (y <= a[0] && y >= b[0]) { const t = (a[0] - y) / (a[0] - b[0]); return [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; } } return y > TOR[0][0] ? [TOR[0][1], TOR[0][2]] : [TOR[TOR.length - 1][1], TOR[TOR.length - 1][2]]; };
  const radiusAt = (y) => sectionT(y)[0];                       /* larghezza (usata da finta e bottoni) */
  const loft = (topAt, scale, LON, J, n = 2.6) => {
    const pos = [], idx = [];
    for (let i = 0; i <= LON; i++) {
      const phi = (i / LON) * Math.PI * 2 - Math.PI, sn = Math.sin(phi), c = Math.cos(phi);
      const yt = topAt(phi);
      for (let j = 0; j <= J; j++) {
        const y = yt + (-3.3 - yt) * Math.pow(j / J, 1.8), [hx, hz] = sectionT(y);
        const x = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / n) * hx * scale, z = Math.sign(c) * Math.pow(Math.abs(c), 2 / n) * hz * scale;
        pos.push(x, y, z);
      }
    }
    for (let i = 0; i < LON; i++) for (let j = 0; j < J; j++) { const a = i * (J + 1) + j, b = (i + 1) * (J + 1) + j; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  };
  const skinTorso = new THREE.Mesh(loft(() => -1.1, 0.965, 40, 12), mat(COL.skinShade, { side: THREE.DoubleSide }));
  root.add(skinTorso);
  const torso = new THREE.Group(); root.add(torso);
  {
    /* la camicia sale fino alla base del collo; davanti si apre a V dal collo fin sotto lo sterno */
    const NECK_Y = -1.13, V_DEPTH = 0.52, V_HALF = 0.62;
    const openAt = (phi) => { const v = Math.max(0, 1 - Math.abs(phi) / V_HALF); return NECK_Y - V_DEPTH * Math.pow(v, 1.3); };
    torso.add(new THREE.Mesh(loft(openAt, 1.0, 64, 18), mat(COL.linen, { side: THREE.DoubleSide, roughness: 1 })));
    /* bordo dell'apertura: orlo sottile lungo la V */
    const hem = [];
    for (let i = 0; i <= 48; i++) { const phi = (i / 48) * 2 * V_HALF - V_HALF, yt = openAt(phi), [hx, hz] = sectionT(yt); const sn = Math.sin(phi), c = Math.cos(phi); hem.push(new THREE.Vector3(Math.sign(sn) * Math.pow(Math.abs(sn), 2 / 2.6) * hx * 1.012, yt + 0.004, Math.sign(c) * Math.pow(Math.abs(c), 2 / 2.6) * hz * 1.012)); }
    torso.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hem, false), 96, 0.014, 6, false), mat(COL.linenShade, { roughness: 1 })));
    /* Colletto classico. Il listino (in piedi) gira attorno al collo appoggiato sulla camicia; il bavero
       nasce dal bordo superiore del listino e si ripiega in fuori, adagiandosi sulle spalle: le due punte
       scendono ai lati della V. Listino e bavero condividono lo stesso bordo: nessuno stacco. */
    const NR = [0.46, 0.415], NZ = -0.02, STAND_H = 0.13, A0 = 0.66;      /* raggi del collo (x, z), altezza del listino, apertura davanti */
    const onNeck = (a, sd, r = 1) => [sd * Math.sin(a) * NR[0] * r, 0, Math.cos(a) * NR[1] * r + NZ];
    const shell = (pos, idx, STEPS) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g; };
    const ribbon = (inner, outer, thick) => {
      const STEPS = inner.length - 1, pos = [], idx = [];
      const push = (p, n, off) => pos.push(p[0] + n[0] * off, p[1] + n[1] * off, p[2] + n[2] * off);
      for (let k = 0; k <= STEPS; k++) {
        const i = inner[k], o = outer[k], nk = Math.min(STEPS, k + 1), pk = Math.max(0, k - 1);
        const e1 = [o[0] - i[0], o[1] - i[1], o[2] - i[2]], e2 = [inner[nk][0] - inner[pk][0], inner[nk][1] - inner[pk][1], inner[nk][2] - inner[pk][2]];
        let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
        const l = Math.hypot(...n) || 1; n = n.map((v) => v / l);
        const out = [(i[0] + o[0]) / 2, 0, (i[2] + o[2]) / 2 - NZ]; if (n[0] * out[0] + n[2] * out[2] + n[1] * 0.4 < 0) n = n.map((v) => -v);
        push(i, n, thick / 2); push(o, n, thick / 2); push(i, n, -thick / 2); push(o, n, -thick / 2);
      }
      for (let k = 0; k < STEPS; k++) { const a = k * 4, b = (k + 1) * 4; idx.push(a, a + 1, b, b, a + 1, b + 1, a + 2, b + 2, a + 3, a + 3, b + 2, b + 3, a + 1, a + 3, b + 1, b + 1, a + 3, b + 3, a, b, a + 2, a + 2, b, b + 2); }
      idx.push(0, 2, 1, 1, 2, 3); const e = STEPS * 4; idx.push(e, e + 1, e + 2, e + 1, e + 3, e + 2);
      return shell(pos, idx, STEPS);
    };
    const collarMat = mat(COL.linen, { roughness: .6, side: THREE.DoubleSide });
    for (const sd of [-1, 1]) {
      const STEPS = 22, base = [], top = [], outer = [];
      for (let k = 0; k <= STEPS; k++) {
        const t = k / STEPS, a = A0 + (Math.PI - A0) * t;
        const [bx, , bz] = onNeck(a, sd, 1.0), [tx, , tz] = onNeck(a, sd, 1.04);
        base.push([bx, NECK_Y - 0.01, bz]); top.push([tx, NECK_Y - 0.01 + STAND_H, tz]);
        /* il bavero: largo davanti (la punta), stretto dietro; si piega in fuori e scende lungo la spalla */
        const w = 0.2 + 0.42 * Math.pow(1 - t, 1.5);
        const dx = sd * Math.sin(a), dz = Math.cos(a);
        const lean = 0.58 + 0.32 * t;                                          /* dietro si adagia di più */
        outer.push([tx + dx * w * lean, NECK_Y - 0.01 + STAND_H - w * (0.98 - 0.4 * t) + 0.02, tz + dz * w * lean]);
      }
      /* le punte davanti scendono un po' più in basso e in dentro, verso la V */
      outer[0][1] -= 0.06; outer[0][0] -= sd * 0.1; outer[0][2] += 0.05; outer[1][1] -= 0.03; outer[1][0] -= sd * 0.04; outer[1][2] += 0.02;
      torso.add(new THREE.Mesh(ribbon(base, top, 0.014), collarMat));         /* listino */
      torso.add(new THREE.Mesh(ribbon(top, outer, 0.02), collarMat));         /* bavero */
    }
    /* dietro, il listino continua: un pezzetto che chiude il giro */
    {
      const STEPS = 10, base = [], top = [];
      for (let k = 0; k <= STEPS; k++) { const a = Math.PI - 0.02 + (0.04) * (k / STEPS); const [bx, , bz] = onNeck(a, 1), [tx, , tz] = onNeck(a, 1, 1.04); base.push([bx, NECK_Y - 0.01, bz]); top.push([tx, NECK_Y - 0.01 + STAND_H, tz]); }
      torso.add(new THREE.Mesh(ribbon(base, top, 0.014), collarMat));
    }
    /* finta con bottoni, sotto l'apertura */
    const placket = new THREE.Mesh(new THREE.BoxGeometry(0.17, 1.66, 0.03), mat(COL.linenShade, { roughness: 1 }));
    placket.position.set(0, -2.5, sectionT(-2.5)[1] + 0.006); torso.add(placket);
    for (const by of [-1.78, -2.06, -2.34, -2.62, -2.9, -3.18]) {
      const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.022, 12), mat(COL.button, { roughness: .3 })); btn.rotation.x = Math.PI / 2; btn.position.set(0, by, sectionT(by)[1] + 0.033); torso.add(btn);
      for (const [hx, hy] of [[-0.012, 0.012], [0.012, 0.012], [-0.012, -0.012], [0.012, -0.012]]) { const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.01, 6), mat(0xb8b0a0)); hole.rotation.x = Math.PI / 2; hole.position.set(hx, by + hy, sectionT(by)[1] + 0.046); torso.add(hole); }
    }
  }
  /* collo pieno */
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.44, 0.6, 12), mat(COL.skinShade));
  neck.position.set(0, -1.1, -0.02); root.add(neck);
  /* collanina: cordino scuro a girocollo, due nodini e un piccolo ciondolo d'oro */
  {
    /* il cordino appoggia sulla pelle: dietro alla base del collo (sotto il colletto), davanti scende nella V */
    const pts = [];
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2, f = Math.max(0, Math.cos(a)), y = -1.2 - 0.38 * f * f;
      const x = 0.47 * Math.sin(a) * (1 - 0.35 * f * f), c = Math.cos(a);          /* davanti converge al centro, dentro la V */
      let z = 0.42 * c - 0.02;
      const front = Math.min(1, Math.max(0, (1.15 - Math.min(Math.abs(a), Math.PI * 2 - Math.abs(a))) / 0.3));   /* solo davanti, nella V; ai lati passa sotto il colletto */
      if (front > 0) { const [hx, hz] = sectionT(y); const u = Math.min(1, Math.abs(x) / (hx * 0.965)); const zs = hz * 0.965 * Math.pow(1 - Math.pow(u, 2.6), 1 / 2.6) + 0.02; z = z + (Math.max(z, zs) - z) * front; }
      pts.push(new THREE.Vector3(x, y, z));
    }
    const cord = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 80, 0.014, 6, true), mat(COL.cord, { roughness: .7 }));
    root.add(cord);
    for (const sd of [-1, 1]) { const knot = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 5), mat(COL.cord, { roughness: .7 })); knot.position.set(sd * 0.075, -1.53, sectionT(-1.515)[1] * 0.965 + 0.02); root.add(knot); }
    /* il ciondolo: un polpo d'oro piccolino, testa a cupola e otto tentacoli che si arricciano */
    const charm = new THREE.Group(); charm.position.set(0, -1.6, sectionT(-1.6)[1] * 0.965 + 0.03); root.add(charm);
    const gold = mat(COL.gold, { roughness: .35, metalness: .4, emissive: 0x6b4a10, emissiveIntensity: .35 });
    const bail = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.005, 5, 10), gold); bail.position.y = 0.05; charm.add(bail);
    const headO = new THREE.Mesh(new THREE.SphereGeometry(0.036, 9, 8), gold); headO.scale.set(1, 1.25, 0.8); headO.position.y = 0.006; charm.add(headO);
    for (const sd of [-1, 1]) { const eyeO = new THREE.Mesh(new THREE.SphereGeometry(0.006, 5, 4), mat(COL.cord)); eyeO.position.set(sd * 0.014, -0.004, 0.03); charm.add(eyeO); }
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + 0.2, r0 = 0.026, curl = 0.045 + (k % 3) * 0.008;
      const pts = [];
      for (let t = 0; t <= 6; t++) { const u = t / 6; const rr = r0 + u * 0.03 + Math.sin(u * 2.4) * curl * 0.5; pts.push(new THREE.Vector3(Math.cos(a) * rr * (1 - u * 0.2) + Math.sin(u * 3) * 0.004, -0.028 - u * 0.055 + Math.sin(u * 4) * 0.006, Math.sin(a) * rr * 0.55 + 0.01)); }
      const tent = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.0075 * (1 - 0.0), 5, false), gold); charm.add(tent);
    }
    charm.rotation.y = 0.15;
  }

  /* --- Braccia: più lunghe; il saluto ruota verso l'esterno --- */
  const arms = {};
  for (const s of [-1, 1]) {
    const shoulder = new THREE.Group(); shoulder.position.set(s * 1.26, -1.56, 0); root.add(shoulder);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.21, 0.72, 9), mat(COL.linen, { roughness: .95 })); sleeve.position.y = -0.34; shoulder.add(sleeve);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.25, 9, 7, 0, Math.PI * 2, 0, Math.PI / 2), mat(COL.linen, { roughness: .95 })); cap.position.y = 0.02; shoulder.add(cap);
    const elbow = new THREE.Group(); elbow.position.y = -0.68; shoulder.add(elbow);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.78, 9), mat(COL.linen, { roughness: .95 })); arm.position.y = -0.39; elbow.add(arm);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.17, 0.12, 9), mat(COL.linenShade, { roughness: .95 })); cuff.position.y = -0.82; elbow.add(cuff);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.16, 7, 6), mat(COL.skin)); hand.scale.set(0.85, 1.25, 0.6); hand.position.y = -1.0; elbow.add(hand);
    shoulder.rotation.z = s * 0.08;
    arms[s < 0 ? 'left' : 'right'] = { shoulder, elbow, restZ: s * 0.08 };
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
    corner.position.set(sd * 0.235, -0.51, 0.9); corner.rotation.z = sd * 0.3; corner.rotation.y = sd * 0.35; mouth.add(corner);
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
      const px = Math.cos(a) * r, pz = Math.sin(a) * r * 0.7, py = 0.55 + Math.sin(a * 2.3) * 0.35;
      orbiter.g.position.set(px, py, pz);
      orbiter.g.lookAt(Math.cos(a + 0.2) * r, 0.55 + Math.sin((a + 0.2) * 2.3) * 0.35, Math.sin(a + 0.2) * r * 0.7);
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
