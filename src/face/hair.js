// Procedural long hair, rebuilt for every face from the morphed head so it always fits.
//
// Building blocks:
//   hood    - the hair lying on the head: a shell around the skull that rolls down onto the scalp at the
//             hairline, so the hairline follows the face exactly
//   drape   - hair hanging from that shell at the sides and back, plus face-framing front pieces
//   tubes   - box braids, locs and cornrow braids
//   cap     - a thin layer over the scalp (cornrows)
import * as GL from '../gl/mini.js';
import { createRng } from './rng.js';
import { HAIR_COLOURS } from './colors.js';
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
    const low = (this.low = new Float32Array(this.TH).fill(Infinity)); // where the body mesh ends, by angle
    for (let i = 0; i < this.count; i++) {
      if (R[i * nc + iIn] > 0.5) continue;
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2] - this.cz;
      const th = Math.atan2(x, z), rad = Math.hypot(x, z);
      const ti = ((Math.round((th / (2 * Math.PI)) * this.TH) % this.TH) + this.TH) % this.TH;
      if (y < low[ti]) low[ti] = y;
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
  // lowest point of the body mesh around angle theta (it varies from face to face with the neck shape)
  lowest(theta) {
    const t = Math.round((theta / (2 * Math.PI)) * this.TH);
    let y = Infinity;
    for (const d of [-1, 0, 1]) y = Math.min(y, this.low[(((t + d) % this.TH) + this.TH) % this.TH]);
    return Number.isFinite(y) ? y : -1.8;
  }
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

// ---------------- shell ----------------
// An ellipsoid around the skull, `lift` (top, side, back) above it: the outer surface of hair lying on the
// head. Loose hair falls from this shell instead of hugging the skull, which is what keeps it from
// looking like a painted cap.
export function skullShell(frame, { top, side, back }) {
  let half = 0, rear = 0;
  for (let y = 0.2; y <= 0.81; y += 0.1) {
    half = Math.max(half, frame.radius(Math.PI / 2, y), frame.radius(-Math.PI / 2, y));
    rear = Math.max(rear, frame.radius(Math.PI, y));
  }
  const fore = frame.radius(0, 0.45), yc = 0.2;
  return { c: [0, yc, frame.cz + (fore - rear) / 2], R: [half + side, frame.top - yc + top, (fore + rear) / 2 + back] };
}
// distance from the head's vertical axis to the shell at angle theta and height y (0 above or below it)
function shellRadius(frame, sh, theta, y) {
  const s = Math.sin(theta), c = Math.cos(theta), [Rx, Ry, Rz] = sh.R;
  const dy = (y - sh.c[1]) / Ry, dz = frame.cz - sh.c[2];
  const A = (s / Rx) ** 2 + (c / Rz) ** 2, B = (2 * dz * c) / (Rz * Rz), C = (dz / Rz) ** 2 + dy * dy - 1;
  const disc = B * B - 4 * A * C;
  return disc > 0 ? (-B + Math.sqrt(disc)) / (2 * A) : 0;
}

