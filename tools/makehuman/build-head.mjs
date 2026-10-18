// Builds assets/head.bin.gz (and head.manifest.json) from the pinned CC0 MakeHuman base mesh and targets.
// Usage: node tools/makehuman/fetch.mjs && node tools/makehuman/build-head.mjs
//
// Output: the head and neck of the hm08 base mesh as a young-adult neutral reference (equal blend of the
// three bundled ethnic macro targets at 25 years, female), helper vertices for the eyes and lash lines,
// a repacked face-first UV layout, and one sparse delta per shape dimension (see dims.mjs).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { openSource, parseObj, parseTarget, MAKEHUMAN_COMMIT, MAKEHUMAN_REPO } from './source.mjs';
import { DIMS } from './dims.mjs';

const OUT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../assets/head.bin.gz');
const NECK_BELOW_EYES = 1.8; // keep faces whose every vertex is at most this far below the eyes (decimetres)
const UV_PAD = 8 / 2048;
const HELPERS = ['helper-l-eye', 'helper-r-eye', 'helper-l-eyelashes-1', 'helper-r-eyelashes-1', 'helper-l-eyelashes-2', 'helper-r-eyelashes-2'];

const src = openSource();
const obj = parseObj(src.read('3dobjs/base.obj'));
const N = obj.V.length;
const base = new Float64Array(N * 3);
obj.V.forEach((v, i) => base.set(v, i * 3));

const targetCache = new Map();
function target(name) {
  if (!targetCache.has(name)) targetCache.set(name, parseTarget(src.read(`targets/${name}.target`)));
  return targetCache.get(name);
}
function addTarget(P, name, w) {
  const t = target(name);
  for (let k = 0; k < t.idx.length; k++) {
    const i = t.idx[k] * 3;
    P[i] += w * t.d[k * 3]; P[i + 1] += w * t.d[k * 3 + 1]; P[i + 2] += w * t.d[k * 3 + 2];
  }
}
// MakeHuman's default ethnic mix (1/3 each) at age 25: the neutral reference for one gender
function neutral(gender) {
  const P = Float64Array.from(base);
  for (const e of ['african', 'asian', 'caucasian']) addTarget(P, `macrodetails/${e}-${gender}-young`, 1 / 3);
  return P;
}
const REF = neutral('female');
const MALE = neutral('male');

// ---------------- vertex subset ----------------
const groupCentroid = (g) => {
  const vs = [...new Set(obj.F.filter((f) => f.group === g).flatMap((f) => f.v))];
  return [0, 1, 2].map((a) => vs.reduce((s, i) => s + REF[i * 3 + a], 0) / vs.length);
};
const eyeY = (groupCentroid('helper-l-eye')[1] + groupCentroid('helper-r-eye')[1]) / 2;
const NECK_CUT = eyeY - NECK_BELOW_EYES;
const headFaces = obj.F.filter((f) => f.group === 'body' && f.v.every((i) => REF[i * 3 + 1] > NECK_CUT));
if (headFaces.some((f) => f.v.length !== 4)) throw new Error('expected quads only');
const order = [], remap = new Map();
const use = (i) => { if (!remap.has(i)) { remap.set(i, order.length); order.push(i); } return remap.get(i); };
// head vertices in Morton (Z-curve) order of their position, so neighbouring vertices get neighbouring
// indices: sparse target indices then compress to short runs
const morton = (i) => {
  let code = 0n;
  const q = [0, 1, 2].map((a) => BigInt(Math.max(0, Math.min(1023, Math.round((REF[i * 3 + a] + 9) * 56)))));
  for (let b = 9n; b >= 0n; b--) for (const c of q) code = (code << 1n) | ((c >> b) & 1n);
  return code;
};
[...new Set(headFaces.flatMap((f) => f.v))].sort((a, b) => (morton(a) < morton(b) ? -1 : morton(a) > morton(b) ? 1 : a - b)).forEach(use);
const headVertexCount = order.length;
const helpers = {};
for (const g of HELPERS) {
  const faces = obj.F.filter((f) => f.group === g);
  const start = order.length;
  const verts = [];
  faces.forEach((f) => f.v.forEach((i) => { if (!remap.has(i)) verts.push(i); use(i); }));
  helpers[g] = { start, count: order.length - start, quads: faces.flatMap((f) => f.v.map((i) => remap.get(i))) };
}
const VC = order.length;

