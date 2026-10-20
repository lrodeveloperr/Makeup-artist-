// Assisted touch (owner, 20 October 2026): a finger has almost no margin for error, since a tool works the moment it
// is dragged, so on a touch screen each tool works only in its own zones of the face, and a stroke stays in the zone it
// starts in. A mouse or a pen is free. The zones are drawn once on the reference head (decimetres; the eyes' centres at
// x = ±0.284, y = 0; the mouth's line at y ≈ -0.61; +z towards the camera), where every customer's makeup is stored,
// so they fit every face. They hold the points a tool's stroke passes through: its soft edge reaches a little
// further, as a real brush does.
//
//   zoneAt(tool, hit, regions, brows, mouth, guide) -> the zone at a skin hit (a string), or null outside every zone
//     of that tool. Near the lashes the liner and the pencil are guided (guide(hit): toLashes, which moves the hit onto
//     the lash line), so a line drawn roughly along the lashes follows them
//   new ZoneGlow(view): a faint light over the selected tool's zones while a finger is on the face
import * as GL from '../src/gl/mini.js';
import { BROW_SHAPES } from '../src/face/brows.js';

// a point in the reference frame and the head's feature regions there (see tools/makehuman/build-head.mjs):
// lidMargin is the distance to the eyelids' edge (negative inside the eye socket), ear and lips are masks
// ref: [x, y, z]; reg: [lipLine, lidMargin, cheek, underEye, nose, ear, lips, interior]

// the eye opening: from the inner corner (x 0.178) to the outer (x 0.40, y 0), up to 0.042 above its middle
const EYE = { inner: 0.178, outer: 0.4, mid: 0.289, half: 0.111, top: 0.042 };
const lidTop = (ax) => { const t = (ax - EYE.mid) / EYE.half; return Math.abs(t) >= 1 ? 0 : EYE.top * Math.sqrt(1 - t * t); };
// inside an ellipse centred at (cx, cy), radii (rx, ry), turned by `turn` radians (outwards and up: positive)
const ellipse = (ax, y, cx, cy, rx, ry, turn = 0) => {
  const dx = ax - cx, dy = y - cy, c = Math.cos(turn), s = Math.sin(turn);
  const u = (dx * c + dy * s) / rx, v = (-dx * s + dy * c) / ry;
  return u * u + v * v <= 1;
};

// the vermilion (the skin shader's lip outline, from the head's mouth landmarks), grown by `grow` decimetres
function onLips([x, y, z], m, grow) {
  const t = Math.abs(x) / m.halfWidth;
  if (t >= 1 || z < 0) return false;
  const dy = y - (m.lineCentre + (m.lineCorner - m.lineCentre) * t * t);
  const taper = Math.max(1 - t ** 2.2, 0) ** 0.8;
  const up = (m.upperCentre + (m.upperPeak - m.upperCentre) * Math.exp(-(((t - m.upperPeakAt) / 0.17) ** 2)) * Math.min(t / m.upperPeakAt, 1)) * taper;
  const lo = m.lower * Math.max(1 - t ** 3, 0) ** 0.9;
  return dy < up + grow && dy > -lo - grow;
}

// her brows' band (as brows.js grows them), with `margin` decimetres round it
function onBrow(ax, y, brows, margin) {
  const s = BROW_SHAPES[brows.shape] || BROW_SHAPES['soft-arch'], end = 0.49 * brows.length;
  const u = (ax - 0.115) / (end - 0.115);
  if (u < -margin / (end - 0.115) || u > 1 + margin / (end - 0.115)) return false;
  const uc = Math.min(Math.max(u, 0), 1);
  const a = uc < s.pu ? Math.sin((Math.PI / 2) * (uc / s.pu)) ** s.k1 : 1 - (1 - s.tail) * ((uc - s.pu) / (1 - s.pu)) ** s.k2;
  const h = brows.thickness * (0.06 * (1 - uc) + 0.03 * uc);
  return Math.abs(y - (0.17 + s.ph * a)) <= h / 2 + margin;
}

