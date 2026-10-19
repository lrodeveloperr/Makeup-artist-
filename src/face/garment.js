// The customer's blouse or dress (record: face.outfit, from outfit.js), seen at the bottom of the frame. It leaves
// the neck bare and hides where the body mesh ends, which moves with each face's neck shape; below the mesh the
// shoulders are continued outwards so the garment fills the bottom of the frame. Patterns are procedural.
import * as GL from '../gl/mini.js';
import { hexToLinear } from './colors.js';
import { LIGHT_GLSL, lightUniforms } from './lighting.js';

const mix = (a, b, t) => a + (b - a) * t;
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// neckline height around the body (c = cos, s2 = sin² of the angle; 0 = front), before the mesh-end limit
const NECKLINE = {
  'off-shoulder': (c, s2) => (c > 0 ? mix(-1.66, -1.63, s2) : -1.63), // straight across the chest
  boat: (c, s2) => mix(-1.6, -1.5, s2),                               // wide and high, along the collarbones
  scoop: (c) => (c > 0 ? mix(-1.55, -1.8, c ** 3) : -1.55),          // rounded dip at the front
  straps: () => -1.74,                                                // straight top held by two straps
  ruffle: (c, s2) => mix(-1.62, -1.54, s2),                           // boat line with a frill
};
const PATTERN_ID = { solid: 0, 'two-tone': 1, stripes: 2, dots: 3, floral: 4, gingham: 5, geometric: 6 };

