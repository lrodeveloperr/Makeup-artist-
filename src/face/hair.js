// Procedural hair and head coverings, rebuilt for every face from the morphed head so they always fit.
//
// Building blocks:
//   cap     - a layer over the scalp (every style), following the head with a style-specific thickness
//   drape   - hair hanging from the sides and back of the head (long styles), kept clear of the face
//   volume  - the cap pushed out to a rounded shape (afro, curly volume, head wrap)
//   balls   - buns, puffs and knots
//   tubes   - box braids and locs
//   cloth   - hijab: everything except an opening for the face, falling from the chin to the shoulders
import * as GL from '../gl/mini.js';
import { createRng } from './rng.js';
import { HAIR_COLOURS, hexToLinear } from './colors.js';
import { createHairMaterial, HAIR_MODE } from './hair-material.js';

const smooth = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

// Same hairline as the skin shader's scalpMask: 1 on the scalp, 0 on the face and ears.
// hairline elevation (radians, seen from the hairline centre) at azimuth a (0 = front)
export function hairlineHeight(a, hl) {
  let h = hl.front;
  h = mix(h, hl.temple, smooth(0, 0.4, a));
  h = mix(h, hl.temple - 0.3, smooth(0.4, 0.78, a));
  h = mix(h, hl.side - 0.3, smooth(0.78, 0.98, a));
  h = mix(h, hl.side, smooth(0.98, 1.12, a));
  h = mix(h, -0.25, smooth(1.45, 1.62, a));
  h = mix(h, -0.6, smooth(1.62, 2.0, a));
  return mix(h, -0.95, smooth(2.0, 2.6, a));
}
export function scalpMask(x, y, z, hl, soft = 0.03, ear = 0) {
  const cx = x, cy = y - 0.15, cz = z + 0.6;
  const a = Math.abs(Math.atan2(cx, cz)), el = Math.atan2(cy, Math.hypot(cx, cz));
  return smooth(-soft, soft, el - hairlineHeight(a, hl)) * (1 - smooth(0.86, 0.96, ear));
}

// Polar description of the current head: centre axis and the outer radius at each (angle, height).
export class HeadFrame {
  constructor(hg) {
    const P = hg.subPos, R = hg.subRegions, nc = hg.head.regionChannels.length, iIn = hg.regionIndex.interior;
    this.P = P; this.N = hg.subNrm; this.ref = hg.refSub; this.R = R; this.nc = nc; this.iIn = iIn; this.iEar = hg.regionIndex.ear;
    this.count = hg.sub.subCount;
    let zmin = Infinity, zmax = -Infinity, top = -Infinity;
    for (let i = 0; i < this.count; i++) {
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
      if (Math.abs(x) < 0.12 && y > 0.2 && y < 0.6) { zmin = Math.min(zmin, z); zmax = Math.max(zmax, z); }
      top = Math.max(top, y);
    }
    this.cz = (zmin + zmax) / 2;
    this.top = top;
    this.depth = zmax - zmin;
    this.TH = 90; this.Y0 = -2.6; this.DY = 0.04; this.NY = Math.ceil((top + 0.1 - this.Y0) / this.DY);
    const r = (this.r = new Float32Array(this.TH * this.NY));
    for (let i = 0; i < this.count; i++) {
      if (R[i * nc + iIn] > 0.5) continue;
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2] - this.cz;
      const th = Math.atan2(x, z), rad = Math.hypot(x, z);
      const ti = ((Math.round((th / (2 * Math.PI)) * this.TH) % this.TH) + this.TH) % this.TH;
      const yi = Math.round((y - this.Y0) / this.DY);
      if (yi < 0 || yi >= this.NY) continue;
      for (const dt of [-1, 0, 1]) {
        const k = ((ti + dt + this.TH) % this.TH) * this.NY + yi;
        if (rad > r[k]) r[k] = rad;
      }
    }
    // fill empty cells (below the mesh, or sparse bins) from the cell above
    for (let t = 0; t < this.TH; t++) {
      for (let yi = this.NY - 2; yi >= 0; yi--) if (r[t * this.NY + yi] === 0) r[t * this.NY + yi] = r[t * this.NY + yi + 1];
      for (let yi = 1; yi < this.NY; yi++) if (r[t * this.NY + yi] === 0) r[t * this.NY + yi] = r[t * this.NY + yi - 1];
    }
  }
  radius(theta, y) {
    const tf = (((theta / (2 * Math.PI)) * this.TH) % this.TH + this.TH) % this.TH;
    const yf = Math.min(Math.max((y - this.Y0) / this.DY, 0), this.NY - 1);
    const t0 = Math.floor(tf), t1 = (t0 + 1) % this.TH, y0 = Math.floor(yf), y1 = Math.min(y0 + 1, this.NY - 1);
    const a = tf - t0, b = yf - y0, r = this.r, NY = this.NY;
    return mix(mix(r[t0 * NY + y0], r[t1 * NY + y0], a), mix(r[t0 * NY + y1], r[t1 * NY + y1], a), b);
  }
  point(theta, y, rad) { return [rad * Math.sin(theta), y, this.cz + rad * Math.cos(theta)]; }
  interior(i) { return this.R[i * this.nc + this.iIn] > 0.5; }
  ear(i) { return this.R[i * this.nc + this.iEar]; }
}