// along the lashes, upper and lower (within about 8 mm of them: 'lashes'; lidMargin is measured from the seam inside
// the lids, about 5 mm in from the lashes), and on out into a wing that rises from the outer corner ('wing'); or null
function onLashLine(ax, y, reg) {
  if (reg[7] > 0.5) return null;
  const w = ax - EYE.outer + 0.01; // the wing, up to 0.09 beyond the corner
  if (w > 0 && w < 0.1 && y > -0.012 + 0.25 * w && y < 0.03 + 0.9 * w) return 'wing';
  return ax >= EYE.inner - 0.02 && ax <= EYE.outer && reg[1] < 0.14 ? 'lashes' : null;
}

// The lash line on screen: moving from a point above or below the eye straight down or up towards it (or, beside a
// corner, towards its centre), the last skin before the eye is the lid's edge, where the lashes grow. The point is
// moved there, then back out onto the lid the same way: 3.2 mm on the upper lid, where a line shows just above the
// lashes (seen from the front they hide about three millimetres of lid), 1 mm on the lower (picker: the face's
// picker; eyes: its eyes). A guide for the liner and the pencil under a finger.
export function toLashes(hit, picker, eyes) {
  const m = eyes.meshes[hit.pos[0] < 0 ? 1 : 0], [cx, cy] = picker.project(m.position), [hx, hy] = picker.project(hit.pos);
  const [px] = picker.project([m.position[0] + 0.1, m.position[1], m.position[2]]), k = Math.abs(px - cx) * 10; // pixels a dm
  const out = (hy < cy ? 0.032 : 0.01) * k;
  // the distance to the eye along (dx, dy), up to `max` pixels, or 0 if no eye is met
  const edge = (dx, dy, max) => {
    let last = 0;
    for (let t = 0.5; t < max; t += 0.5) {
      const h = picker.pick(hx + dx * t, hy + dy * t);
      if (h?.kind === 'eye') return last;
      if (h?.kind === 'skin') last = t;
    }
    return 0;
  };
  let dx = 0, dy = Math.sign(cy - hy) || 1, t = edge(dx, dy, Math.abs(cy - hy));
  if (!t) { const l = Math.hypot(cx - hx, cy - hy) || 1; dx = (cx - hx) / l; dy = (cy - hy) / l; t = edge(dx, dy, l); }
  const h = t ? picker.pick(hx + dx * (t - out), hy + dy * (t - out)) : null;
  if (h?.kind === 'skin') { hit.ref = h.ref; hit.pos = h.pos; }
}

export function zoneAt(tool, hit, reg, brows, mouth, guide) {
  const [x, y, z] = hit.ref, ax = Math.abs(x), side = x < 0 ? 'r' : 'l';
  switch (tool) {
    case 'lip': return onLips(hit.ref, mouth, -0.008) ? 'lips' : null;
    case 'brush':
      // the upper lid, from the lashes up to under her brow, its shadow reaching a little past the outer corner; the
      // apple of the cheek
      if (ellipse(ax, y, 0.3, 0.05, 0.17, 0.11, 0.12) && y > lidTop(ax) - 0.004 && !onBrow(ax, y, brows, 0.012) && y < 0.2 && reg[7] < 0.5) return 'lid' + side;
      if (ellipse(ax, y, 0.44, -0.34, 0.15, 0.11, 0.4)) return 'cheek' + side;
      return null;
    case 'glow':
      // the top of the cheekbone, the bridge of the nose, under the brow's tail, the cupid's bow
      if (ellipse(ax, y, 0.45, -0.21, 0.13, 0.045, 0.3)) return 'bone' + side;
      if (ax < 0.035 && y > -0.33 && y < 0.1 && z > 0) return 'nose';
      if (ax > 0.3 && ax < 0.47 && y > 0.1 && y < 0.165) return 'arch' + side;
      if (ax < 0.07 && !onLips(hit.ref, mouth, 0) && onLips([x, y - 0.03, z], mouth, 0) && y > mouth.lineCentre) return 'bow';
      return null;
    case 'pencil':
    case 'liner': {
      if (tool === 'pencil' && onBrow(ax, y, brows, 0.02)) return 'brow' + side;
      const on = onLashLine(ax, y, reg);
      if (on === 'lashes') guide?.(hit);
      return on && 'lash' + side;
    }
    // face gems sit on the face, not on the lips, the ears or the neck
    case 'gem': return z > -0.25 && y > -0.95 && reg[5] < 0.3 && !onLips(hit.ref, mouth, 0.01) ? 'face' : null;
    default: return 'any';
  }
}

