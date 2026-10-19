// The customer's blouse or dress (record: face.outfit, from outfit.js), worn on the body: the fabric is the
// body surface lifted off the skin and smoothed so it bridges hollows (collarbones, cleavage) instead of shrink-
// wrapping them, cut by a neckline defined on the reference body, with a rolled hem, folds, and patterns that
// wrap around the body. The skin shader uses the same neckline for the soft shadow along the fabric's edge.
import * as GL from '../gl/mini.js';
import { hexToLinear } from './colors.js';
import { LIGHT_GLSL, lightUniforms } from './lighting.js';

const smooth = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

// Necklines on the reference body (decimetres; eyes at y = 0, sternal notch about -1.6, shoulder tops -1.3 near
// the neck to -1.7 at the shoulder point). Seen from the front, the cut runs at height N(|x|):
//   [0, w]     a dip from yc (centre) to ys, shaped 0 gentle curve, 1 round, 2 V, 3 square, 4 sweetheart
//   [w, x2]    ys (along the shoulders, or wide straps)
//   [x2, xs]   y2 (the bodice's sides)
//   beyond xs  covered (sleeve = 1) or bare above ya (sleeveless)
// The back is cut at yb. Optional narrow straps run over the shoulders at |x| = strap[0]; a frill raises the
// edge in waves; gather adds elastic gathers under the edge.
const NECK = {
  boat: { yc: -1.74, w: 0.9, ys: -1.5, shape: 0, x2: 0.95, y2: -1.5, xs: 0.95, sleeve: 1, ya: 0, yb: -1.55 },
  scoop: { yc: -2.0, w: 0.55, ys: -1.45, shape: 1, x2: 0.95, y2: -1.45, xs: 0.95, sleeve: 1, ya: 0, yb: -1.55 },
  'v-neck': { yc: -2.1, w: 0.5, ys: -1.42, shape: 2, x2: 0.95, y2: -1.42, xs: 0.95, sleeve: 1, ya: 0, yb: -1.55 },
  ruffle: { yc: -1.76, w: 0.9, ys: -1.52, shape: 0, x2: 0.95, y2: -1.52, xs: 0.95, sleeve: 1, ya: 0, yb: -1.55, frill: 0.035 },
  'off-shoulder': { yc: -1.95, w: 2.5, ys: -2.1, shape: 0, x2: 3, y2: -2.1, xs: 3, sleeve: 1, ya: 0, yb: -1.95, gather: 1 },
  square: { yc: -1.95, w: 0.42, ys: -1.25, shape: 3, x2: 0.75, y2: -2.0, xs: 1.25, sleeve: 0, ya: -2.45, yb: -1.85 },
  straps: { yc: -1.96, w: 1.25, ys: -1.99, shape: 0, x2: 1.25, y2: -1.99, xs: 1.25, sleeve: 0, ya: -2.45, yb: -2.0, strap: [0.55, 0.024] },
  sweetheart: { yc: -2.04, w: 0.9, ys: -2.0, shape: 4, x2: 1.25, y2: -2.0, xs: 1.25, sleeve: 0, ya: -2.45, yb: -2.0, strap: [0.55, 0.024] },
};
export const NECKLINE_IDS = Object.keys(NECK);

// around-the-body coordinate (pattern u), so patterns wrap instead of being projected flat
const around = (x, z) => 0.85 * Math.atan2(x, z + 0.75);