// ---------------- drape ----------------
// Hair falling from the head. A strand starts at angle theta0 around the head (0 = front) and height y0,
// moves over the shell to angle theta1 by height yTurn, then hangs: it never moves back in towards the
// head, so the sides fall straight down from the widest part of the skull and over the ears. Below the jaw
// it moves either in front of the shoulder (front strands) or behind it (back strands), never into the
// face or body.
const SPLIT = 1.85; // strands hanging further back than this fall behind the shoulders
function drapePath(frame, sh, { theta0, theta1 = theta0, y0, yTurn = y0, length, gap, wave, steps }) {
  const pts = [];
  const back = Math.cos(theta1) < Math.cos(SPLIT);
  let r = 0;
  const dy = length / steps;
  for (let j = 0; j <= steps; j++) {
    const y = y0 - j * dy;
    const over = y0 > yTurn ? smooth(y0, yTurn, y) : 1;
    const t0 = mix(theta0, theta1, over);
    const sgn = Math.sin(t0) >= 0 ? 1 : -1;
    const low = smooth(-0.75, -1.45, y);
    // front strands swing forwards over the collarbone, back strands swing behind the shoulders
    const a0 = Math.abs(t0 > Math.PI ? t0 - 2 * Math.PI : t0);
    const a = back ? mix(a0, Math.PI - (Math.PI - a0) * 0.6, low) : mix(a0, a0 * 0.7, low);
    let theta = sgn * a;
    if (wave) theta += wave.twist * Math.sin(y * wave.freq * 0.5 + wave.phase);
    const head = frame.radius(theta, y) + Math.max(gap, y < -1.05 ? 0.08 : 0);
    const shell = sh ? shellRadius(frame, sh, theta, y) + gap * 0.3 : 0;
    // over the shell the strand follows it; once hanging it only ever moves outwards
    r = Math.max(head, shell, over < 1 ? 0 : r);
    const w = wave ? wave.amp * Math.sin(y * wave.freq + wave.phase) * smooth(0, 0.3, j / steps) : 0;
    pts.push(frame.point(theta, y, r + w));
  }
  return pts;
}
// A sheet of hair between two strand paths; pathAt(u, layer) gives the path options at u (0..1 across).
function drapeSheet(frame, sh, b, rng, NT, pathAt, { length, jag, layer, steps = 28, fadeIn = 0 }) {
  const rows = [];
  for (let i = 0; i <= NT; i++) {
    const u = i / NT, o = pathAt(u);
    const L = o.length * (1 + jag * (rng.next() - 0.5));
    const path = drapePath(frame, sh, { ...o, length: o.length * 1.15, gap: o.gap + layer * 0.035, steps });
    rows.push(path.map((p, j) => {
      const t = (j / steps) * 1.15;
      const prev = path[Math.max(j - 1, 0)], next = path[Math.min(j + 1, steps)];
      const flow = norm([next[0] - prev[0], next[1] - prev[1], next[2] - prev[2]]);
      const out = norm([p[0], 0.15, p[2] - frame.cz]);
      const edge = smooth(0, 0.18, Math.min(i, NT - i) / NT + 0.05 * Math.sin(j * 1.7 + i * 2.3));
      const tip = L / o.length; // t runs to 1.15 so jagged ends can fall past the nominal length
      const alpha = (1 - smooth(tip - 0.1, tip, t)) * edge * (fadeIn ? smooth(0, fadeIn, t) : 1);
      return b.vert(p, out, flow, [Math.min(t, 1), alpha, i, 0.82 + 0.18 * layer]);
    }));
  }
  // wound so the outer side (normal `out`) is the front face
  for (let i = 0; i < NT; i++) for (let j = 0; j < steps; j++) b.quad(rows[i][j], rows[i][j + 1], rows[i + 1][j + 1], rows[i + 1][j]);
}
// Loose hair: sheets hanging from the shell around the sides and back, plus face-framing front pieces
// that leave the parting, sweep over the corners of the forehead and fall beside the cheeks.
function drape(frame, sh, b, rng, { thetaFront, yStart, length, gap, wave = null, jag = 0.12, layers = 1, frontShorter = 0.15, framing = 0, sweep = 1, xPart = 0 }) {
  for (let layer = 0; layer < layers; layer++) {
    const ys = yStart - 0.05 * layer;
    const hang = (t0, t1) => (u) => {
      const theta = mix(t0, t1, u);
      const side = Math.abs(Math.sin(theta / 2)); // 0 at the front, 1 at the back
      const wv = wave && { ...wave, phase: wave.phase + u * 9 + rng.next() * 0.4 };
      return { theta0: theta, y0: ys + (1 - side) * 0.06, length: length * (1 - frontShorter * (1 - side)), gap, wave: wv };
    };
    const opts = { jag, layer };
    drapeSheet(frame, sh, b, rng, 18, hang(thetaFront, SPLIT + 0.1), opts);                              // front left
    drapeSheet(frame, sh, b, rng, 40, hang(SPLIT - 0.1, 2 * Math.PI - SPLIT + 0.1), opts);                // back
    drapeSheet(frame, sh, b, rng, 18, hang(2 * Math.PI - SPLIT - 0.1, 2 * Math.PI - thetaFront), opts);  // front right
  }
  if (!framing) return;
  // sweep 1: the pieces start at the parting; lower values start them further out, nearer the temples
  for (const side of [1, -1]) {
    const start = mix(0.75, Math.max(0.12, Math.min(0.6, 0.12 + side * xPart * 1.6)), sweep);
    // u runs towards increasing angle on both sides, so both pieces are wound the same way
    drapeSheet(frame, sh, b, rng, 10, (v) => {
      const u = side > 0 ? v : 1 - v;
      const t1 = mix(0.92, thetaFront + 0.06, u);
      const wv = wave && { ...wave, phase: wave.phase + 3 + u * 5 };
      return {
        theta0: side * mix(start, 0.75, u), theta1: side * t1, y0: mix(mix(0.8, 1.0, sweep), 0.72, u), yTurn: 0.05,
        length: length * framing * (0.85 + 0.15 * u), gap: gap * 0.6, wave: wv,
      };
    }, { jag: jag * 0.6, layer: 0.5, steps: 32 });
  }
}