// Accumulates hair surfaces into one BufferGeometry per material.
export class Builder {
  constructor() { this.pos = []; this.nrm = []; this.flow = []; this.hair = []; this.idx = []; }
  get n() { return this.pos.length / 3; }
  vert(p, nrm, flow, hair) { this.pos.push(...p); this.nrm.push(...nrm); this.flow.push(...flow); this.hair.push(...hair); return this.n - 1; }
  quad(a, b, c, d) { this.idx.push(a, b, c, a, c, d); }
  geometry() {
    const g = new GL.BufferGeometry();
    g.setAttribute('position', new GL.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new GL.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('flow', new GL.Float32BufferAttribute(this.flow, 3));
    g.setAttribute('hair', new GL.Float32BufferAttribute(this.hair, 4));
    g.setIndex(this.idx);
    return g;
  }
}
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

// ---------------- cap ----------------
// thick(ref, mask) -> offset along the normal; flowAt(p, ref) -> direction; place(p, n, ref, mask) may move the point
function cap(frame, hg, hl, b, { thick, flowAt, place = null, soft = 0.03, minMask = 0.25, alphaEdge = 0.75, ears = true }) {
  const P = frame.P, N = frame.N, ref = frame.ref, q = hg.sub.subQuads;
  const mask = new Float32Array(frame.count), map = new Int32Array(frame.count).fill(-1);
  for (let i = 0; i < frame.count; i++) mask[i] = frame.interior(i) ? 0 : scalpMask(ref[i * 3], ref[i * 3 + 1], ref[i * 3 + 2], hl, soft, ears ? frame.ear(i) : 0);
  for (let k = 0; k < q.length; k += 4) {
    const ids = [q[k], q[k + 1], q[k + 2], q[k + 3]];
    if (Math.max(...ids.map((i) => mask[i])) < minMask || ids.some((i) => frame.interior(i))) continue;
    const vs = ids.map((i) => {
      if (map[i] < 0) {
        const m = mask[i], r = [ref[i * 3], ref[i * 3 + 1], ref[i * 3 + 2]];
        const n = [N[i * 3], N[i * 3 + 1], N[i * 3 + 2]];
        const o = thick(r, m);
        let p = [P[i * 3] + n[0] * o, P[i * 3 + 1] + n[1] * o, P[i * 3 + 2] + n[2] * o];
        let nn = n;
        if (place) [p, nn] = place(p, n, r, m);
        map[i] = b.vert(p, nn, flowAt(p, r), [0.15 * (1 - m), smooth(minMask, alphaEdge, m), 0, 1]);
      }
      return map[i];
    });
    b.quad(vs[0], vs[1], vs[2], vs[3]);
  }
}

// ---------------- drape ----------------
// Hair falling from the scalp. A strand starts at angle theta0 around the head (0 = front) and height
// yStart, slides down the head and neck, and below the jaw moves either in front of the shoulder (front
// strands) or behind it (back strands), never into the face or body.
const SPLIT = 1.85; // strands starting further back than this fall behind the shoulders
function drapePath(frame, theta0, yStart, length, gap, wave, steps) {
  const pts = [];
  const back = Math.cos(theta0) < Math.cos(SPLIT);
  const sgn = Math.sin(theta0) >= 0 ? 1 : -1;
  let r = frame.radius(theta0, yStart) + gap;
  const dy = length / steps;
  for (let j = 0; j <= steps; j++) {
    const y = yStart - j * dy;
    const low = smooth(-0.75, -1.45, y);
    // front strands swing forwards over the collarbone, back strands swing behind the shoulders
    const a0 = Math.abs(theta0 > Math.PI ? theta0 - 2 * Math.PI : theta0);
    const a = back ? mix(a0, Math.PI - (Math.PI - a0) * 0.6, low) : mix(a0, a0 * 0.62, low);
    let theta = sgn * a;
    if (wave) theta += wave.twist * Math.sin(y * wave.freq * 0.5 + wave.phase);
    // keep clear of the cape below the neck
    const head = frame.radius(theta, y) + Math.max(gap * mix(1, 0.7, j / steps), y < -1.05 ? 0.08 : 0);
    r = y < -1.05 ? Math.max(head, r) : Math.max(head, r * (1 - 0.2 * dy));
    const w = wave ? wave.amp * Math.sin(y * wave.freq + wave.phase) * smooth(0, 0.3, j / steps) : 0;
    pts.push(frame.point(theta, y, r + w));
  }
  return pts;
}
function drapeSheet(frame, b, rng, t0, t1, NT, { yStart, length, gap, wave, jag, frontShorter, layer }) {
  const steps = 28, rows = [];
  for (let i = 0; i <= NT; i++) {
    const theta = mix(t0, t1, i / NT);
    const side = Math.abs(Math.sin(theta / 2)); // 0 at the front, 1 at the back
    const L = length * (1 - frontShorter * (1 - side)) * (1 + jag * (rng.next() - 0.5));
    const ys = yStart - 0.05 * layer + (1 - side) * 0.06;
    const wv = wave && { ...wave, phase: wave.phase + i * 0.35 + rng.next() * 0.4 };
    const path = drapePath(frame, theta, ys, length * 1.15, gap + layer * 0.035, wv, steps);
    rows.push(path.map((p, j) => {
      const t = (j / steps) * 1.15;
      const prev = path[Math.max(j - 1, 0)], next = path[Math.min(j + 1, steps)];
      const flow = norm([next[0] - prev[0], next[1] - prev[1], next[2] - prev[2]]);
      const out = norm([p[0], 0.15, p[2] - frame.cz]);
      const edge = smooth(0, 0.18, Math.min(i, NT - i) / NT + 0.05 * Math.sin(j * 1.7 + i * 2.3));
      const tip = L / (length * 1.15);
      const alpha = (1 - smooth(tip - 0.1, tip, t)) * edge;
      return b.vert(p, out, flow, [Math.min(t, 1), alpha, i, 0.82 + 0.18 * layer]);
    }));
  }
  for (let i = 0; i < NT; i++) for (let j = 0; j < steps; j++) b.quad(rows[i][j], rows[i + 1][j], rows[i + 1][j + 1], rows[i][j + 1]);
}
function drape(frame, b, rng, { thetaFront, yStart, length, gap, wave = null, jag = 0.12, layers = 1, frontShorter = 0.15 }) {
  const o = { yStart, length, gap, wave, jag, frontShorter };
  for (let layer = 0; layer < layers; layer++) {
    const opts = { ...o, layer };
    drapeSheet(frame, b, rng, thetaFront, SPLIT + 0.1, 18, opts);                                    // front left
    drapeSheet(frame, b, rng, SPLIT - 0.1, 2 * Math.PI - SPLIT + 0.1, 40, opts);                      // back
    drapeSheet(frame, b, rng, 2 * Math.PI - SPLIT - 0.1, 2 * Math.PI - thetaFront, 18, opts);        // front right
  }
}

// ---------------- balls (buns, puffs) ----------------
function ball(b, c, radii, flowTo = null, segs = 28) {
  const rings = segs / 2, ids = [];
  for (let j = 0; j <= rings; j++) {
    const v = j / rings, ph = v * Math.PI;
    const row = [];
    for (let i = 0; i <= segs; i++) {
      const th = (i / segs) * 2 * Math.PI;
      const d = [Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)];
      const p = [c[0] + d[0] * radii[0], c[1] + d[1] * radii[1], c[2] + d[2] * radii[2]];
      const flow = flowTo ? norm([flowTo[0] - p[0], flowTo[1] - p[1], flowTo[2] - p[2]]) : norm([-d[2], 0, d[0]]);
      row.push(b.vert(p, d, flow, [0.5, 1, 0, 0.95]));
    }
    ids.push(row);
  }
  for (let j = 0; j < rings; j++) for (let i = 0; i < segs; i++) b.quad(ids[j][i], ids[j][i + 1], ids[j + 1][i + 1], ids[j + 1][i]);
}