// Capture (owner, 20 October 2026: a tool must never feel forced to work). A finger that strays up to 6 mm outside
// the zone it is painting, or lands up to 6 mm outside any of its tool's zones, is not refused: the point is moved to
// the zone's edge (towards a point inside it), so the paint slides along the edge as along a stencil, and a stroke that
// starts just beside a zone starts at its edge. Further out, the pen is up. The lash line needs none: the liner and
// the pencil are guided onto it from 8 mm away.
const CAPTURE = 0.06;
// a point inside each zone to move towards, for a stray point at (ax, y) (|x|, y): its middle, or the nearest point
// of its middle line for a long, thin one
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const INSIDE = {
  lips: (ax, y, m) => { const t = Math.min(ax / m.halfWidth, 0.8); return [t * m.halfWidth, m.lineCentre + (m.lineCorner - m.lineCentre) * t * t]; },
  lid: (ax) => [clamp(ax, 0.22, 0.36), 0.085],
  cheek: () => [0.44, -0.34],
  bone: (ax, y) => { const c = Math.cos(0.3), s = Math.sin(0.3), u = clamp((ax - 0.45) * c + (y + 0.21) * s, -0.1, 0.1); return [0.45 + u * c, -0.21 + u * s]; },
  nose: (ax, y) => [0, clamp(y, -0.3, 0.07)],
  arch: (ax) => [clamp(ax, 0.32, 0.45), 0.1325],
  bow: (ax, y, m) => [Math.min(ax, 0.04), m.lineCentre + m.upperCentre + 0.012],
  brow: (ax, y, m, brows) => {
    const sh = BROW_SHAPES[brows.shape] || BROW_SHAPES['soft-arch'], end = 0.49 * brows.length, u = clamp((ax - 0.115) / (end - 0.115), 0.05, 0.95);
    const a = u < sh.pu ? Math.sin((Math.PI / 2) * (u / sh.pu)) ** sh.k1 : 1 - (1 - sh.tail) * ((u - sh.pu) / (1 - sh.pu)) ** sh.k2;
    return [0.115 + u * (end - 0.115), 0.17 + sh.ph * a];
  },
};
// the zones a tool's stroke can be captured by (with the side of the face they are on, where they come in pairs)
const CAPTURED = { lip: ['lips'], brush: ['lid', 'cheek'], glow: ['bone', 'nose', 'arch', 'bow'], pencil: ['brow'] };
const PAIRED = new Set(['lid', 'cheek', 'bone', 'arch', 'brow']);

// The zone for a finger's point: as zoneAt, in the zone `locked` once the stroke has one (null before it starts), with
// capture: hit.ref may be moved to a zone's edge. lift(x, y, z): the head's surface point at reference (x, y), nearest
// depth z. -> the zone, or null (the pen is up)
export function assist(tool, hit, reg, brows, mouth, locked, guide, lift) {
  const z = zoneAt(tool, hit, reg, brows, mouth, guide);
  if (z !== null && (locked == null || z === locked)) return z;
  const p = hit.ref, side = p[0] < 0 ? 'r' : 'l', test = { ref: [0, 0, p[2]] };
  const ids = locked != null ? [locked] : (CAPTURED[tool] || []).map((n) => (PAIRED.has(n) ? n + side : n));
  let best = null;
  for (const id of ids) {
    const name = PAIRED.has(id.slice(0, -1)) ? id.slice(0, -1) : id, inside = INSIDE[name];
    if (!inside) continue;
    const sx = PAIRED.has(name) ? (id.endsWith('r') ? -1 : 1) : Math.sign(p[0]) || 1;
    const [qx, qy] = inside(Math.abs(p[0]), p[1], mouth, brows), q = [sx * qx, qy];
    const at = (t) => { test.ref[0] = p[0] + (q[0] - p[0]) * t; test.ref[1] = p[1] + (q[1] - p[1]) * t; return zoneAt(tool, test, reg, brows, mouth) === id; };
    if (!at(1)) continue;
    let lo = 0, hi = 1; // outside at lo, inside at hi
    for (let i = 0; i < 12; i++) { const m = (lo + hi) / 2; if (at(m)) hi = m; else lo = m; }
    const d = hi * Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (d > CAPTURE || (best && d >= best.d)) continue;
    const t = Math.min(hi + 0.004 / Math.max(Math.hypot(q[0] - p[0], q[1] - p[1]), 1e-6), 1); // a little way in
    best = { d, id, x: p[0] + (q[0] - p[0]) * t, y: p[1] + (q[1] - p[1]) * t };
  }
  const r = best && lift(best.x, best.y, p[2]);
  if (!r) return null;
  hit.ref = r;
  return best.id;
}