function neckHeight(k, x, z) {
  const ax = Math.abs(x), t = Math.min(ax / k.w, 1);
  const dip = k.shape === 0 ? t * t : k.shape === 1 ? 1 - Math.sqrt(Math.max(1 - t * t, 0)) : k.shape === 2 ? t : k.shape === 3 ? smooth(0.85, 1, t) : t;
  let f = mix(k.yc, k.ys, dip);
  if (k.shape === 4) f += 0.11 * Math.sin(Math.PI * t) ** 1.5;
  const front = ax <= k.w ? f : ax <= k.x2 ? k.ys : ax <= k.xs ? k.y2 : k.sleeve ? 9 : k.ya;
  let N = mix(k.yb, front, smooth(-0.95, -0.6, z));
  if (k.frill) N += k.frill * (0.5 + 0.5 * Math.sin(around(x, z) * 34));
  return N;
}
// narrow straps: from the bodice near the chest (|x| = strap[0]) out over the middle of the shoulder
const strapX = (k, y) => k.strap[0] + 0.27 * smooth(-2.0, -1.45, y);
const strapCover = (k, x, y, soft) => (k.strap
  ? (1 - smooth(k.strap[1] - soft, k.strap[1] + soft, Math.abs(Math.abs(x) - strapX(k, y)))) * (1 - smooth(-1.42, -1.3, y)) : 0);
// 1 where the garment covers the reference point (x, y, z), with a soft edge of half-width `soft`
function coverage(k, x, y, z, soft) {
  const body = smooth(-soft, soft, neckHeight(k, x, z) - y);
  if (!k.strap) return body;
  return Math.max(body, strapCover(k, x, y, soft));
}

// The same neckline in GLSL (kept identical to neckHeight / coverage above). Uniforms: A = (yc, w, ys, shape),
// B = (x2, y2, xs, sleeve), C = (ya, yb, frill, gather), D = (strap x, strap half-width, -, -).
export const NECK_GLSL = /* glsl */ `
uniform vec4 uNeckA, uNeckB, uNeckC, uNeckD;
float neckAround(vec3 r) { return 0.85 * atan(r.x, r.z + 0.75); }
float neckHeight(vec3 r) {
  float ax = abs(r.x), t = min(ax / uNeckA.y, 1.0);
  int shape = int(uNeckA.w + 0.5);
  float dip = shape == 0 ? t * t : shape == 1 ? 1.0 - sqrt(max(1.0 - t * t, 0.0)) : shape == 2 ? t : shape == 3 ? smoothstep(0.85, 1.0, t) : t;
  float f = mix(uNeckA.x, uNeckA.z, dip);
  if (shape == 4) f += 0.11 * pow(sin(3.14159265 * t), 1.5);
  float front = ax <= uNeckA.y ? f : ax <= uNeckB.x ? uNeckA.z : ax <= uNeckB.z ? uNeckB.y : (uNeckB.w > 0.5 ? 9.0 : uNeckC.x);
  float N = mix(uNeckC.y, front, smoothstep(-0.95, -0.6, r.z));
  return N + uNeckC.z * (0.5 + 0.5 * sin(neckAround(r) * 34.0));
}
float neckStrap(vec3 r, float soft) {
  if (uNeckD.x <= 0.0) return 0.0;
  float sx = uNeckD.x + 0.27 * smoothstep(-2.0, -1.45, r.y);
  return (1.0 - smoothstep(uNeckD.y - soft, uNeckD.y + soft, abs(abs(r.x) - sx))) * (1.0 - smoothstep(-1.42, -1.3, r.y));
}
float neckCover(vec3 r, float soft) { return max(smoothstep(-soft, soft, neckHeight(r) - r.y), neckStrap(r, soft)); }
`;
export function setNeckUniforms(u, neckline) {
  const k = NECK[neckline] || NECK.boat;
  u.uNeckA.value.set(k.yc, k.w, k.ys, k.shape);
  u.uNeckB.value.set(k.x2, k.y2, k.xs, k.sleeve);
  u.uNeckC.value.set(k.ya, k.yb, k.frill || 0, k.gather || 0);
  u.uNeckD.value.set(k.strap ? k.strap[0] : 0, k.strap ? k.strap[1] : 0, 0, 0);
}
// defaults cover nothing (for materials that read the neckline before a face is set)
export const neckUniforms = () => ({
  uNeckA: { value: new GL.Vector4(-9, 1, -9, 0) }, uNeckB: { value: new GL.Vector4(1, -9, 1, 0) },
  uNeckC: { value: new GL.Vector4(-9, -9, 0, 0) }, uNeckD: { value: new GL.Vector4(0, 0, 0, 0) },
});