// ---------------- hood (afro, head wrap) ----------------
// A rounded shell around the head, sampled by direction from the hairline centre O (the centre used by
// scalpMask), so the opening for the face follows the hairline exactly. Over the scalp the shell sits on
// the ellipsoid (c, R); towards the hairline it rolls back down onto the head.
const HAIRLINE_CENTRE = [0, 0.15, -0.6];
function headDistance(frame, O, d) {
  let lo = 0, hi = 2.6;
  const inside = (t) => {
    const x = O[0] + d[0] * t, y = O[1] + d[1] * t, z = O[2] + d[2] * t;
    return Math.hypot(x, z - frame.cz) < frame.radius(Math.atan2(x, z - frame.cz), y);
  };
  for (let k = 0; k < 22; k++) { const m = (lo + hi) / 2; if (inside(m)) lo = m; else hi = m; }
  return hi;
}
function rayEllipsoid(O, d, c, R) {
  // |(O + d t - c) / R| = 1, far root
  const o = [(O[0] - c[0]) / R[0], (O[1] - c[1]) / R[1], (O[2] - c[2]) / R[2]];
  const v = [d[0] / R[0], d[1] / R[1], d[2] / R[2]];
  const A = v[0] * v[0] + v[1] * v[1] + v[2] * v[2], B = 2 * (o[0] * v[0] + o[1] * v[1] + o[2] * v[2]), C = o[0] * o[0] + o[1] * o[1] + o[2] * o[2] - 1;
  const disc = Math.max(B * B - 4 * A * C, 0);
  return (-B + Math.sqrt(disc)) / (2 * A);
}
function hood(frame, b, c, R, hl, { wideSoft = 0.35, lift = 0.03, bumpy = 0.05, seed = 0, fold = 0, minPh = -1.2, rise = 2.2 } = {}) {
  const O = HAIRLINE_CENTRE, NT = 128, NP = 72;
  const dirs = [], ts = [], mk = [], wd = [];
  for (let j = 0; j <= NP; j++) for (let i = 0; i <= NT; i++) {
    const ph = mix(minPh, Math.PI / 2, j / NP), th = (i / NT) * 2 * Math.PI;
    const d = [Math.cos(ph) * Math.sin(th), Math.sin(ph), Math.cos(ph) * Math.cos(th)];
    dirs.push(d);
    ts.push(headDistance(frame, O, d));
    const q = [O[0] + d[0], O[1] + d[1], O[2] + d[2]]; // scalpMask only uses the direction from O
    mk.push(scalpMask(q[0], q[1], q[2], hl, 0.05));
    wd.push(smooth(0, 1, scalpMask(q[0], q[1], q[2], hl, wideSoft)) ** 0.8);
  }
  // smooth the head distance (the polar head table is coarse)
  const W = NT + 1, ts2 = ts.slice();
  for (let j = 1; j < NP; j++) for (let i = 0; i <= NT; i++) {
    let sum = 0, n = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { sum += ts[(j + dj) * W + ((i + di + W) % W)]; n++; }
    ts2[j * W + i] = sum / n;
  }
  const ids = [];
  for (let k = 0; k < dirs.length; k++) {
    const d = dirs[k], th = Math.atan2(d[0], d[2]);
    const te = rayEllipsoid(O, d, c, R);
    const wob = 1 + bumpy * Math.sin(d[0] * 7 + seed) * Math.sin(d[1] * 6 + d[2] * 5 + seed * 1.3) + fold * Math.sin((d[1] * 1.6 + th * 1.2) * 6);
    // volume grows with the angle above the hairline, so the front edge rolls up instead of overhanging
    const above = Math.atan2(d[1], Math.hypot(d[0], d[2])) - hairlineHeight(Math.abs(th), hl);
    const thick = Math.min(Math.max(te * wob - ts2[k], 0), Math.max(above, 0) * rise);
    const rr = ts2[k] + lift + thick * wd[k];
    const p = [O[0] + d[0] * rr, O[1] + d[1] * rr, O[2] + d[2] * rr];
    ids.push(b.vert(p, d, norm([d[2], 0.2, -d[0]]), [0.1 * (1 - mk[k]), smooth(0.05, 0.4, mk[k]), 0, 1]));
  }
  for (let j = 0; j < NP; j++) for (let i = 0; i < NT; i++) {
    const a = j * W + i, q = [a, a + W, a + W + 1, a + 1];
    if (Math.max(...q.map((x) => mk[x])) < 0.02) continue;
    b.quad(ids[q[0]], ids[q[1]], ids[q[2]], ids[q[3]]);
  }
}