// origin: midpoint of the two eyeball centres of the reference head
const centroid = (g) => {
  const c = [0, 0, 0], h = helpers[g];
  for (let k = 0; k < h.count; k++) for (let a = 0; a < 3; a++) c[a] += REF[order[h.start + k] * 3 + a] / h.count;
  return c;
};
const eyeL = centroid('helper-l-eye'), eyeR = centroid('helper-r-eye');
const origin = [0, (eyeL[1] + eyeR[1]) / 2, (eyeL[2] + eyeR[2]) / 2];
const positions = new Float32Array(VC * 3);
order.forEach((i, k) => { for (let a = 0; a < 3; a++) positions[k * 3 + a] = REF[i * 3 + a] - origin[a]; });

// ---------------- UV layout: islands rotated upright and packed, face island first ----------------
const uvOrder = [], uvRemap = new Map();
const useUV = (t) => { if (!uvRemap.has(t)) { uvRemap.set(t, uvOrder.length); uvOrder.push(t); } return uvRemap.get(t); };
// faces in the order of their lowest (spatially sorted) vertex, so consecutive faces are neighbours
headFaces.sort((a, b) => Math.min(...a.v.map((i) => remap.get(i))) - Math.min(...b.v.map((i) => remap.get(i))));
const quadV = new Uint16Array(headFaces.length * 4), quadT = new Uint16Array(headFaces.length * 4);
headFaces.forEach((f, q) => { for (let c = 0; c < 4; c++) { quadV[q * 4 + c] = remap.get(f.v[c]); quadT[q * 4 + c] = useUV(f.t[c]); } });
const UVC = uvOrder.length;
const parent = Int32Array.from({ length: UVC }, (_, i) => i);
const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
for (let q = 0; q < headFaces.length; q++) for (let c = 1; c < 4; c++) parent[find(quadT[q * 4 + c])] = find(quadT[q * 4]);
// rotate so the top of the head points up: in the MakeHuman atlas the head lies on its side
const lEyeSide = headFaces.reduce((s, f) => {
  const x = f.v.reduce((a, i) => a + REF[i * 3], 0) / 4;
  const v = f.t.reduce((a, t) => a + obj.VT[t][1], 0) / 4;
  return s + (Math.abs(x) > 0.2 && Math.abs(x) < 0.5 ? Math.sign(x) * v : 0);
}, 0);
const flip = lEyeSide > 0 ? 1 : -1; // person's left (+x) goes to +u
const rot = uvOrder.map((t) => [flip * obj.VT[t][1], -obj.VT[t][0]]);
const islands = new Map();
rot.forEach((p, i) => {
  const r = find(i);
  if (!islands.has(r)) islands.set(r, { members: [], min: [Infinity, Infinity], max: [-Infinity, -Infinity] });
  const isl = islands.get(r);
  isl.members.push(i);
  for (let a = 0; a < 2; a++) { isl.min[a] = Math.min(isl.min[a], p[a]); isl.max[a] = Math.max(isl.max[a], p[a]); }
});
// classify islands by their 3D centroid: the eye sockets and the inside of the mouth are hidden by the
// eyeballs / closed lips, so they get a small share of the paint texture
const quadIsland = new Int32Array(headFaces.length);
const islandQuads = new Map();
headFaces.forEach((f, q) => {
  const r = find(quadT[q * 4]);
  quadIsland[q] = r;
  if (!islandQuads.has(r)) islandQuads.set(r, []);
  islandQuads.get(r).push(q);
});
const mainIsland = [...islandQuads.keys()].reduce((a, b) => (islandQuads.get(a).length >= islandQuads.get(b).length ? a : b));
for (const [r, qs] of islandQuads) {
  const c = [0, 0, 0];
  qs.forEach((q) => headFaces[q].v.forEach((i) => { for (let a = 0; a < 3; a++) c[a] += REF[i * 3 + a] / (qs.length * 4); }));
  const isl = islands.get(r);
  isl.kind = r === mainIsland ? 'skin'
    : Math.hypot(Math.abs(c[0]) - Math.abs(eyeL[0]), c[1] - eyeL[1], c[2] - eyeL[2]) < 0.25 ? 'eye-socket'
    : Math.abs(c[0]) < 0.3 && c[1] > eyeY - 0.9 && c[1] < eyeY - 0.2 && c[2] > 0.6 ? 'mouth-inside' : 'skin';
  isl.scale = isl.kind === 'skin' ? 1 : 0.35;
  if (process.env.DEBUG) console.log(isl.kind, qs.length, c.map((x) => x.toFixed(2)).join(','));
}
const list = [...islands.values()].sort((a, b) => (b.max[0] - b.min[0]) * (b.max[1] - b.min[1]) * b.scale ** 2 - (a.max[0] - a.min[0]) * (a.max[1] - a.min[1]) * a.scale ** 2);
function pack(s) { // shelf packing at scale s; returns placements or null
  let x = UV_PAD, y = UV_PAD, shelf = 0;
  const placed = [];
  for (const isl of list) {
    const w = (isl.max[0] - isl.min[0]) * s * isl.scale, h = (isl.max[1] - isl.min[1]) * s * isl.scale;
    if (x + w + UV_PAD > 1) { x = UV_PAD; y += shelf + UV_PAD; shelf = 0; }
    if (w + 2 * UV_PAD > 1 || y + h + UV_PAD > 1) return null;
    placed.push([x, y]);
    x += w + UV_PAD; shelf = Math.max(shelf, h);
  }
  return placed;
}
let scale = 4, placed = null;
while (!(placed = pack(scale))) scale *= 0.99;
const uvs = new Uint16Array(UVC * 2);
list.forEach((isl, k) => {
  for (const i of isl.members) {
    const u = placed[k][0] + (rot[i][0] - isl.min[0]) * scale * isl.scale;
    const v = placed[k][1] + (isl.max[1] - rot[i][1]) * scale * isl.scale; // v measured from the top, flipped below
    uvs[i * 2] = Math.round(u * 65535);
    uvs[i * 2 + 1] = Math.round((1 - v) * 65535);
  }
});