const vertexShader = /* glsl */ `
attribute vec3 ref;
varying vec3 vPos, vNormal, vRef;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vPos = mv.xyz; vRef = ref;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
}`;

const fragmentShader = /* glsl */ `
${LIGHT_GLSL}
${NECK_GLSL}
uniform vec3 uColA, uColB, uColC;
uniform int uPattern;   // 0 solid, 1 two-tone, 2 stripes, 3 dots, 4 floral, 5 gingham, 6 geometric
uniform float uSeed, uSatin;
varying vec3 vPos, vNormal, vRef;

float band(float f, float h, float aa) { return 1.0 - smoothstep(h - aa, h + aa, abs(f)); }
float hash12(vec2 p) { return hash13(vec3(p, uSeed)); }

// the print at pattern-space point q (decimetres)
vec3 printAt(vec2 q) {
  vec3 col = uColA;
  if (uPattern == 2) {
    // stripes across the body
    float f = fract(q.y / 0.07) - 0.5;
    col = mix(uColA, uColB, band(f, 0.22, fwidth(q.y / 0.07) * 1.2));
  } else if (uPattern == 3) {
    // dots on a staggered grid
    vec2 g = q / 0.075;
    g.x += 0.5 * mod(floor(g.y), 2.0);
    float d = length(fract(g) - 0.5) * 0.075, aa = fwidth(d) * 1.2;
    col = mix(uColA, uColB, 1.0 - smoothstep(0.016 - aa, 0.016 + aa, d));
  } else if (uPattern == 4) {
    // florals: five-petal flowers with a centre, one per cell, and small leaves between them
    vec2 g = q / 0.12, id = floor(g);
    vec2 o = vec2(hash12(id), hash12(id + 17.0)) * 0.4 + 0.3;
    vec2 p = (fract(g) - o) * 0.12;
    float a = atan(p.y, p.x) + hash12(id + 5.0) * 6.2832, rr = length(p), aa = fwidth(rr) * 1.2;
    float petal = 0.034 * (0.55 + 0.45 * abs(cos(2.5 * a)));
    float flower = 1.0 - smoothstep(petal - aa, petal + aa, rr);
    float centre = 1.0 - smoothstep(0.009 - aa, 0.009 + aa, rr);
    vec2 lp = (fract(g + 0.5) - 0.5) * 0.12;
    float la = hash12(id + 31.0) * 3.1416;
    vec2 lr = mat2(cos(la), -sin(la), sin(la), cos(la)) * lp;
    float leaf = 1.0 - smoothstep(0.85, 1.15, length(lr / vec2(0.022, 0.009)));
    col = mix(uColA, uColC, leaf * 0.85);
    col = mix(col, uColB, flower);
    col = mix(col, uColC, centre);
  } else if (uPattern == 5) {
    // gingham: two crossing stripe sets; where they cross the colour is full strength
    float fx = fract(q.x / 0.05) - 0.5, fy = fract(q.y / 0.05) - 0.5;
    col = mix(uColA, uColB, 0.5 * (band(fx, 0.25, fwidth(q.x / 0.05)) + band(fy, 0.25, fwidth(q.y / 0.05))));
  } else if (uPattern == 6) {
    // bold geometric print: ringed medallions on a staggered grid, with diamonds between them
    vec2 g = q / 0.14;
    g.x += 0.5 * mod(floor(g.y), 2.0);
    vec2 p = (fract(g) - 0.5) * 0.14;
    float rr = length(p), aa = fwidth(rr) * 1.2;
    float inside = 1.0 - smoothstep(0.056 - aa, 0.056 + aa, rr);
    col = mix(uColA, mod(floor(rr / 0.016), 2.0) < 0.5 ? uColB : uColC, inside);
    vec2 dp = (fract(g + 0.5) - 0.5) * 0.14;
    float dd = abs(dp.x) + abs(dp.y), aa2 = fwidth(dd) * 1.2;
    col = mix(col, uColC, (1.0 - smoothstep(0.018 - aa2, 0.018 + aa2, dd)) * (1.0 - inside));
  }
  return col;
}

void main() {
  vec3 r = vRef;
  // the cut edge, anti-aliased per pixel
  float soft = max(fwidth(r.y) * 1.2, 0.0015);
  float cover = neckCover(r, soft);
  if (cover < 0.01) discard;
  float below = neckHeight(r) - r.y;   // distance below the neckline
  float strap = neckStrap(r, soft) * (1.0 - smoothstep(-soft, soft, below));

  vec3 v = normalize(-vPos);
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  // prints are projected from the front, the side and above and blended by the surface's direction, so they
  // stay undistorted where the body turns (shoulders, sides)
  vec3 w = pow(abs(n), vec3(12.0));
  w /= w.x + w.y + w.z;
  vec2 o = vec2(uSeed * 0.013, 0.0);
  vec3 col = w.z * printAt(r.xy + o) + w.x * printAt(r.zy + o) + w.y * printAt(r.xz + o);
  if (uPattern == 1) {
    // two-tone: a contrasting band along the neckline, and straps in the same colour
    float aa = fwidth(below) * 1.5;
    col = mix(uColA, uColB, max(1.0 - smoothstep(0.045 - aa, 0.045 + aa, below), strap));
  }
  if (uPattern != 1) col = mix(col, uColA, strap);

  // folds: a soft drape everywhere, gathers under an elastic edge, tension folds from the chest to the arms
  vec3 T = normalize(cross(vec3(0.0, 1.0, 0.0), n) + vec3(1e-4, 0.0, 0.0));
  vec3 B = cross(n, T);
  vec2 q = vec2(neckAround(r), r.y);
  float drape = fbm(vec3(q * vec2(7.0, 3.5), uSeed)) - 0.5;
  float gather = uNeckC.w * (1.0 - smoothstep(0.0, 0.14, below)) * sin(q.x * 120.0 + drape * 5.0);
  float tension = (1.0 - uNeckC.w) * smoothstep(0.55, 1.05, abs(r.x)) * smoothstep(-1.7, -2.15, r.y)
                * sin((q.x * sign(r.x) * 0.8 + q.y * 0.6) * 60.0 + drape * 4.0);
  vec3 nb = normalize(n + T * (gather * 0.35 + tension * 0.22) + B * drape * 0.35);

  // the rolled hem: a highlight along its crest and a soft shadow line under it
  float hem = 1.0 - strap;
  float shade = 1.0 + hem * (0.08 * (1.0 - smoothstep(0.0, 0.014, below)) - 0.2 * smoothstep(0.016, 0.024, below) * (1.0 - smoothstep(0.024, 0.042, below)));
  // occlusion under the arms
  shade *= 1.0 - 0.35 * smoothstep(1.0, 1.45, abs(r.x)) * smoothstep(-1.85, -2.35, r.y);

  vec3 c = col * ambient(nb);
  for (int i = 0; i < 3; i++) {
    vec3 l = uLightDir[i];
    float d = clamp((dot(nb, l) + 0.35) / 1.35, 0.0, 1.0);
    vec3 h = normalize(l + v);
    // cotton: a soft sheen at grazing angles; satin adds a broad glossy highlight
    float sheen = pow(1.0 - max(dot(nb, v), 0.0), 4.0) * 0.18 * max(dot(nb, l) + 0.3, 0.0);
    float gloss = uSatin * pow(max(dot(nb, h), 0.0), 10.0) * 0.22 * max(dot(nb, l), 0.0);
    c += uLightCol[i] * (col * d * 0.9 + sheen * mix(col, vec3(1.0), 0.5) + gloss);
  }
  // form: fabric turning away from the viewer darkens, so the body under it reads as round
  shade *= mix(0.72, 1.0, smoothstep(0.0, 0.8, dot(nb, v)));
  gl_FragColor = vec4(c * shade, cover);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const PATTERN_ID = { solid: 0, 'two-tone': 1, stripes: 2, dots: 3, floral: 4, gingham: 5, geometric: 6 };
const LIFT = 0.014;   // fabric thickness off the skin (decimetres)
const HEM = 0.007;    // extra thickness of the rolled hem

export class Garment {
  constructor() {
    this.material = new GL.ShaderMaterial({
      vertexShader, fragmentShader, transparent: true, side: GL.DoubleSide,
      uniforms: {
        ...lightUniforms(), ...neckUniforms(),
        uColA: { value: new GL.Vector3() }, uColB: { value: new GL.Vector3() }, uColC: { value: new GL.Vector3() },
        uPattern: { value: 0 }, uSeed: { value: 0 }, uSatin: { value: 0 },
      },
    });
    this.mesh = new GL.Mesh(new GL.BufferGeometry(), this.material);
    this.mesh.renderOrder = 0.5; // after the skin, before the hair that falls over it
  }

  // is the reference-body point [x, y, z] under the outfit? (makeup cannot reach the skin there)
  covers(r) {
    return !!this.neck && this.mesh.visible && r[1] < -1.0 && coverage(this.neck, r[0], r[1], r[2], 1e-4) > 0.5;
  }

  // outfit: face.outfit; hg: HeadGeometry of the current face
  build(outfit, hg) {
    const k = (this.neck = NECK[outfit.neckline] || NECK.boat);
    const P = hg.subPos, Nm = hg.subNrm, R = hg.refSub, q = hg.sub.subQuads, n = hg.sub.subCount;
    const nc = hg.head.regionChannels.length, iIn = hg.regionIndex.interior;
    // covered vertices (a little wider than the cut, which the shader makes exact per pixel)
    const cov = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      if (R[i * 3 + 1] < -1.0 && hg.subRegions[i * nc + iIn] < 0.5) cov[i] = coverage(k, R[i * 3], R[i * 3 + 1], R[i * 3 + 2], 0.05);
    }
    const map = new Int32Array(n).fill(-1), verts = [], quads = [];
    for (let j = 0; j < q.length; j += 4) {
      const ids = [q[j], q[j + 1], q[j + 2], q[j + 3]];
      if (Math.max(cov[ids[0]], cov[ids[1]], cov[ids[2]], cov[ids[3]]) < 0.02) continue;
      for (const i of ids) { if (map[i] < 0) map[i] = verts.push(i) - 1; quads.push(map[i]); }
    }
    const m = verts.length, pos = new Float32Array(m * 3), ref = new Float32Array(m * 3);
    const nbr = Array.from({ length: m }, () => new Set());
    for (let j = 0; j < quads.length; j += 4) {
      for (let c = 0; c < 4; c++) { const a = quads[j + c], b = quads[j + ((c + 1) & 3)]; nbr[a].add(b); nbr[b].add(a); }
    }
    verts.forEach((i, a) => {
      const below = neckHeight(k, R[i * 3], R[i * 3 + 2]) - R[i * 3 + 1];
      const lift = LIFT + HEM * (1 - smooth(0.0, 0.03, below));
      for (let c = 0; c < 3; c++) { pos[a * 3 + c] = P[i * 3 + c] + Nm[i * 3 + c] * lift; ref[a * 3 + c] = R[i * 3 + c]; }
    });
    // drape: smooth the lifted surface so it bridges hollows, but never let it sink back to the skin
    const tmp = new Float32Array(pos.length);
    for (let it = 0; it < 8; it++) {
      for (let a = 0; a < m; a++) {
        let sx = 0, sy = 0, sz = 0;
        for (const b of nbr[a]) { sx += pos[b * 3]; sy += pos[b * 3 + 1]; sz += pos[b * 3 + 2]; }
        const cnt = nbr[a].size || 1;
        tmp[a * 3] = 0.5 * pos[a * 3] + (0.5 * sx) / cnt;
        tmp[a * 3 + 1] = 0.5 * pos[a * 3 + 1] + (0.5 * sy) / cnt;
        tmp[a * 3 + 2] = 0.5 * pos[a * 3 + 2] + (0.5 * sz) / cnt;
      }
      for (let a = 0; a < m; a++) {
        const i = verts[a];
        if (R[i * 3 + 1] < -2.3) { for (let c = 0; c < 3; c++) tmp[a * 3 + c] = pos[a * 3 + c]; continue; } // keep the lowest rows where they are
        const d = (tmp[a * 3] - P[i * 3]) * Nm[i * 3] + (tmp[a * 3 + 1] - P[i * 3 + 1]) * Nm[i * 3 + 1] + (tmp[a * 3 + 2] - P[i * 3 + 2]) * Nm[i * 3 + 2];
        const push = Math.max(LIFT * 0.8 - d, 0);
        for (let c = 0; c < 3; c++) pos[a * 3 + c] = tmp[a * 3 + c] + Nm[i * 3 + c] * push;
      }
    }
    // normals of the draped surface, facing the same way as the skin's
    const nrm = new Float32Array(m * 3);
    for (let j = 0; j < quads.length; j += 4) {
      const [a, b, c, d] = [quads[j], quads[j + 1], quads[j + 2], quads[j + 3]];
      const e1 = [0, 1, 2].map((t) => pos[c * 3 + t] - pos[a * 3 + t]), e2 = [0, 1, 2].map((t) => pos[d * 3 + t] - pos[b * 3 + t]);
      const f = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      for (const v of [a, b, c, d]) for (let t = 0; t < 3; t++) nrm[v * 3 + t] += f[t];
    }
    for (let a = 0; a < m; a++) {
      const i = verts[a];
      const s = nrm[a * 3] * Nm[i * 3] + nrm[a * 3 + 1] * Nm[i * 3 + 1] + nrm[a * 3 + 2] * Nm[i * 3 + 2] < 0 ? -1 : 1;
      const l = Math.hypot(nrm[a * 3], nrm[a * 3 + 1], nrm[a * 3 + 2]) || 1;
      for (let t = 0; t < 3; t++) nrm[a * 3 + t] *= s / l;
    }
    const idx = new Uint32Array((quads.length / 4) * 6);
    for (let j = 0, o = 0; j < quads.length; j += 4, o += 6) idx.set([quads[j], quads[j + 1], quads[j + 2], quads[j], quads[j + 2], quads[j + 3]], o);
    const g = new GL.BufferGeometry();
    g.setAttribute('position', new GL.BufferAttribute(pos, 3));
    g.setAttribute('normal', new GL.BufferAttribute(nrm, 3));
    g.setAttribute('ref', new GL.BufferAttribute(ref, 3));
    g.setIndex(new GL.BufferAttribute(idx, 1));
    this.mesh.geometry.dispose();
    this.mesh.geometry = g;

    const cols = outfit.colours.map(hexToLinear);
    const u = this.material.uniforms;
    u.uColA.value.set(...cols[0]);
    u.uColB.value.set(...(cols[1] || cols[0]));
    u.uColC.value.set(...(cols[2] || cols[1] || cols[0]));
    u.uPattern.value = PATTERN_ID[outfit.pattern] ?? 0;
    u.uSeed.value = (outfit.seed % 997) * 0.37;
    u.uSatin.value = outfit.fabric === 'satin' ? 1 : 0;
    setNeckUniforms(u, outfit.neckline);
  }
}