// ---------------- tubes (braids, locs) ----------------
function tube(b, path, radius, sides = 6, taper = 0.6) {
  const rows = [];
  for (let j = 0; j < path.length; j++) {
    const p = path[j], a = path[Math.max(j - 1, 0)], c = path[Math.min(j + 1, path.length - 1)];
    const T = norm([c[0] - a[0], c[1] - a[1], c[2] - a[2]]);
    let U = norm([T[2], 0, -T[0]]);
    if (!Number.isFinite(U[0]) || Math.hypot(...U) < 0.5) U = [1, 0, 0];
    const V = norm([T[1] * U[2] - T[2] * U[1], T[2] * U[0] - T[0] * U[2], T[0] * U[1] - T[1] * U[0]]);
    const t = j / (path.length - 1);
    const r = radius * (1 - (1 - taper) * smooth(0.7, 1, t));
    const row = [];
    for (let s = 0; s <= sides; s++) {
      const ang = (s / sides) * 2 * Math.PI;
      const d = [U[0] * Math.cos(ang) + V[0] * Math.sin(ang), U[1] * Math.cos(ang) + V[1] * Math.sin(ang), U[2] * Math.cos(ang) + V[2] * Math.sin(ang)];
      row.push(b.vert([p[0] + d[0] * r, p[1] + d[1] * r, p[2] + d[2] * r], d, T, [t, 1, ang, 0.9]));
    }
    rows.push(row);
  }
  for (let j = 0; j < rows.length - 1; j++) for (let s = 0; s < sides; s++) b.quad(rows[j][s], rows[j][s + 1], rows[j + 1][s + 1], rows[j + 1][s]);
}