class Mesher {
  constructor() { this.pos = []; this.nrm = []; this.cloth = []; this.idx = []; }
  vert(p, n, cloth) { this.pos.push(...p); this.nrm.push(...n); this.cloth.push(...cloth); return this.pos.length / 3 - 1; }
  quad(a, b, c, d) { this.idx.push(a, b, c, a, c, d); }
  geometry(g) {
    g.setAttribute('position', new GL.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new GL.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('cloth', new GL.Float32BufferAttribute(this.cloth, 3));
    g.setIndex(this.idx);
    return g;
  }
}

// Grid of rows (around the body) x columns (down from the neckline), wound so the outside is the front face, with
// normals from the grid itself. cloth: [depth below the neckline, fold shade, strap flag].
function grid(m, P, C) {
  const NI = P.length, NJ = P[0].length, ids = [];
  for (let i = 0; i < NI; i++) {
    const row = [];
    for (let j = 0; j < NJ; j++) {
      const du = sub(P[Math.min(i + 1, NI - 1)][j], P[Math.max(i - 1, 0)][j]);
      const dv = sub(P[i][Math.min(j + 1, NJ - 1)], P[i][Math.max(j - 1, 0)]);
      row.push(m.vert(P[i][j], norm(cross(dv, du)), C[i][j]));
    }
    ids.push(row);
  }
  for (let i = 0; i < NI - 1; i++) for (let j = 0; j < NJ - 1; j++) m.quad(ids[i][j], ids[i][j + 1], ids[i + 1][j + 1], ids[i + 1][j]);
}

function body(m, frame, neckline) {
  const NT = 120, NY = 24, P = [], C = [];
  const ruffle = neckline === 'ruffle';
  for (let i = 0; i <= NT; i++) {
    const theta = (i / NT) * 2 * Math.PI;
    const c = Math.cos(theta), s2 = Math.sin(theta) ** 2;
    const end = frame.lowest(theta);
    const yTop = Math.max(NECKLINE[neckline](c, s2), end + 0.06); // always above the mesh end
    const pr = [], cr = [];
    for (let j = 0; j <= NY; j++) {
      const t = j / NY;
      let y = yTop - t * t * 0.9 - t * 0.1;
      // a frill: the top rows fan out in soft waves
      const frill = ruffle && j < 5 ? (1 - j / 5) : 0;
      const wave = Math.sin(theta * 34);
      if (frill) y += 0.012 * wave * frill;
      const yb = Math.max(y, end);
      const roll = j === 0 ? 0.02 : j === 1 ? 0.04 : 0.03; // a rolled top edge
      // enclose the body a little below this height too, so the top edge sits in front of the chest's curve
      const r = Math.max(frame.radius(theta, yb), frame.radius(theta, Math.max(yb - 0.06, end)), frame.radius(theta, end));
      let p = frame.point(theta, yb, r + roll + frill * 0.028 * (0.6 + 0.4 * wave));
      const below = Math.max(end - y, 0);
      if (below > 0) p = [p[0] * Math.min(1 + 1.6 * below, 1.5), y, p[2] + Math.max(c, 0) * 0.35 * below];
      pr.push(p);
      cr.push([yTop - y, frill ? 0.75 + 0.25 * wave : 1, 0]);
    }
    P.push(pr); C.push(cr);
  }
  grid(m, P, C);
}

// highest body point at (x, z), scanning down from the neck (null if the body does not reach there)
function topAt(frame, x, z) {
  const th = Math.atan2(x, z - frame.cz), r = Math.hypot(x, z - frame.cz);
  for (let y = -1.25; y > -1.95; y -= 0.008) if (frame.radius(th, y) >= r) return y;
  return null;
}
// two straps from the neckline over the shoulders, lying on the body in the plane x = ±0.58
function straps(m, frame, neckline) {
  for (const side of [1, -1]) {
    const x = side * 0.58, pts = [];
    for (let z = frame.cz + 1.1; z > frame.cz - 0.4; z -= 0.01) {
      const y = topAt(frame, x, z);
      if (y === null) continue;
      const th = Math.atan2(x, z - frame.cz), c = Math.cos(th), s2 = Math.sin(th) ** 2;
      const yTop = Math.max(NECKLINE[neckline](c, s2), frame.lowest(th) + 0.06);
      if (y < yTop - 0.02) continue; // still below the neckline: the garment covers it
      pts.push([x, y, z]);
    }
    if (pts.length < 2) continue;
    // lift off the skin along the local normal of the strap's path
    const P = [[], []], C = [[], []];
    pts.forEach((p, k) => {
      const t = sub(pts[Math.min(k + 1, pts.length - 1)], pts[Math.max(k - 1, 0)]);
      let n = norm(cross([1, 0, 0], t));
      if (n[1] + n[2] < 0) n = n.map((v) => -v);
      const q = [p[0] + n[0] * 0.014, p[1] + n[1] * 0.014, p[2] + n[2] * 0.014];
      // columns ordered so that the strap's outside is its front face
      P[0].push([q[0] + 0.022, q[1], q[2]]); P[1].push([q[0] - 0.022, q[1], q[2]]);
      C[0].push([0, 1, 1]); C[1].push([0, 1, 1]);
    });
    grid(m, P, C);
  }
}

const vertexShader = /* glsl */ `
attribute vec3 cloth;
varying vec3 vPos, vNormal, vObj, vCloth;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vPos = mv.xyz; vObj = position; vCloth = cloth;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
}`;

const fragmentShader = /* glsl */ `
${LIGHT_GLSL}
uniform vec3 uColA, uColB, uColC;
uniform int uPattern;   // 0 solid, 1 two-tone, 2 stripes, 3 dots, 4 floral, 5 gingham, 6 geometric
uniform float uSeed;
varying vec3 vPos, vNormal, vObj, vCloth;

// 1 inside a band of half-width h around 0 (periodic coordinate f in [-0.5, 0.5]), anti-aliased
float band(float f, float h, float aa) { return 1.0 - smoothstep(h - aa, h + aa, abs(f)); }
float hash12(vec2 p) { return hash13(vec3(p, uSeed)); }

void main() {
  vec3 v = normalize(-vPos);
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  // the pattern is laid out as seen from the front, so it is undistorted where the player looks
  vec2 q = vObj.xy + vec2(uSeed * 0.013, 0.0);
  vec3 col = uColA;
  float strap = vCloth.z;
  if (uPattern == 1) {
    // two-tone: a contrasting band along the neckline, and straps in the same colour
    float aa = fwidth(vCloth.x) * 1.5;
    col = mix(uColA, uColB, max(1.0 - smoothstep(0.045 - aa, 0.045 + aa, vCloth.x), strap));
  } else if (uPattern == 2) {
    // stripes across the body
    float f = fract(q.y / 0.07) - 0.5;
    col = mix(uColA, uColB, band(f, 0.22, fwidth(q.y / 0.07) * 1.2));
  } else if (uPattern == 3) {
    // dots on a staggered grid
    vec2 g = q / 0.075;
    g.x += 0.5 * mod(floor(g.y), 2.0);
    float d = length(fract(g) - 0.5) * 0.075;
    float aa = fwidth(d) * 1.2;
    col = mix(uColA, uColB, 1.0 - smoothstep(0.016 - aa, 0.016 + aa, d));
  } else if (uPattern == 4) {
    // florals: five-petal flowers with a centre, scattered one per cell, and small leaves between them
    vec2 g = q / 0.12, id = floor(g);
    vec2 o = vec2(hash12(id), hash12(id + 17.0)) * 0.4 + 0.3;
    vec2 p = (fract(g) - o) * 0.12;
    float a = atan(p.y, p.x) + hash12(id + 5.0) * 6.2832, r = length(p);
    float petal = 0.034 * (0.55 + 0.45 * abs(cos(2.5 * a)));
    float aa = fwidth(r) * 1.2;
    float flower = 1.0 - smoothstep(petal - aa, petal + aa, r);
    float centre = 1.0 - smoothstep(0.009 - aa, 0.009 + aa, r);
    vec2 lp = (fract(g + 0.5) - 0.5) * 0.12;
    float la = hash12(id + 31.0) * 3.1416;
    vec2 lr = mat2(cos(la), -sin(la), sin(la), cos(la)) * lp;
    float leaf = 1.0 - smoothstep(1.0 - 0.15, 1.0 + 0.15, length(lr / vec2(0.022, 0.009)));
    col = mix(uColA, uColC, leaf * 0.85);
    col = mix(col, uColB, flower);
    col = mix(col, uColC, centre);
  } else if (uPattern == 5) {
    // gingham: two crossing stripe sets; where they cross the colour is full strength
    float fx = fract(q.x / 0.05) - 0.5, fy = fract(q.y / 0.05) - 0.5;
    float sx = band(fx, 0.25, fwidth(q.x / 0.05)), sy = band(fy, 0.25, fwidth(q.y / 0.05));
    col = mix(uColA, uColB, 0.5 * (sx + sy));
  } else if (uPattern == 6) {
    // bold geometric print: ringed medallions on a staggered grid, with diamonds between them
    vec2 g = q / 0.14;
    g.x += 0.5 * mod(floor(g.y), 2.0);
    vec2 p = (fract(g) - 0.5) * 0.14;
    float r = length(p), aa = fwidth(r) * 1.2;
    float ring = floor(r / 0.016);
    float inside = 1.0 - smoothstep(0.056 - aa, 0.056 + aa, r);
    col = mix(uColA, mod(ring, 2.0) < 0.5 ? uColB : uColC, inside);
    vec2 dp = (fract(g + 0.5) - 0.5) * 0.14;
    float dd = abs(dp.x) + abs(dp.y), aa2 = fwidth(dd) * 1.2;
    col = mix(col, uColC, (1.0 - smoothstep(0.018 - aa2, 0.018 + aa2, dd)) * (1.0 - inside));
  }
  if (strap > 0.5 && uPattern != 1) col = uColA;

  // soft fabric: gentle folds, wrapped diffuse and a faint sheen at grazing angles
  float fold = fbm(vec3(vObj.x * 9.0, vObj.y * 3.0, uSeed)) - 0.5;
  vec3 nb = normalize(n + vec3(fold * 0.25, 0.0, 0.0));
  float shade = vCloth.y * (1.0 - 0.25 * smoothstep(0.0, 0.035, vCloth.x) * (1.0 - smoothstep(0.035, 0.08, vCloth.x)));
  vec3 c = col * ambient(nb);
  for (int i = 0; i < 3; i++) {
    vec3 l = uLightDir[i];
    float d = clamp((dot(nb, l) + 0.3) / 1.3, 0.0, 1.0);
    float sheen = pow(1.0 - max(dot(nb, v), 0.0), 3.0) * 0.12 * max(dot(nb, l) + 0.3, 0.0);
    c += uLightCol[i] * (col * d * 0.85 + sheen);
  }
  gl_FragColor = vec4(c * shade, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Garment {
  constructor() {
    this.material = new GL.ShaderMaterial({
      vertexShader, fragmentShader,
      uniforms: {
        ...lightUniforms(),
        uColA: { value: new GL.Vector3() }, uColB: { value: new GL.Vector3() }, uColC: { value: new GL.Vector3() },
        uPattern: { value: 0 }, uSeed: { value: 0 },
      },
    });
    this.mesh = new GL.Mesh(new GL.BufferGeometry(), this.material);
  }

  // outfit: face.outfit; frame: the HeadFrame of the current face (shared with the hair)
  build(outfit, frame) {
    const m = new Mesher();
    body(m, frame, outfit.neckline);
    if (outfit.neckline === 'straps') straps(m, frame, outfit.neckline);
    this.mesh.geometry.dispose();
    this.mesh.geometry = m.geometry(new GL.BufferGeometry());
    const cols = outfit.colours.map(hexToLinear);
    const u = this.material.uniforms;
    u.uColA.value.set(...cols[0]);
    u.uColB.value.set(...(cols[1] || cols[0]));
    u.uColC.value.set(...(cols[2] || cols[1] || cols[0]));
    u.uPattern.value = PATTERN_ID[outfit.pattern] ?? 0;
    u.uSeed.value = (outfit.seed % 997) * 0.37;
  }
}