// ---------------- feature regions ----------------
// Per head vertex: geodesic distance (dm) over the outer skin from the line where the lips meet and from the
// lid margins (where the skin island meets the inner mouth / eye sockets), negative inside those islands,
// plus soft masks from how far the matching MakeHuman targets move each vertex.
const REGION_CHANNELS = ['lipLine', 'lidMargin', 'cheek', 'underEye', 'nose', 'ear', 'lips', 'interior'];
const vIslands = Array.from({ length: headVertexCount }, () => new Set());
headFaces.forEach((f, q) => f.v.forEach((i) => vIslands[remap.get(i)].add(islands.get(quadIsland[q]).kind)));
const adj = Array.from({ length: headVertexCount }, () => new Map());
headFaces.forEach((f, q) => {
  if (quadIsland[q] !== mainIsland) return;
  for (let c = 0; c < 4; c++) {
    const a = remap.get(f.v[c]), b = remap.get(f.v[(c + 1) & 3]);
    const d = Math.hypot(positions[a * 3] - positions[b * 3], positions[a * 3 + 1] - positions[b * 3 + 1], positions[a * 3 + 2] - positions[b * 3 + 2]);
    adj[a].set(b, d); adj[b].set(a, d);
  }
});
function geodesic(seeds) {
  const dist = new Float64Array(headVertexCount).fill(Infinity);
  const queue = seeds.map((s) => [0, s]);
  seeds.forEach((s) => (dist[s] = 0));
  while (queue.length) { // small graph: a sorted array is fast enough
    queue.sort((a, b) => b[0] - a[0]);
    const [d, v] = queue.pop();
    if (d > dist[v]) continue;
    for (const [w, l] of adj[v]) if (d + l < dist[w]) { dist[w] = d + l; queue.push([d + l, w]); }
  }
  return dist;
}
const seamOf = (kind) => [...vIslands.keys()].filter((k) => vIslands[k].has(kind) && vIslands[k].size > 1);
const lipLine = geodesic(seamOf('mouth-inside'));
const lidMargin = geodesic(seamOf('eye-socket'));
function targetMask(names) {
  const D = subsetDelta(names), m = new Float64Array(headVertexCount);
  let max = 0;
  for (let k = 0; k < headVertexCount; k++) max = Math.max(max, (m[k] = Math.hypot(D[k * 3], D[k * 3 + 1], D[k * 3 + 2])));
  return m.map((x) => x / max);
}
const masks = {
  cheek: targetMask(['cheek/l-cheek-volume-incr', 'cheek/r-cheek-volume-incr']),
  underEye: targetMask(['eyes/l-eye-bag-incr', 'eyes/r-eye-bag-incr']),
  nose: targetMask(['nose/nose-volume-incr']),
  ear: targetMask(['ears/l-ear-trans-backward', 'ears/r-ear-trans-backward']),
  lips: targetMask(['mouth/mouth-upperlip-volume-incr', 'mouth/mouth-lowerlip-volume-incr']),
};
const regions = new Float32Array(headVertexCount * REGION_CHANNELS.length);
for (let k = 0; k < headVertexCount; k++) {
  const inside = !vIslands[k].has('skin');
  const vals = {
    lipLine: inside && vIslands[k].has('mouth-inside') ? -0.05 : Math.min(lipLine[k], 9),
    lidMargin: inside && vIslands[k].has('eye-socket') ? -0.05 : Math.min(lidMargin[k], 9),
    cheek: masks.cheek[k], underEye: masks.underEye[k], nose: masks.nose[k], ear: masks.ear[k], lips: masks.lips[k],
    interior: inside ? 1 : 0,
  };
  REGION_CHANNELS.forEach((c, j) => (regions[k * REGION_CHANNELS.length + j] = vals[c]));
}