// natural volume of hair lying on the scalp: thickest over the crown, thin at the hairline and nape
const crown = (r, m, top, edge) => (edge + (top - edge) * smooth(-0.1, 0.9, r[1])) * smooth(0, 0.6, m);

// flows over the scalp
const combedBack = (p, r) => norm([Math.sign(r[0]) * 0.15 * Math.abs(r[0]), 0.35 - 0.9 * smooth(0.2, 0.7, Math.abs(r[0])), -1]);
const awayFromPart = (xPart) => (p, r) => norm([Math.sign(r[0] - xPart || 1) * 1.0, -0.55, -0.35]);
const towards = (c) => (p) => norm([c[0] - p[0], c[1] - p[1], c[2] - p[2]]);

export class Hair {
  constructor() {
    this.group = new GL.Group();
    this.materials = [];
  }

  clear() {
    for (const m of this.group.children) m.geometry.dispose();
    this.group.clear();
  }

  add(builder, mode, colours, opts = {}) {
    if (!builder.idx.length) return;
    const mat = this.materials[this.group.children.length] || (this.materials[this.group.children.length] = createHairMaterial());
    const u = mat.uniforms;
    u.uMode.value = mode;
    u.uRoot.value.set(...colours.root); u.uMid.value.set(...colours.mid); u.uTip.value.set(...colours.tip);
    u.uSeed.value = opts.seed || 0;
    u.uShine.value = opts.shine ?? 1;
    u.uScale.value = opts.scale ?? 1;
    u.uPattern.value = opts.pattern ?? 0;
    if (opts.cloth2) u.uCloth2.value.set(...opts.cloth2);
    const mesh = new GL.Mesh(builder.geometry(), mat);
    mesh.renderOrder = opts.order ?? 1;
    this.group.add(mesh);
  }