// the feature regions at a hit (its triangle's, weighted)
export function regionsAt(geometry, at) {
  const A = geometry.attributes.regionA.array, B = geometry.attributes.regionB.array, out = [];
  for (let c = 0; c < 8; c++) {
    const R = c < 4 ? A : B, k = c % 4;
    out.push(at.u * R[at.a * 4 + k] + at.v * R[at.b * 4 + k] + at.w * R[at.c * 4 + k]);
  }
  return out;
}

// A faint light laid over the selected tool's zones while a finger is down, so a player sees where the tool works. It
// is the head's own surface drawn again, light where a zone is: at each vertex, how much of a little cross round it
// (1.2 mm each way) is in a zone, blended across the triangles, so the light's edge is soft.
const vertexShader = /* glsl */ `
attribute float zone;
varying float vZone;
void main() {
  vZone = zone;
  gl_Position = projectionMatrix * (modelViewMatrix * vec4(position, 1.0));
}`;
const fragmentShader = /* glsl */ `
uniform float uOn;
varying float vZone;
void main() { gl_FragColor = vec4(1.0, 0.95, 0.9, 0.3 * uOn * vZone); }`;

export class ZoneGlow {
  // view: FaceView
  constructor(view) {
    this.view = view;
    const g = view.headGeometry.geometry, n = g.attributes.ref.array.length / 3;
    this.zone = new GL.BufferAttribute(new Float32Array(n), 1);
    this.geometry = new GL.BufferGeometry();
    this.geometry.attributes = { ...g.attributes, zone: this.zone };
    this.geometry.index = g.index;
    this.mesh = new GL.Mesh(this.geometry, new GL.ShaderMaterial({ vertexShader, fragmentShader, uniforms: { uOn: { value: 1 } }, transparent: true, depthWrite: false }));
    this.mesh.renderOrder = -1; // under her brows, lashes and hair
    this.mesh.visible = false;
    view.scene.add(this.mesh);
    this.for = '';
  }

  // show the zones of a tool for the current face (brows: her brows, whose band the pencil follows); hide: null
  show(tool, brows, mouth) {
    const key = tool && `${tool}:${JSON.stringify(brows)}`;
    this.mesh.visible = !!tool;
    if (!tool || key === this.for) return;
    this.for = key;
    const g = this.view.headGeometry.geometry, ref = g.attributes.ref.array, A = g.attributes.regionA.array, B = g.attributes.regionB.array;
    const z = this.zone.array, reg = new Array(8), hit = { ref: [0, 0, 0] }, d = 0.012;
    for (let i = 0; i < z.length; i++) {
      for (let c = 0; c < 4; c++) { reg[c] = A[i * 4 + c]; reg[c + 4] = B[i * 4 + c]; }
      let n = 0;
      for (const [dx, dy] of [[0, 0], [d, 0], [-d, 0], [0, d], [0, -d]]) {
        hit.ref[0] = ref[i * 3] + dx; hit.ref[1] = ref[i * 3 + 1] + dy; hit.ref[2] = ref[i * 3 + 2];
        n += zoneAt(tool, hit, reg, brows, mouth) !== null;
      }
      z[i] = n / 5;
    }
    this.zone.needsUpdate = true;
  }
}