// landmarks in reference coordinates for per-pixel feature shapes (lip outline etc.)
const lipSeam = seamOf('mouth-inside').map((k) => [positions[k * 3], positions[k * 3 + 1]]);
const mouthHalfWidth = Math.max(...lipSeam.map((p) => Math.abs(p[0])));
const lineAt = (t0, t1) => { const ys = lipSeam.filter((p) => Math.abs(p[0]) / mouthHalfWidth >= t0 && Math.abs(p[0]) / mouthHalfWidth <= t1).map((p) => p[1]); return ys.reduce((a, b) => a + b, 0) / ys.length; };
const eyeRef = (g) => { const c = groupCentroid(g); return [c[0] - origin[0], c[1] - origin[1], c[2] - origin[2]]; };
const landmarks = {
  eyeL: eyeRef('helper-l-eye'), eyeR: eyeRef('helper-r-eye'),
  // vermilion outline measured from where the lip-volume targets act (see docs/HEAD-ASSET.md)
  mouth: { halfWidth: mouthHalfWidth, lineCentre: lineAt(0, 0.25), lineCorner: lineAt(0.85, 1), upperCentre: 0.062, upperPeak: 0.075, upperPeakAt: 0.3, lower: 0.122 },
};

// ---------------- shape dimensions ----------------
// sparse delta: varint-coded index gaps and int8 components with one scale per dimension side
const varint = (values) => {
  const bytes = [];
  for (let v of values) { while (v >= 0x80) { bytes.push((v & 0x7f) | 0x80); v >>>= 7; } bytes.push(v); }
  return Uint8Array.from(bytes);
};
const sparse = (delta) => { // delta: Float64Array over the subset
  let max = 0;
  for (let k = 0; k < VC * 3; k++) max = Math.max(max, Math.abs(delta[k]));
  const s = max / 127 || 1;
  const idx = [], d = [];
  for (let k = 0; k < VC; k++) {
    const q = [0, 1, 2].map((a) => Math.round(delta[k * 3 + a] / s));
    if (Math.max(...q.map(Math.abs)) * s < 1e-3 || q.every((x) => x === 0)) continue;
    idx.push(k); d.push(...q);
  }
  return { idx: varint(idx.map((k, j) => k - (j ? idx[j - 1] : -1) - 1)), count: idx.length, d: Int8Array.from(d), scale: s };
};
function subsetDelta(names) {
  const D = new Float64Array(VC * 3);
  for (const name of names) {
    if (name === 'macro:male') {
      order.forEach((i, k) => { for (let a = 0; a < 3; a++) D[k * 3 + a] += MALE[i * 3 + a] - REF[i * 3 + a]; });
      continue;
    }
    const t = target(name);
    for (let j = 0; j < t.idx.length; j++) {
      const k = remap.get(t.idx[j]);
      if (k === undefined) continue;
      for (let a = 0; a < 3; a++) D[k * 3 + a] += t.d[j * 3 + a];
    }
  }
  return D;
}
// Anchor every dimension to the skull and face: MakeHuman's macro targets (gender, neck length, head
// scale) also move the whole head, which would push faces out of the fixed camera framing.
const anchorVerts = [];
for (let k = 0; k < headVertexCount; k++) if (positions[k * 3 + 1] > -1.0) anchorVerts.push(k);
// The shift is stored per dimension and subtracted at runtime, so the deltas stay sparse.
function anchorShift(D) {
  const t = [0, 0, 0];
  for (const k of anchorVerts) for (let a = 0; a < 3; a++) t[a] += D[k * 3 + a] / anchorVerts.length;
  t[0] = 0; // keep left/right symmetry
  return t;
}
const dims = [], blobs = [], manifestDims = {};
for (const dim of DIMS) {
  const entry = { id: dim.id };
  for (const side of ['plus', 'minus']) {
    if (!dim[side].length) continue;
    const D = subsetDelta(dim[side]);
    const s = sparse(D);
    if (!s.count) throw new Error(`${dim.id}.${side}: no head vertices moved`);
    entry[side] = { count: s.count, scale: s.scale, shift: anchorShift(D).map((x) => Math.round(x * 1e6) / 1e6), blob: blobs.length };
    manifestDims[`${dim.id}.${side}`] = dim[side];
    blobs.push(s.idx, s.d);
  }
  dims.push(entry);
}