  build(face, hg) {
    this.clear();
    const h = face.hair, rng = createRng(h.seed);
    const frame = (this.frame = new HeadFrame(hg));
    const hl = h.hairline;
    const natural = HAIR_COLOURS[h.natural] || HAIR_COLOURS['dark-brown'];
    const main = HAIR_COLOURS[h.colour] || natural;
    const hi = h.highlights ? HAIR_COLOURS[h.highlights] : main;
    const colours = { root: h.colour !== h.natural ? mixC(main, natural, 0.25) : main.map((c) => c * 0.85), mid: main, tip: mixC(main, hi, 0.75) };
    const texMode = { straight: HAIR_MODE.strands, wavy: HAIR_MODE.wavy, curly: HAIR_MODE.curly, coily: HAIR_MODE.coily }[h.texture];
    const vol = h.volume, len = h.length;
    const xPart = { middle: 0, left: 0.22, right: -0.22, none: 0 }[h.part];
    const seed = (h.seed % 1000) * 0.1;
    const capB = new Builder(), b = new Builder(), b2 = new Builder();
    const thetaFront = 1.25;
    switch (h.style) {
      case 'long-straight': case 'silk-press': case 'long-wavy': case 'lob': case 'bob': case 'curly-long': case 'curly-shoulder': {
        const length = { 'long-straight': 2.3, 'silk-press': 2.2, 'long-wavy': 2.2, lob: 1.55, bob: 1.1, 'curly-long': 1.9, 'curly-shoulder': 1.4 }[h.style] * len;
        const curly = h.style.startsWith('curly');
        const wavy = h.style === 'long-wavy';
        const gap = (curly ? 0.12 : 0.05) * vol;
        cap(frame, hg, hl, capB, { thick: (r, m) => crown(r, m, (curly ? 0.14 : 0.08) * vol, 0.02), flowAt: h.part === 'none' ? combedBack : awayFromPart(xPart) });
        drape(frame, b, rng, {
          thetaFront: h.style === 'bob' ? 1.15 : thetaFront, yStart: 0.55, length, gap,
          wave: curly ? { amp: 0.05, freq: 22, twist: 0.04, phase: seed } : wavy ? { amp: 0.035, freq: 9, twist: 0.02, phase: seed } : null,
          layers: 2, jag: curly ? 0.2 : 0.08,
        });
        const mode = h.style === 'silk-press' ? HAIR_MODE.strands : curly ? HAIR_MODE.curly : wavy ? HAIR_MODE.wavy : texMode === HAIR_MODE.coily ? HAIR_MODE.curly : texMode;
        this.add(capB, mode, colours, { seed, shine: h.style === 'silk-press' ? 1.4 : 1 });
        this.add(b, mode, colours, { seed, shine: h.style === 'silk-press' ? 1.4 : 1 });
        break;
      }
      case 'pixie': case 'short-crop': case 'curly-top': case 'twa': {
        const top = { pixie: 0.07, 'short-crop': 0.06, 'curly-top': 0.17, twa: 0.1 }[h.style] * vol;
        const sides = { pixie: 0.03, 'short-crop': 0.02, 'curly-top': 0.025, twa: 0.08 }[h.style] * vol;
        cap(frame, hg, hl, capB, {
          thick: (r, m) => mix(sides, top, smooth(0.35, 0.9, r[1])) * smooth(0, 0.5, m) + 0.004,
          flowAt: h.style === 'pixie' ? awayFromPart(xPart || 0.2) : combedBack,
        });
        const mode = h.style === 'twa' || h.style === 'curly-top' ? (h.texture === 'coily' ? HAIR_MODE.coily : HAIR_MODE.curly) : texMode;
        this.add(capB, mode, colours, { seed });
        break;
      }
      case 'buzz': {
        cap(frame, hg, hl, capB, { thick: () => 0.003, flowAt: combedBack, minMask: 0.05, alphaEdge: 0.3 });
        this.add(capB, HAIR_MODE.stubble, colours, { seed, shine: 0.2 });
        break;
      }
      case 'afro': {
        const c = [0, 0.42, frame.cz - 0.08];
        const R = [1.42 * vol, 1.3 * vol, 1.45 * vol];
        hood(frame, capB, c, R, hl, { seed });
        this.add(capB, HAIR_MODE.coily, colours, { seed, shine: 0.6 });
        break;
      }
      case 'afro-puffs': {
        const pc = [[0.62, 0.95, frame.cz + 0.05], [-0.62, 0.95, frame.cz + 0.05]];
        cap(frame, hg, hl, capB, { thick: (r, m) => crown(r, m, 0.04, 0.012), flowAt: (p) => towards(p[0] > 0 ? pc[0] : pc[1])(p) });
        for (const c of pc) ball(b, c, [0.42 * vol, 0.4 * vol, 0.42 * vol]);
        this.add(capB, HAIR_MODE.strands, colours, { seed });
        this.add(b, HAIR_MODE.coily, colours, { seed, shine: 0.5 });
        break;
      }
      case 'high-ponytail': case 'low-bun': case 'top-knot': {
        const at = { 'high-ponytail': [0, 1.05, frame.cz - 0.75], 'low-bun': [0, 0.05, frame.cz - 0.98], 'top-knot': [0, 1.32, frame.cz - 0.25] }[h.style];
        cap(frame, hg, hl, capB, { thick: (r, m) => crown(r, m, 0.055 * vol, 0.012), flowAt: towards(at) });
        const capMode = texMode === HAIR_MODE.coily ? HAIR_MODE.wavy : texMode === HAIR_MODE.curly ? HAIR_MODE.wavy : texMode;
        this.add(capB, capMode, colours, { seed });
        if (h.style === 'high-ponytail') {
          const path = [];
          for (let j = 0; j <= 16; j++) { const t = j / 16; path.push([0.05 * Math.sin(t * 3), at[1] - 2.0 * t * len + 0.25 * Math.sin(t * Math.PI), at[2] - 0.15 - 0.35 * Math.sin(t * 1.6)]); }
          tube(b, path, 0.2 * vol, 10, 0.3);
          this.add(b, texMode === HAIR_MODE.coily ? HAIR_MODE.curly : texMode, colours, { seed });
        } else {
          ball(b, at, h.style === 'low-bun' ? [0.36 * vol, 0.3 * vol, 0.3 * vol] : [0.36 * vol, 0.3 * vol, 0.36 * vol]);
          this.add(b, texMode === HAIR_MODE.coily ? HAIR_MODE.coily : HAIR_MODE.wavy, colours, { seed });
        }
        break;
      }
      case 'box-braids': case 'locs': {
        const braid = h.style === 'box-braids';
        cap(frame, hg, hl, capB, { thick: (r, m) => crown(r, m, 0.045, 0.02), flowAt: awayFromPart(xPart) });
        this.add(capB, braid ? HAIR_MODE.braid : HAIR_MODE.loc, colours, { seed });
        const n = braid ? 74 : 56, length = (braid ? 2.4 : 2.1) * len;
        for (let k = 0; k < n; k++) {
          const layer = k % 3;
          const theta = mix(thetaFront - 0.05, 2 * Math.PI - thetaFront + 0.05, (k + rng.next() * 0.6) / n);
          const ys = 0.55 + rng.range(-0.05, 0.12) - layer * 0.05;
          const path = drapePath(frame, theta, ys, length * rng.range(0.9, 1.05), 0.05 + layer * 0.045, { amp: 0.015, freq: 5, twist: 0.015, phase: rng.next() * 6 }, 18);
          tube(b, path, braid ? 0.032 : 0.042, 6, braid ? 0.55 : 0.8);
        }
        this.add(b, braid ? HAIR_MODE.braid : HAIR_MODE.loc, colours, { seed, shine: braid ? 0.8 : 0.4 });
        break;
      }
      case 'cornrows': {
        cap(frame, hg, hl, capB, { thick: () => 0.018, flowAt: combedBack, minMask: 0.05, alphaEdge: 0.35 });
        this.add(capB, HAIR_MODE.cornrows, colours, { seed });
        break;
      }
      case 'hijab': {
        const wrap = hexToLinear(h.wrap.colour);
        const second = mixC(wrap, [0.9, 0.88, 0.84], 0.55);
        cloth(frame, hg, b, rng);
        this.add(b, HAIR_MODE.cloth, { root: wrap, mid: wrap, tip: wrap }, { seed: h.wrap.seed * 0.01, pattern: { plain: 0, print: 1, stripe: 2 }[h.wrap.pattern], cloth2: second, scale: 1 });
        break;
      }
      case 'headwrap': {
        const wrap = hexToLinear(h.wrap.colour);
        const second = mixC(wrap, [0.95, 0.75, 0.2], 0.6);
        const c = [0, 0.62, frame.cz - 0.12];
        const R = [0.86, 0.98, 1.0];
        const wrapLine = { front: hl.front - 0.05, temple: hl.temple - 0.02, side: hl.side + 0.1 };
        cap(frame, hg, wrapLine, capB, {
          thick: () => 0.035, flowAt: (p) => norm([1, 0.35 * Math.sign(p[0]), 0]), soft: 0.02, minMask: 0.02, alphaEdge: 0.06, ears: false,
          place: (p, n, r, m) => {
            const [q, nn] = volumeTo(p, n, c, R, smooth(0.0, 0.6, m) * 0.9, seed, 0.0);
            // wrapped folds running diagonally around the head
            const f = 0.025 * Math.sin((q[1] * 1.6 + Math.atan2(q[0], q[2] - frame.cz) * 1.2) * 6) * smooth(0.1, 0.6, m);
            return [[q[0] + nn[0] * f, q[1] + nn[1] * f, q[2] + nn[2] * f], nn];
          },
        });
        // the knot sits on the front of the wrap, a little above the forehead
        const d = norm([0, 0.75, 0.66]);
        const k = 1 / Math.hypot(d[0] / R[0], d[1] / R[1], d[2] / R[2]);
        ball(b2, [c[0], c[1] + d[1] * k * 0.98, c[2] + d[2] * k * 0.98], [0.26, 0.17, 0.2]);
        const cols = { root: wrap, mid: wrap, tip: wrap };
        const pattern = { plain: 0, print: 1, stripe: 2 }[h.wrap.pattern];
        this.add(capB, HAIR_MODE.cloth, cols, { seed: h.wrap.seed * 0.01, pattern, cloth2: second });
        this.add(b2, HAIR_MODE.cloth, cols, { seed: h.wrap.seed * 0.01 + 1, pattern, cloth2: second });
        break;
      }
      default:
        break;
    }
  }
}

