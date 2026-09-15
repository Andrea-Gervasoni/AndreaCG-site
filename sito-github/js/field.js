/* ------------------------------------------------------------------
   Sfondo continuo: una mappa di linee di livello, rade e sottili, che
   respira lentamente. Attorno al cursore una regione organica (una
   scia elastica di "metaball") tinge le fasce tra le linee: è la
   sfumatura che segue il mouse. Durante la hero un rettangolo
   arrotondato resta chiaro mentre fuori diventa scuro, e le linee
   continuano attraverso il bordo.
   ------------------------------------------------------------------ */

const TRAIL = 9;
const VERT = `attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform vec2  u_res;
uniform float u_time;
uniform vec2  u_trail[${TRAIL}];   /* scia del cursore, px, origine in basso a sinistra */
uniform float u_trailR[${TRAIL}];  /* raggio di ogni goccia della scia, px */
uniform float u_cursorOn;
uniform vec4  u_rect;              /* x, y, w, h del quadro chiaro (px) */
uniform float u_radius;
uniform float u_rectOn;
uniform float u_theme;             /* 0 chiaro, 1 scuro */
uniform vec3  u_paper, u_paperLine, u_ink, u_inkLine;
uniform vec3  u_lightA, u_lightB, u_lightLine;   /* fasce e linee dentro la regione del cursore, tema chiaro */
uniform vec3  u_darkA, u_darkB, u_darkLine;      /* idem, tema scuro */

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 4; i++){ v += a * noise(p); p = r * p * 2.02 + 11.7; a *= 0.5; }
  return v;
}
float sdRoundRect(vec2 p, vec2 b, float r){
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
void main(){
  float s = min(u_res.x, u_res.y);
  vec2 uv = gl_FragCoord.xy / s;
  float t = u_time * 0.018;

  /* rilievo: poche ottave, deformazione leggera e lentissima */
  vec2 q = vec2(fbm(uv * 0.9 + t), fbm(uv * 0.9 - t * 0.7 + 5.2));
  float n = fbm(uv * 0.8 + q * 0.4 + vec2(0.0, t * 0.5));

  /* linee di livello: rade, sottili, antialias */
  float levels = 10.0;
  float v = n * levels;
  float f = abs(fract(v) - 0.5);
  float w = fwidth(v);
  float line = 1.0 - smoothstep(0.0, w * 1.15 + 0.012, f);
  float band = step(0.5, fract(v));            /* fasce alterne tra le linee */

  /* regione organica attorno al cursore: somma di gocce, bordo netto */
  float field = 0.0;
  for (int i = 0; i < ${TRAIL}; i++){
    vec2 d = gl_FragCoord.xy - u_trail[i];
    float r = max(u_trailR[i], 1.0);
    field += exp(-dot(d, d) / (r * r));
  }
  float region = smoothstep(0.30, 0.36, field) * u_cursorOn;

  /* dentro/fuori dal quadro chiaro */
  vec2 c = u_rect.xy + u_rect.zw * 0.5;
  float sd = sdRoundRect(gl_FragCoord.xy - c, u_rect.zw * 0.5, u_radius);
  float inside = 1.0 - smoothstep(-1.0, 1.0, sd);
  float dark = mix(u_theme, 1.0 - inside, u_rectOn);

  /* tema chiaro */
  vec3 baseL = mix(u_paper, u_paperLine, line * 0.85);
  vec3 curL  = mix(mix(u_lightA, u_lightB, band), u_lightLine, line);
  vec3 colL  = mix(baseL, curL, region);
  /* tema scuro */
  vec3 baseD = mix(u_ink, u_inkLine, line * 0.9);
  vec3 curD  = mix(mix(u_darkA, u_darkB, band), u_darkLine, line);
  vec3 colD  = mix(baseD, curD, region);

  vec3 col = mix(colL, colD, dark);
  /* ombra morbida subito fuori dal quadro */
  float edge = smoothstep(0.0, 30.0, sd);
  col = mix(col * 0.84, col, mix(1.0, edge, u_rectOn * (1.0 - inside)));
  gl_FragColor = vec4(col, 1.0);
}`;

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