// ---------------- write ----------------
const sections = [];
// Optional predictive coding: store each value minus the one `stride` before it (wrapping in the array's
// integer width). Spatially ordered data then becomes small numbers that gzip far better.
const deltaCode = (arr, stride) => {
  const out = new arr.constructor(arr.length);
  for (let i = 0; i < arr.length; i++) out[i] = arr[i] - (i >= stride ? arr[i - stride] : 0);
  return out;
};
const addSection = (name, arr, stride = 0) => {
  sections.push({ name, type: arr.constructor.name, length: arr.length, stride, arr: stride ? deltaCode(arr, stride) : arr });
  return sections.length - 1;
};
// positions: int16 over the bounding box; regions: uint8 per channel range
const posMin = [0, 1, 2].map((a) => Math.min(...positions.filter((_, i) => i % 3 === a)));
const posMax = [0, 1, 2].map((a) => Math.max(...positions.filter((_, i) => i % 3 === a)));
const qPos = Int16Array.from(positions, (v, i) => Math.round(((v - posMin[i % 3]) / (posMax[i % 3] - posMin[i % 3])) * 65535 - 32768));
const NCH = REGION_CHANNELS.length;
const regMin = REGION_CHANNELS.map((_, c) => Math.min(...regions.filter((_, i) => i % NCH === c)));
const regMax = REGION_CHANNELS.map((_, c) => Math.max(...regions.filter((_, i) => i % NCH === c)));
// distances are only needed near the features: clamp them to 1.2 dm for finer steps
REGION_CHANNELS.forEach((c, j) => { if (c === 'lipLine' || c === 'lidMargin') regMax[j] = Math.min(regMax[j], 1.2); });
const qReg = Uint8Array.from(regions, (v, i) => Math.round((Math.min(Math.max(v, regMin[i % NCH]), regMax[i % NCH]) - regMin[i % NCH]) / (regMax[i % NCH] - regMin[i % NCH]) * 255));
addSection('positions', qPos, 3);
addSection('quadV', quadV, 1);
addSection('quadT', quadT, 1);
addSection('uvs', uvs, 2);
addSection('regions', qReg);
for (const [g, h] of Object.entries(helpers)) h.section = addSection(`${g}.quads`, Uint16Array.from(h.quads));
const blobBase = sections.length;
blobs.forEach((b, i) => addSection(`blob${i}`, b, b instanceof Int8Array ? 3 : 0));
for (const d of dims) for (const side of ['plus', 'minus']) if (d[side]) {
  d[side].idx = blobBase + d[side].blob; d[side].delta = blobBase + d[side].blob + 1; delete d[side].blob;
}