const mixC = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

// push a scalp point towards an ellipsoid around c (weight w), with a slightly uneven outline
function volumeTo(p, n, c, R, w, seed, bumpy = 0.05) {
  const d = norm([p[0] - c[0], p[1] - c[1], p[2] - c[2]]);
  // never inside the head: at least a little hair above the scalp
  const k = Math.max(1 / Math.hypot(d[0] / R[0], d[1] / R[1], d[2] / R[2]), Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) + 0.06);
  const wob = 1 + bumpy * Math.sin(d[0] * 7 + seed) * Math.sin(d[1] * 6 + d[2] * 5 + seed * 1.3);
  const target = [c[0] + d[0] * k * wob, c[1] + d[1] * k * wob, c[2] + d[2] * k * wob];
  const out = [mix(p[0], target[0], w), mix(p[1], target[1], w), mix(p[2], target[2], w)];
  return [out, norm([mix(n[0], d[0], w), mix(n[1], d[1], w), mix(n[2], d[2], w)])];
}

// ---------------- cape ----------------
// A makeup cape over the shoulders: it hides where the body mesh ends and anything that falls behind
// the shoulders.
export function buildCape(frame, b) {
  const NT = 96, NY = 44, rows = [];
  for (let i = 0; i <= NT; i++) {
    const theta = (i / NT) * 2 * Math.PI;
    const c = Math.cos(theta);
    const yTop = c > 0 ? mix(-1.18, -1.5, c * c * c) : -1.15; // neckline: a soft scoop at the front
    const row = [];
    let r = 0;
    for (let j = 0; j <= NY; j++) {
      const t = j / NY;
      const y = yTop - t * t * 2.2 - t * 0.2;
      const body = frame.radius(theta, Math.max(y, -1.95)) + 0.04 + (y < -1.95 ? (-1.95 - y) * 0.12 : 0);
      r = j === 0 ? frame.radius(theta, yTop) + 0.035 : Math.max(body, r);
      const p = frame.point(theta, y, r);
      row.push(b.vert(p, norm([Math.sin(theta), 0.3, c]), [0, -1, 0], [0.5, 1, 0, j === 0 ? 0.8 : 1]));
    }
    rows.push(row);
  }
  for (let i = 0; i < NT; i++) for (let j = 0; j < NY; j++) b.quad(rows[i][j], rows[i][j + 1], rows[i + 1][j + 1], rows[i + 1][j]);
}

