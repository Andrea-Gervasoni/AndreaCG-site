/* ------------------------------------------------------------------
   Il percorso come volo.
   Un aeroplanino di carta segue una rotta 3D sopra la mappa: si inclina
   in virata, lascia una scia, rallenta a ogni tappa. La camera lo insegue;
   le schede delle esperienze sono ancorate ai segnaposti nello spazio e
   compaiono quando l'aereo arriva. Lo scroll guida tutto.
   ------------------------------------------------------------------ */
import * as THREE from '../vendor/three.module.min.js';

const PAPER = 0xf4f1e8, PAPER_SHADE = 0xd9d4c6, ACCENT = 0xff6a2b, INK = 0x161923, MUTED = 0x9aa0ad;
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .85, metalness: 0, flatShading: true, ...o });
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* Aeroplanino di carta: dardo classico, doppia faccia, con un adesivo arancione sull'ala. */
function buildPlane() {
  const g = new THREE.Group();
  const tri = (a, b, c, color, side = THREE.DoubleSide) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c], 3));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, std(color, { side })); g.add(m); return m;
  };
  const N = [0, 0, 0.62], T = [0, 0.03, -0.5], K = [0, -0.2, -0.46];
  const L = [-0.5, 0.06, -0.5], R = [0.5, 0.06, -0.5];
  const Li = [-0.08, 0.0, -0.5], Ri = [0.08, 0.0, -0.5];
  /* ali (con leggero diedro) e pannelli del corpo */
  tri(N, L, Li, PAPER); tri(N, Ri, R, PAPER);
  tri(N, Li, T, PAPER_SHADE); tri(N, T, Ri, PAPER_SHADE);
  tri(N, K, Li, PAPER_SHADE); tri(N, Ri, K, PAPER_SHADE);
  /* adesivo */
  tri([-0.36, 0.062, -0.48], [-0.2, 0.052, -0.48], [-0.26, 0.048, -0.3], ACCENT);
  g.rotation.order = 'YXZ';
  return g;
}

function shadowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const grd = ctx.createRadialGradient(64, 64, 4, 64, 64, 60);
  grd.addColorStop(0, 'rgba(22,25,35,.34)'); grd.addColorStop(1, 'rgba(22,25,35,0)');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createFlight({ canvas, section, cards, progressBar }) {
  /* linee guida dal segnaposto alla scheda (overlay SVG sopra il canvas) */
  const NS = 'http://www.w3.org/2000/svg';
  const leaders = document.createElementNS(NS, 'svg');
  leaders.setAttribute('class', 'exp-leaders'); leaders.setAttribute('aria-hidden', 'true');
  const leaderPaths = cards.map(() => { const p = document.createElementNS(NS, 'path'); p.setAttribute('fill', 'none'); leaders.append(p); return p; });
  const leaderDots = cards.map(() => { const c = document.createElementNS(NS, 'circle'); c.setAttribute('r', '4'); leaders.append(c); return c; });
  canvas.after(leaders);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6d675c, 0.85));
  const key = new THREE.DirectionalLight(0xffffff, 2.0); key.position.set(3, 6, 2); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffb28a, 0.6); rim.position.set(-4, 2, -3); scene.add(rim);

  /* --- rotta: tappe e punti di controllo (una S tra una tappa e l'altra) --- */
  const STOPS = [
    new THREE.Vector3(-3.6, 0, 0), new THREE.Vector3(2.6, 0, -6.5), new THREE.Vector3(-3.0, 0, -13), new THREE.Vector3(2.8, 0, -19.5), new THREE.Vector3(-2.4, 0, -26)
  ];
  const ctrl = [new THREE.Vector3(-8, 0, 7), new THREE.Vector3(-6.5, 0, 3.4)];
  STOPS.forEach((s, i) => {
    ctrl.push(s.clone());
    const next = STOPS[i + 1];
    if (next) ctrl.push(new THREE.Vector3((s.x + next.x) / 2 + (i % 2 ? -1.6 : 1.6), 0, (s.z + next.z) / 2 + 0.6));
  });
  ctrl.push(new THREE.Vector3(1.5, 0, -31), new THREE.Vector3(5, 0, -36));
  const curve = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal', 0.6);
  const altitude = (u) => 1.15 + 0.35 * Math.sin(u * 19.0) * Math.sin(u * 7.3 + 1) + 0.25 * Math.sin(u * 3.1) + 9 * Math.pow(smooth(0.86, 1, u), 1.6);   /* dopo l'ultima tappa prende quota ed esce di scena */

  /* parametri (arc-length) delle tappe */
  const SAMPLES = 900;
  const samplePts = curve.getSpacedPoints(SAMPLES);
  const stopU = STOPS.map((s) => { let best = 0, bd = 1e9; samplePts.forEach((p, i) => { const d = p.distanceToSquared(s); if (d < bd) { bd = d; best = i; } }); return best / SAMPLES; });
  /* tabella p → u: l'aereo rallenta vicino alle tappe */
  const LUT = new Float32Array(SAMPLES + 1);
  { const w = (u) => 1 + 6.5 * stopU.reduce((acc, su) => acc + Math.exp(-Math.pow((u - su) / 0.028, 2)), 0);
    let acc = 0; const cum = new Float32Array(SAMPLES + 1);
    for (let i = 0; i <= SAMPLES; i++) { acc += w(i / SAMPLES); cum[i] = acc; }
    for (let i = 0; i <= SAMPLES; i++) cum[i] /= acc;
    let j = 0; for (let i = 0; i <= SAMPLES; i++) { const p = i / SAMPLES; while (j < SAMPLES && cum[j + 1] < p) j++; const a = cum[j], b = cum[Math.min(SAMPLES, j + 1)]; const f = b > a ? (p - a) / (b - a) : 0; LUT[i] = (j + Math.min(1, Math.max(0, f))) / SAMPLES; } }
  const uOf = (p) => { const x = Math.min(1, Math.max(0, p)) * SAMPLES, i = Math.floor(x), f = x - i; return i >= SAMPLES ? 1 : LUT[i] * (1 - f) + LUT[i + 1] * f; };
  const posAt = (u, out) => { curve.getPointAt(Math.min(1, Math.max(0, u)), out); out.y += altitude(u); return out; };

  /* --- rotta disegnata: tratteggio spento + tratto pieno percorso --- */
  const routePts = []; for (let i = 0; i <= SAMPLES; i += 3) routePts.push(posAt(i / SAMPLES, new THREE.Vector3()).sub(new THREE.Vector3(0, 0.02, 0)));
  const routeGeo = new THREE.BufferGeometry().setFromPoints(routePts);
  const routeDim = new THREE.Line(routeGeo, new THREE.LineDashedMaterial({ color: MUTED, dashSize: 0.28, gapSize: 0.22, transparent: true, opacity: 0.55 }));
  routeDim.computeLineDistances(); scene.add(routeDim);
  const routeLit = new THREE.Line(routeGeo.clone(), new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.9 }));
  routeLit.geometry.setDrawRange(0, 0); scene.add(routeLit);
  /* ombra della rotta a terra */
  const groundPts = routePts.map((p) => new THREE.Vector3(p.x, 0.005, p.z));
  const ground = new THREE.Line(new THREE.BufferGeometry().setFromPoints(groundPts), new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.08 }));
  scene.add(ground);

  /* --- segnaposti: asta, bandierina, anello a terra --- */
  const markers = STOPS.map((s, i) => {
    const m = new THREE.Group(); m.position.copy(s); scene.add(m);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.0, 6), std(INK, { transparent: true })); pole.position.y = 0.5; m.add(pole);
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute([0, 1.0, 0, 0.5, 0.86, 0, 0, 0.72, 0, 0, 1.0, 0.02, 0.5, 0.86, 0.02, 0, 0.72, 0.02], 3));
    fg.setIndex([0, 2, 1, 3, 4, 5, 0, 1, 4, 0, 4, 3, 1, 2, 5, 1, 5, 4, 2, 0, 3, 2, 3, 5]); fg.computeVertexNormals();
    const flag = new THREE.Mesh(fg, std(MUTED, { side: THREE.DoubleSide, transparent: true })); m.add(flag);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.014, 6, 40), std(MUTED, { transparent: true })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.01; m.add(ring);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.4, 32), new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0 })); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.006; m.add(disc);
    const num = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), std(ACCENT)); num.position.y = 1.06; num.visible = false; m.add(num);
    return { group: m, pole, flag, ring, disc, u: stopU[i], lit: 0, reveal: i === 0 ? 1 : 0 };
  });

  /* --- aereo, ombra, scia di particelle leggere --- */
  const plane = buildPlane(); scene.add(plane);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; scene.add(shadow);
  const TRAIL = 26, trailPos = new Float32Array(TRAIL * 3);
  const trail = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(trailPos, 3)), new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.5 }));
  scene.add(trail);
  const trailHistory = [];

  const st = { p: 0, u: 0, w: 0, h: 0, narrow: false, cam: new THREE.Vector3(), look: new THREE.Vector3(), init: false, roll: 0 };
  const tmp = { pos: new THREE.Vector3(), ahead: new THREE.Vector3(), prev: new THREE.Vector3(), dir: new THREE.Vector3(), camT: new THREE.Vector3(), lookT: new THREE.Vector3(), proj: new THREE.Vector3() };

  function resize() {
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
    if (w === st.w && h === st.h) return;
    st.w = w; st.h = h; st.narrow = w < 860 || h < 560;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  function frame(now, dt) {
    resize();
    /* l'aereo insegue il progresso dello scroll con un filo di inerzia */
    const targetU = uOf(st.p);
    st.u += (targetU - st.u) * (1 - Math.exp(-dt * 6));
    const u = st.u;
    posAt(u, tmp.pos); posAt(Math.min(1, u + 0.004), tmp.ahead); posAt(Math.max(0, u - 0.004), tmp.prev);
    tmp.dir.subVectors(tmp.ahead, tmp.prev).normalize();
    /* orientamento: guarda avanti; rollio proporzionale alla curvatura (virata inclinata) */
    const yaw = Math.atan2(tmp.dir.x, tmp.dir.z);
    const pitch = -Math.asin(Math.max(-1, Math.min(1, tmp.dir.y)));
    const a2 = posAt(Math.min(1, u + 0.012), new THREE.Vector3()).sub(tmp.pos).normalize();
    const turn = tmp.dir.x * a2.z - tmp.dir.z * a2.x;              /* segno della curva */
    const targetRoll = -turn * 26 + Math.sin(now * 0.004) * 0.06;
    st.roll += (targetRoll - st.roll) * (1 - Math.exp(-dt * 4));
    plane.position.copy(tmp.pos).add(new THREE.Vector3(0, Math.sin(now * 0.0025) * 0.05, 0));
    plane.rotation.set(pitch, yaw, Math.max(-0.9, Math.min(0.9, st.roll)));
    shadow.position.set(tmp.pos.x, 0.01, tmp.pos.z);
    const sh = 1 - Math.min(0.6, (tmp.pos.y - 0.5) * 0.25); shadow.scale.setScalar(sh); shadow.material.opacity = 0.5 + 0.5 * sh;

    /* camera: dietro e sopra, l'aereo leggermente a sinistra sul desktop; dopo l'ultima tappa si ferma e lo lascia andare */
    const holdU = stopU[stopU.length - 1] + 0.04;
    const cu = Math.min(u, holdU);
    const camPos = cu === u ? tmp.pos : posAt(cu, new THREE.Vector3());
    const camDir = cu === u ? tmp.dir : posAt(Math.min(1, cu + 0.004), new THREE.Vector3()).sub(posAt(Math.max(0, cu - 0.004), new THREE.Vector3())).normalize();
    const back = camDir.clone().multiplyScalar(-1);
    const side = new THREE.Vector3(-camDir.z, 0, camDir.x).normalize();
    const lateral = st.narrow ? 0 : 1.15;
    const backD = st.narrow ? 5.0 : 4.2, upD = st.narrow ? 3.0 : 2.5, lookDown = st.narrow ? -1.6 : -0.2;
    tmp.camT.copy(camPos).addScaledVector(back, backD).addScaledVector(side, lateral).add(new THREE.Vector3(0, upD, 0));
    tmp.lookT.copy(camPos).addScaledVector(camDir, 2.2).addScaledVector(side, lateral * 0.55).add(new THREE.Vector3(0, lookDown, 0));
    if (!st.init) { st.cam.copy(tmp.camT); st.look.copy(tmp.lookT); st.init = true; }
    const kc = 1 - Math.exp(-dt * 3.2);
    st.cam.lerp(tmp.camT, kc); st.look.lerp(tmp.lookT, kc);
    camera.position.copy(st.cam); camera.lookAt(st.look);

    /* scia: storia delle ultime posizioni */
    trailHistory.unshift(tmp.pos.clone()); if (trailHistory.length > TRAIL) trailHistory.pop();
    for (let i = 0; i < TRAIL; i++) { const p = trailHistory[Math.min(i, trailHistory.length - 1)]; trailPos[i * 3] = p.x; trailPos[i * 3 + 1] = p.y - 0.02; trailPos[i * 3 + 2] = p.z; }
    trail.geometry.attributes.position.needsUpdate = true;
    routeLit.geometry.setDrawRange(0, Math.floor(u * routePts.length));

    /* segnaposti e schede (una scheda alla volta: quella della tappa più vicina) */
    let nearest = 0; markers.forEach((m, i) => { if (Math.abs(u - m.u) < Math.abs(u - markers[nearest].u)) nearest = i; });
    for (let i = 0; i < markers.length; i++) {
      const m = markers[i];
      const near = 1 - smooth(0.02, 0.075, Math.abs(u - m.u));       /* 1 quando l'aereo è sulla tappa */
      const visited = u > m.u - 0.01 ? 1 : 0;
      m.lit += ((visited ? 0.55 : 0) + near * 0.45 - m.lit) * (1 - Math.exp(-dt * 6));
      /* la bandierina è un fantasma finché l'aereo non ha raggiunto la tappa precedente */
      const shouldReveal = i === 0 || u > markers[i - 1].u - 0.005 ? 1 : 0;
      m.reveal += (shouldReveal - m.reveal) * (1 - Math.exp(-dt * 3));
      const op = 0.16 + 0.84 * m.reveal;
      m.pole.material.opacity = op; m.flag.material.opacity = op; m.ring.material.opacity = op;
      m.flag.material.color.lerpColors(new THREE.Color(MUTED), new THREE.Color(ACCENT), m.lit);
      m.ring.material.color.copy(m.flag.material.color);
      m.disc.material.opacity = near * (0.18 + 0.1 * Math.sin(now * 0.004));
      m.ring.scale.setScalar(1 + near * 0.25 * (0.5 + 0.5 * Math.sin(now * 0.004)));
      m.flag.rotation.y = Math.sin(now * 0.003 + i) * 0.25 * (0.4 + near);
      /* scheda: slot fisso a destra (in basso su mobile); una linea guida la collega al segnaposto */
      const card = cards[i]; if (!card) continue;
      const vis = i === nearest ? 1 - smooth(0.045, 0.1, Math.abs(u - m.u)) : 0;
      tmp.proj.copy(m.group.position).add(new THREE.Vector3(0, 1.0, 0)).project(camera);
      const mx = (tmp.proj.x * 0.5 + 0.5) * st.w, my = (-tmp.proj.y * 0.5 + 0.5) * st.h;
      const onScreen = tmp.proj.z < 1 && mx > -50 && mx < st.w + 50 && my > -50 && my < st.h + 50;
      let ax, ay;
      if (st.narrow) {
        card.style.transform = `translate(-50%, ${(1 - vis) * 30}px) scale(${0.96 + 0.04 * vis})`;
        ax = st.w / 2; ay = st.h - st.h * 0.12 - card.offsetHeight;
      } else {
        const cx = st.w - card.offsetWidth - Math.max(24, st.w * 0.045), cy = Math.max(st.h * 0.42, st.h * 0.5 - card.offsetHeight * 0.3);
        card.style.transform = `translate(${cx}px, ${cy + (1 - vis) * 28}px) scale(${0.94 + 0.06 * vis})`;
        ax = cx; ay = cy + card.offsetHeight * 0.5;
      }
      card.style.opacity = String(vis);
      card.style.pointerEvents = vis > 0.5 ? 'auto' : 'none';
      const lp = leaderPaths[i], ld = leaderDots[i];
      if (vis > 0.01 && onScreen) {
        const midx = (mx + ax) / 2;
        lp.setAttribute('d', `M${mx.toFixed(1)} ${my.toFixed(1)} C${midx.toFixed(1)} ${my.toFixed(1)} ${midx.toFixed(1)} ${ay.toFixed(1)} ${ax.toFixed(1)} ${ay.toFixed(1)}`);
        lp.style.opacity = String(vis * 0.9); ld.style.opacity = String(vis);
        ld.setAttribute('cx', mx.toFixed(1)); ld.setAttribute('cy', my.toFixed(1));
      } else { lp.style.opacity = '0'; ld.style.opacity = '0'; }
      card.classList.toggle('is-current', near > 0.5);
    }
    if (progressBar) progressBar.style.transform = `scaleX(${st.p})`;
    renderer.render(scene, camera);
  }

  return {
    frame,
    setProgress(p) { st.p = p; },
    get progress() { return st.p; },
    resize
  };
}