const r6 = (x) => Math.round(x * 1e6) / 1e6;
const header = {
  format: 'makeup-head', version: 2,
  source: { project: 'MakeHuman', commit: MAKEHUMAN_COMMIT, license: 'CC0-1.0', manifest: 'head.manifest.json' },
  units: 'decimetre', origin: origin.map(r6), neckCut: r6(NECK_CUT - origin[1]),
  posMin: posMin.map(r6), posMax: posMax.map(r6), regMin: regMin.map(r6), regMax: regMax.map(r6),
  vertexCount: VC, headVertexCount, quadCount: headFaces.length, uvCount: UVC,
  regionChannels: REGION_CHANNELS, landmarks,
  helpers: Object.fromEntries(Object.entries(helpers).map(([g, h]) => [g, { start: h.start, count: h.count, quads: h.section }])),
  dims, sections: [],
};
let offset = 0;
for (const s of sections) {
  offset = (offset + 3) & ~3;
  header.sections.push({ name: s.name, type: s.type, length: s.length, offset, ...(s.stride ? { stride: s.stride } : {}) });
  offset += s.arr.byteLength;
}
const json = Buffer.from(JSON.stringify(header));
const pre = 8 + ((json.length + 3) & ~3);
const out = Buffer.alloc(pre + offset);
out.write('MKHD', 0, 'ascii');
out.writeUInt32LE(json.length, 4);
json.copy(out, 8);
header.sections.forEach((s, k) => Buffer.from(sections[k].arr.buffer, sections[k].arr.byteOffset, sections[k].arr.byteLength).copy(out, pre + s.offset));
// gzip at maximum level (fixed header fields, so the bytes are reproducible); the runtime inflates it
const gz = zlib.gzipSync(out, { level: 9 });
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, gz);
const manifest = {
  asset: path.basename(OUT), sha256: crypto.createHash('sha256').update(gz).digest('hex'), uncompressedBytes: out.length,
  source: { project: 'MakeHuman', repo: MAKEHUMAN_REPO, commit: MAKEHUMAN_COMMIT, license: 'CC0-1.0',
    files: Object.fromEntries([...src.used.entries()].sort()) },
  dimensions: manifestDims,
};
fs.writeFileSync(OUT.replace(/head\.bin\.gz$/, 'head.manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
console.log(`${path.relative(process.cwd(), OUT)}: ${gz.length} bytes (${out.length} inflated), ${VC} vertices (${headVertexCount} head), ` +
  `${headFaces.length} quads, ${UVC} uvs, ${dims.length} dimensions, sha256 ${manifest.sha256}`);