// ---------------- hijab ----------------
// The skin outside a face opening, offset outwards; below the jaw the cloth falls in a straight line from
// the chin and jaw to the shoulders instead of following the neck.
function cloth(frame, hg, b, rng) {
  const P = frame.P, N = frame.N, ref = frame.ref, q = hg.sub.subQuads, map = new Int32Array(frame.count).fill(-1);
  const open = (r) => {
    const e = Math.hypot(r[0] / 0.6, (r[1] + 0.17) / 0.92);
    return r[2] > -0.15 ? smooth(0.97, 1.04, e) : 1; // 0 inside the face opening
  };
  const yJaw = -0.95, yShoulder = -1.75;
  for (let k = 0; k < q.length; k += 4) {
    const ids = [q[k], q[k + 1], q[k + 2], q[k + 3]];
    if (ids.some((i) => frame.interior(i))) continue;
    const m = ids.map((i) => open([ref[i * 3], ref[i * 3 + 1], ref[i * 3 + 2]]));
    if (Math.max(...m) < 0.02) continue;
    const vs = ids.map((i, c) => {
      if (map[i] < 0) {
        const n = [N[i * 3], N[i * 3 + 1], N[i * 3 + 2]];
        let p = [P[i * 3] + n[0] * 0.05, P[i * 3 + 1] + n[1] * 0.05, P[i * 3 + 2] + n[2] * 0.05];
        const y = p[1];
        if (y < yJaw + 0.15) {
          const th = Math.atan2(p[0], p[2] - frame.cz);
          const rJaw = frame.radius(th, yJaw) + 0.06, rSh = frame.radius(th, yShoulder) + 0.05;
          const t = Math.min(Math.max((y - yJaw) / (yShoulder - yJaw), 0), 1);
          const hull = mix(rJaw, rSh, t * t * 0.6 + t * 0.4);
          const rad = Math.hypot(p[0], p[2] - frame.cz);
          const w = smooth(yJaw + 0.15, yJaw - 0.05, y);
          const target = Math.max(rad, hull);
          const rr = mix(rad, target, w);
          p = frame.point(th, y, rr);
        }
        map[i] = b.vert(p, n, [0, -1, 0], [0.5, m[c] > 0 ? Math.min(1, m[c] * 3) : 0, 0, 1]);
      }
      return map[i];
    });
    b.quad(vs[0], vs[1], vs[2], vs[3]);
  }
}