// ---------------- hood ----------------
// A rounded shell around the head, sampled by direction from the hairline centre O (the centre used by
// scalpMask), so the opening for the face follows the hairline exactly. Over the scalp the shell sits on
// the ellipsoid (c, R); towards the hairline it rolls back down onto the head.
const HAIRLINE_CENTRE = [0, 0.15, -0.6];
function headDistance(frame, O, d) {
  let lo = 0, hi = 2.6;
  const inside = (t) => {
    const x = O[0] + d[0] * t, y = O[1] + d[1] * t, z = O[2] + d[2] * t;
    return y < frame.top && Math.hypot(x, z - frame.cz) < frame.radius(Math.atan2(x, z - frame.cz), y);
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
function hood(frame, b, c, R, hl, { wideSoft = 0.35, lift = 0.03, bumpy = 0.05, seed = 0, minPh = -1.2, rise = 2.2, flowAt = null, groove = null, pixelMask = false } = {}) {
  const O = HAIRLINE_CENTRE, NT = 128, NP = 72;
  const dirs = [], ts = [], mk = [], wd = [];
  for (let j = 0; j <= NP; j++) for (let i = 0; i <= NT; i++) {
    const ph = mix(minPh, Math.PI / 2, j / NP), th = (i / NT) * 2 * Math.PI;
    const d = [Math.cos(ph) * Math.sin(th), Math.sin(ph), Math.cos(ph) * Math.cos(th)];
    dirs.push(d);
    ts.push(headDistance(frame, O, d));
    const q = [O[0] + d[0], O[1] + d[1], O[2] + d[2]]; // scalpMask only uses the direction from O
    mk.push(scalpMask(q[0], q[1], q[2], hl, pixelMask ? 0.12 : 0.05));
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
    const wob = 1 + bumpy * Math.sin(d[0] * 7 + seed) * Math.sin(d[1] * 6 + d[2] * 5 + seed * 1.3);
    // volume grows with the angle above the hairline, so the front edge rolls up instead of overhanging
    const above = Math.atan2(d[1], Math.hypot(d[0], d[2])) - hairlineHeight(Math.abs(th), hl);
    const thick = Math.min(Math.max(te * wob - ts2[k], 0), Math.max(above, 0) * rise);
    const p0 = [O[0] + d[0] * ts2[k], O[1] + d[1] * ts2[k], O[2] + d[2] * ts2[k]];
    const rr = ts2[k] + lift + thick * wd[k] * (groove ? groove(p0) : 1);
    const p = [O[0] + d[0] * rr, O[1] + d[1] * rr, O[2] + d[2] * rr];
    const f = flowAt ? flowAt(p) : [d[2], 0.2, -d[0]];
    const fd = f[0] * d[0] + f[1] * d[1] + f[2] * d[2];
    ids.push(b.vert(p, d, norm([f[0] - fd * d[0], f[1] - fd * d[1], f[2] - fd * d[2]]), [0.1 * (1 - mk[k]), pixelMask ? 1 : smooth(0.05, 0.4, mk[k]), 0, 1]));
  }
  for (let j = 0; j < NP; j++) for (let i = 0; i < NT; i++) {
    const a = j * W + i, q = [a, a + W, a + W + 1, a + 1];
    if (Math.max(...q.map((x) => mk[x])) < 0.02) continue;
    b.quad(ids[q[0]], ids[q[3]], ids[q[2]], ids[q[1]]); // wound so the outside is the front face
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


// flows over the scalp
const combedBack = (p, r) => norm([Math.sign(r[0]) * 0.15 * Math.abs(r[0]), 0.35 - 0.9 * smooth(0.2, 0.7, Math.abs(r[0])), -1]);
// hood flows (projected onto the shell): away from a side or middle parting, or back from the hairline
const fromPart = (xPart) => (p) => [Math.sign(p[0] - xPart || 1) * 0.9, -0.75, -0.3];
const fromHairline = (p) => [Math.sign(p[0]) * 0.25, -0.2, -1];
// the hair is flatter along the parting line, which runs from the front hairline back to the crown
const partGroove = (xPart) => (p) => (p[2] > -1.0 && p[1] > 0.5 ? 1 - 0.75 * Math.exp(-(((p[0] - xPart) / 0.06) ** 2)) : 1);

const SOLID = 0.9; // alpha from which hair is drawn in the solid (depth-writing) pass

export class Hair {
  constructor() {
    this.group = new GL.Group();
    this.materials = [];
    this.slots = 0;
  }

  clear() {
    for (const m of this.group.children) m.geometry.dispose();
    this.group.clear();
    this.slots = 0;
  }

  // Each surface is drawn in two passes: the solid part first, writing depth so hair behind it is
  // hidden, then the soft fringes blended on top without writing depth. Writing depth for nearly
  // transparent fringes would punch see-through holes in the hair behind them.
  add(builder, mode, colours, opts = {}) {
    if (!builder.idx.length) return;
    const slot = this.slots++;
    const pair = this.materials[slot] || (this.materials[slot] = [createHairMaterial(), createHairMaterial()]);
    const geometry = builder.geometry();
    const hl = opts.hairline;
    pair.forEach((mat, pass) => {
      const u = mat.uniforms;
      u.uMode.value = mode;
      u.uRoot.value.set(...colours.root); u.uMid.value.set(...colours.mid); u.uTip.value.set(...colours.tip);
      u.uSeed.value = opts.seed || 0;
      u.uShine.value = opts.shine ?? 1;
      u.uHairline.value.set(hl ? hl.front : 0, hl ? hl.temple : 0, hl ? hl.side : 0, hl ? 0.035 : 0);
      u.uAlphaCut.value.set(pass ? 0.02 : SOLID, pass ? SOLID : 2);
      mat.depthWrite = !pass;
      const mesh = new GL.Mesh(geometry, mat);
      mesh.renderOrder = (opts.order ?? 1) + 0.5 * pass;
      this.group.add(mesh);
    });
  }

  build(face, hg) {
    this.clear();
    const h = face.hair, rng = createRng(h.seed);
    const frame = (this.frame = new HeadFrame(hg));
    const hl = h.hairline;
    const natural = HAIR_COLOURS[h.natural] || HAIR_COLOURS['dark-brown'];
    const main = HAIR_COLOURS[h.colour] || natural;
    const hi = h.highlights ? HAIR_COLOURS[h.highlights] : main;
    const colours = { root: main.map((c) => c * 0.92), mid: main, tip: mixC(main, hi, 0.75) };
    const vol = h.volume, len = h.length;
    const xPart = { middle: 0, left: 0.22, right: -0.22, none: 0 }[h.part];
    const seed = (h.seed % 1000) * 0.1;
    const capB = new Builder(), b = new Builder();
    const thetaFront = 1.25;
    switch (h.style) {
      case 'long-straight': case 'long-layered': case 'silk-press': case 'long-wavy': case 'curly-long': {
        // all long: the ends fall past the bottom of the frame (y = -1.94), over the shoulders and back
        const length = { 'long-straight': 2.75, 'long-layered': 2.6, 'silk-press': 2.7, 'long-wavy': 2.65, 'curly-long': 2.45 }[h.style] * len;
        const curly = h.style === 'curly-long';
        const wavy = h.style === 'long-wavy' || (h.style === 'long-layered' && h.texture === 'wavy');
        const layered = h.style === 'long-layered';
        const sh = skullShell(frame, curly ? { top: 0.2 * vol, side: 0.3 * vol, back: 0.24 * vol } : { top: 0.1 * vol, side: 0.13 * vol, back: 0.13 * vol });
        hood(frame, capB, sh.c, sh.R, hl, {
          seed, bumpy: curly ? 0.04 : 0.008, lift: 0.015, rise: curly ? 1.6 : 1.1, wideSoft: 0.25,
          flowAt: h.part === 'none' ? fromHairline : fromPart(xPart), groove: h.part === 'none' ? null : partGroove(xPart), pixelMask: true,
        });
        drape(frame, sh, b, rng, {
          thetaFront, yStart: 0.45, length, gap: curly ? 0.08 * vol : 0.03,
          wave: curly ? { amp: 0.05, freq: 22, twist: 0.04, phase: seed } : wavy ? { amp: 0.035, freq: 9, twist: 0.02, phase: seed } : null,
          // layered: the front falls shorter and the framing pieces end around the jaw
          layers: 2, jag: curly ? 0.2 : 0.08, frontShorter: layered ? 0.35 : 0.15, framing: layered ? 0.55 : 0.9, sweep: curly ? 0.3 : 1, xPart,
        });
        const mode = h.style === 'silk-press' ? HAIR_MODE.strands : curly ? HAIR_MODE.curly : wavy || h.texture !== 'straight' ? HAIR_MODE.wavy : HAIR_MODE.strands;
        this.add(capB, mode, colours, { seed, shine: h.style === 'silk-press' ? 1.4 : 1, hairline: hl });
        this.add(b, mode, colours, { seed, shine: h.style === 'silk-press' ? 1.4 : 1 });
        break;
      }
      case 'box-braids': case 'locs': {
        const braid = h.style === 'box-braids';
        const sh = skullShell(frame, { top: 0.09, side: 0.1, back: 0.1 });
        hood(frame, capB, sh.c, sh.R, hl, { seed, bumpy: 0.01, lift: 0.012, rise: 1.0, wideSoft: 0.25, flowAt: fromPart(xPart), groove: partGroove(xPart), pixelMask: true });
        this.add(capB, braid ? HAIR_MODE.braid : HAIR_MODE.loc, colours, { seed, hairline: hl });
        const n = braid ? 74 : 56, length = (braid ? 2.8 : 2.65) * len;
        for (let k = 0; k < n; k++) {
          const layer = k % 3;
          const theta = mix(thetaFront - 0.05, 2 * Math.PI - thetaFront + 0.05, (k + rng.next() * 0.6) / n);
          const ys = 0.5 + rng.range(-0.05, 0.12) - layer * 0.05;
          const path = drapePath(frame, sh, { theta0: theta, y0: ys, length: length * rng.range(0.9, 1.05), gap: 0.03 + layer * 0.045, wave: { amp: 0.015, freq: 5, twist: 0.015, phase: rng.next() * 6 }, steps: 18 });
          tube(b, path, braid ? 0.032 : 0.042, 6, braid ? 0.55 : 0.8);
        }
        this.add(b, braid ? HAIR_MODE.braid : HAIR_MODE.loc, colours, { seed, shine: braid ? 0.8 : 0.4 });
        break;
      }
      case 'cornrow-braids': {
        // cornrows running back over the scalp, ending in braids that hang behind and over the shoulders
        cap(frame, hg, hl, capB, { thick: () => 0.018, flowAt: combedBack, minMask: 0.05, alphaEdge: 0.35 });
        this.add(capB, HAIR_MODE.cornrows, colours, { seed });
        const n = 26, length = 2.7 * len;
        for (let k = 0; k < n; k++) {
          const theta = mix(1.55, 2 * Math.PI - 1.55, (k + rng.next() * 0.5) / n);
          const path = drapePath(frame, null, { theta0: theta, y0: rng.range(0.0, 0.3), length: length * rng.range(0.92, 1.04), gap: 0.04, wave: { amp: 0.012, freq: 5, twist: 0.01, phase: rng.next() * 6 }, steps: 18 });
          tube(b, path, 0.03, 6, 0.55);
        }
        this.add(b, HAIR_MODE.braid, colours, { seed, shine: 0.8 });
        break;
      }
      default:
        break;
    }
  }
}

const mixC = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

// ---------------- garment ----------------
// A soft off-the-shoulder wrap at the bottom of the frame: it leaves the whole neck and the line into the
// shoulders bare and hides where the body mesh ends, which moves with each face's neck shape. Below the
// mesh the shoulders are continued outwards so the wrap fills the bottom of the frame.
export function buildCape(frame, b) {
  const NT = 96, NY = 24, rows = [];
  for (let i = 0; i <= NT; i++) {
    const theta = (i / NT) * 2 * Math.PI;
    const c = Math.cos(theta), s2 = Math.sin(theta) ** 2;
    const end = frame.lowest(theta);
    // neckline: straight across the chest, rising a little over the shoulders, always above the mesh end
    const yTop = Math.max(c > 0 ? mix(-1.66, -1.63, s2) : -1.63, end + 0.06);
    const row = [];
    for (let j = 0; j <= NY; j++) {
      const t = j / NY;
      const y = yTop - t * t * 0.9 - t * 0.1;
      const yb = Math.max(y, end);
      const roll = j === 0 ? 0.02 : j === 1 ? 0.04 : 0.03; // a rolled top edge
      // enclose the body a little below this height too, so the top edge sits in front of the chest's curve
      const body = Math.max(frame.radius(theta, yb), frame.radius(theta, Math.max(yb - 0.06, end)), frame.radius(theta, end));
      let p = frame.point(theta, yb, body + roll);
      const below = Math.max(end - y, 0);
      if (below > 0) p = [p[0] * Math.min(1 + 1.6 * below, 1.5), y, p[2] + Math.max(c, 0) * 0.35 * below];
      row.push(b.vert(p, norm([Math.sin(theta), 0.35, c]), [Math.sin(theta) * 0.2, -1, 0], [0.5, 1, 0, j === 0 ? 0.85 : 1]));
    }
    rows.push(row);
  }
  for (let i = 0; i < NT; i++) for (let j = 0; j < NY; j++) b.quad(rows[i][j], rows[i][j + 1], rows[i + 1][j + 1], rows[i + 1][j]);
}