export function createField(canvas) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!gl) return null;
  gl.getExtension('OES_standard_derivatives');
  const compile = (type, src) => { const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(sh)); return null; } return sh; };
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, '#extension GL_OES_standard_derivatives : enable\n' + FRAG);
  if (!vs || !fs) return null;
  const prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn(gl.getProgramInfoLog(prog)); return null; }
  gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = {};
  for (const n of ['u_res', 'u_time', 'u_trail', 'u_trailR', 'u_cursorOn', 'u_rect', 'u_radius', 'u_rectOn', 'u_theme', 'u_paper', 'u_paperLine', 'u_ink', 'u_inkLine', 'u_lightA', 'u_lightB', 'u_lightLine', 'u_darkA', 'u_darkB', 'u_darkLine']) U[n] = gl.getUniformLocation(prog, n);

  /* palette: carta e inchiostro; dentro la regione del cursore le fasce prendono una tinta calda */
  gl.uniform3fv(U.u_paper, hex('#f3f1ea'));
  gl.uniform3fv(U.u_paperLine, hex('#d6d3c4'));
  gl.uniform3fv(U.u_ink, hex('#161923'));
  gl.uniform3fv(U.u_inkLine, hex('#2a2f3d'));
  gl.uniform3fv(U.u_lightA, hex('#f0dfd3'));
  gl.uniform3fv(U.u_lightB, hex('#e6c9b6'));
  gl.uniform3fv(U.u_lightLine, hex('#d8ab92'));
  gl.uniform3fv(U.u_darkA, hex('#25202a'));
  gl.uniform3fv(U.u_darkB, hex('#3d2a25'));
  gl.uniform3fv(U.u_darkLine, hex('#a35a3a'));

  const state = {
    dpr: 1, w: 0, h: 0, cw: 1, ch: 1,
    mouse: { tx: 0, ty: 0, on: 0, ton: 0 },
    head: { x: 0, y: 0, vx: 0, vy: 0 },
    trail: Array.from({ length: TRAIL }, () => ({ x: 0, y: 0 })),
    rect: { x: 0, y: 0, w: 0, h: 0, r: 0, on: 0 },
    theme: 0, themeTarget: 0, time: 0
  };
  const trailBuf = new Float32Array(TRAIL * 2), radiusBuf = new Float32Array(TRAIL);

  const vw = () => document.documentElement.clientWidth || innerWidth;
  const vh = () => document.documentElement.clientHeight || innerHeight;
  function resize() {
    state.dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    state.cw = vw(); state.ch = vh();
    state.w = Math.round(state.cw * state.dpr); state.h = Math.round(state.ch * state.dpr);
    canvas.width = state.w; canvas.height = state.h;
    canvas.style.width = state.cw + 'px'; canvas.style.height = state.ch + 'px';
    gl.viewport(0, 0, state.w, state.h);
    gl.uniform2f(U.u_res, state.w, state.h);
  }
  resize();
  addEventListener('resize', resize, { passive: true });

  const onMove = (e) => {
    const p = e.touches ? e.touches[0] : e;
    state.mouse.tx = p.clientX; state.mouse.ty = state.ch - p.clientY; state.mouse.ton = 1;
  };
  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('touchmove', onMove, { passive: true });
  document.addEventListener('mouseleave', () => { state.mouse.ton = 0; });
  state.mouse.tx = state.cw * 0.5; state.mouse.ty = state.ch * 0.5;
  state.head.x = state.mouse.tx; state.head.y = state.mouse.ty;
  state.trail.forEach((p) => { p.x = state.head.x; p.y = state.head.y; });

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    state.time += dt;
    /* la testa della scia è una molla: arriva con un piccolo rimbalzo */
    const h = state.head, m = state.mouse;
    h.vx += (m.tx - h.x) * 38 * dt; h.vy += (m.ty - h.y) * 38 * dt;
    const damp = Math.exp(-dt * 7.5); h.vx *= damp; h.vy *= damp;
    h.x += h.vx * dt; h.y += h.vy * dt;
    /* le gocce successive inseguono la precedente con ritardo crescente */
    let px = h.x, py = h.y;
    for (let i = 0; i < TRAIL; i++) {
      const p = state.trail[i], k = 1 - Math.exp(-dt * (14 - i * 1.1));
      p.x += (px - p.x) * k; p.y += (py - p.y) * k; px = p.x; py = p.y;
      trailBuf[i * 2] = p.x * state.dpr; trailBuf[i * 2 + 1] = p.y * state.dpr;
      const base = Math.min(state.cw, state.ch) * 0.13;
      radiusBuf[i] = base * (1 - i / TRAIL * 0.72) * state.dpr;
    }
    m.on += (m.ton - m.on) * (1 - Math.exp(-dt * 3));
    state.theme += (state.themeTarget - state.theme) * (1 - Math.exp(-dt * 4));

    gl.uniform1f(U.u_time, state.time);
    gl.uniform2fv(U.u_trail, trailBuf);
    gl.uniform1fv(U.u_trailR, radiusBuf);
    gl.uniform1f(U.u_cursorOn, m.on);
    const r = state.rect;
    gl.uniform4f(U.u_rect, r.x * state.dpr, (state.ch - r.y - r.h) * state.dpr, r.w * state.dpr, r.h * state.dpr);
    gl.uniform1f(U.u_radius, r.r * state.dpr);
    gl.uniform1f(U.u_rectOn, r.on);
    gl.uniform1f(U.u_theme, state.theme);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  return {
    frame,
    setRect(x, y, w, h, radius, on = 1) { Object.assign(state.rect, { x, y, w, h, r: radius, on }); },
    setTheme(dark) { state.themeTarget = dark ? 1 : 0; },
    get theme() { return state.themeTarget; },
    _debug: { gl, prog, U, state }
  };
}
