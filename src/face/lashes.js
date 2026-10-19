// Upper and lower eyelashes rooted along the lid margins, rebuilt for every face. Each lash keeps its own parameters so mascara can change only the
// lashes a stroke touches.
import * as GL from '../gl/mini.js';
import { createRng } from './rng.js';
import { HAIR_COLOURS } from './colors.js';
import { buildStrandGeometry, createStrandMaterial } from './strands.js';

// Lash roots: MakeHuman's eyelash helper strips (fitted to the lids and moved by every eye target).
// The strip side nearest the lid, ordered from the inner to the outer corner, is the root line.
function rootChain(head, group) {
  const q = head.helpers[group].quads, P = head.positions;
  const key = (a, b) => (a < b ? a + '_' + b : b + '_' + a);
  const count = new Map(), valence = new Map(), nb = new Map();
  for (let i = 0; i < q.length; i += 4) for (let c = 0; c < 4; c++) {
    const a = q[i + c], b = q[i + ((c + 1) & 3)];
    count.set(key(a, b), (count.get(key(a, b)) || 0) + 1);
    valence.set(a, (valence.get(a) || 0) + 1);
  }
  for (const [k, n] of count) {
    if (n !== 1) continue;
    const [a, b] = k.split('_').map(Number);
    if (!nb.has(a)) nb.set(a, []);
    if (!nb.has(b)) nb.set(b, []);
    nb.get(a).push(b); nb.get(b).push(a);
  }
  const corners = [...valence].filter(([, n]) => n === 1).map(([v]) => v);
  // walk the boundary from each corner to the next corner
  const chains = [];
  for (const c of corners) for (const first of nb.get(c)) {
    const chain = [c, first];
    while (!corners.includes(chain[chain.length - 1])) {
      const cur = chain[chain.length - 1], prev = chain[chain.length - 2];
      chain.push(nb.get(cur).find((x) => x !== prev));
    }
    chains.push(chain);
  }
  const avgZ = (ch) => ch.reduce((s, v) => s + P[v * 3 + 2], 0) / ch.length;
  const long = chains.sort((a, b) => b.length - a.length).slice(0, 4); // each long side appears twice (both directions)
  const root = long.sort((a, b) => avgZ(a) - avgZ(b))[0].slice();
  return Math.abs(P[root[0] * 3]) < Math.abs(P[root[root.length - 1] * 3]) ? root : root.reverse();
}
export function lidMargins(head) {
  return {
    left: { upper: rootChain(head, 'helper-l-eyelashes-2'), lower: rootChain(head, 'helper-l-eyelashes-1') },
    right: { upper: rootChain(head, 'helper-r-eyelashes-2'), lower: rootChain(head, 'helper-r-eyelashes-1') },
  };
}

// point and tangent at arc-length fraction s along a vertex polyline of current positions
function along(ids, P, s) {
  const pts = ids.map((k) => [P[k * 3], P[k * 3 + 1], P[k * 3 + 2]]);
  const seg = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]); seg.push(l); total += l; }
  let d = s * total, i = 0;
  while (i < seg.length - 1 && d > seg[i]) { d -= seg[i]; i++; }
  const f = Math.min(d / (seg[i] || 1), 1);
  const a = pts[i], b = pts[i + 1];
  return { p: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f] };
}

const CLUMPS = 22; // clumps along each upper lid

// does any point of a lash lie within `reach` of the wand's path (x, y pairs) in the screen plane?
function nearPath(pts, wand, reach) {
  const r2 = reach * reach;
  for (const p of pts) {
    if (wand.length === 2) { if ((p[0] - wand[0]) ** 2 + (p[1] - wand[1]) ** 2 <= r2) return true; continue; }
    for (let k = 0; k + 3 < wand.length; k += 2) {
      const ax = wand[k], ay = wand[k + 1], bx = wand[k + 2], by = wand[k + 3];
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      const t = l2 > 0 ? Math.min(Math.max(((p[0] - ax) * dx + (p[1] - ay) * dy) / l2, 0), 1) : 0;
      if ((p[0] - ax - dx * t) ** 2 + (p[1] - ay - dy * t) ** 2 <= r2) return true;
    }
  }
  return false;
}

export class Lashes {
  constructor(head) {
    this.margins = lidMargins(head);
    this.material = createStrandMaterial({ opacity: 1, spec: 0.02 });
    this.mesh = new GL.Mesh(new GL.BufferGeometry(), this.material);
    this.mesh.renderOrder = 3;
    this.lashes = []; // per-lash parameters (eye, row, s, length, width, colour)
  }

  // lashes: face.lashes; hg: HeadGeometry; eyeCentres: { left: Vector3, right: Vector3 }
  build(lashes, hg, eyeCentres) {
    const rng = createRng(lashes.seed);
    const colour = HAIR_COLOURS[lashes.colour] || HAIR_COLOURS['jet-black'];
    this.lashes = [];
    for (const eye of ['left', 'right']) {
      for (const [row, n] of [['upper', Math.round(70 * lashes.density)], ['lower', Math.round(24 * lashes.density)]]) {
        const r = rng.fork((eye === 'left' ? 1 : 2) * 10 + (row === 'upper' ? 1 : 2));
        for (let i = 0; i < n; i++) {
          const s = row === 'upper' ? 0.04 + 0.94 * Math.sqrt(r.next()) : 0.25 + 0.65 * r.next();
          // upper lashes gather into small clumps whose tips meet, as real lashes do
          const clump = row === 'upper' ? (Math.floor(s * CLUMPS) + 0.5) / CLUMPS : s;
          const tint = (0.85 + 0.3 * r.next()) * (row === 'upper' ? 1 : 1.6); // lower lashes are finer and lighter
          this.lashes.push({ eye, row, s, clump, jitter: r.gauss(1), lengthMul: 0.85 + 0.3 * r.next(), widthMul: 1, colour: colour.map((c) => c * tint) });
        }
      }
    }
    this.params = lashes;
    // natural state, restored before replaying mascara
    this.natural = this.lashes.map((l) => ({ colour: l.colour.slice(), lengthMul: l.lengthMul, widthMul: l.widthMul }));
    this.update(hg, eyeCentres);
  }

  // back to the natural lashes (before replaying saved mascara strokes)
  resetCoats() {
    this.lashes.forEach((l, i) => { const n = this.natural[i]; l.colour = n.colour.slice(); l.lengthMul = n.lengthMul; l.widthMul = n.widthMul; });
    this.update(this.hg, this.eyeCentres);
  }

  // Mascara (contract §2: only the lashes actually touched change; each side independent). wand: points
  // [x0, y0, x1, y1, ...] in the face's screen plane (z = this.zPlane); colour: linear RGB; t: TOOLS.mascara;
  // touched: the lashes this stroke has already coated (each lash takes one coat per stroke). Returns true if
  // any lash changed.
  coat(wand, colour, t, touched) {
    let changed = false;
    this.paths.forEach((pts, i) => {
      if (touched.has(i) || !nearPath(pts, wand, t.reach)) return;
      touched.add(i);
      const l = this.lashes[i], n = this.natural[i];
      for (let a = 0; a < 3; a++) l.colour[a] += (colour[a] - l.colour[a]) * t.coat;
      l.lengthMul = Math.min(l.lengthMul + t.length, n.lengthMul * t.lengthMax);
      l.widthMul = Math.min(l.widthMul + t.width, t.widthMax);
      changed = true;
    });
    if (changed) this.update(this.hg, this.eyeCentres);
    return changed;
  }

  update(hg, eyeCentres) {
    this.hg = hg; this.eyeCentres = eyeCentres;
    const P = hg.base, strands = []; // helper vertices are only in the (unrefined) morphed base positions
    this.paths = [];
    let zSum = 0;
    for (const lash of this.lashes) {
      const pts = this.path(lash, lash.s, P, eyeCentres, lash.lengthMul, lash.jitter);
      if (lash.clump !== lash.s) {
        // pull the outer part of the lash towards the clump's centre lash
        const c = this.path(lash, lash.clump, P, eyeCentres, 1, 0);
        pts.forEach((p, k) => { const w = 0.8 * (k / (pts.length - 1)) ** 2; for (let a = 0; a < 3; a++) p[a] += (c[k][a] - p[a]) * w; });
      }
      const upper = lash.row === 'upper';
      const w = (upper ? 0.0022 : 0.001) * lash.widthMul;
      strands.push({ points: pts, widths: [w, w * 0.95, w * 0.85, w * 0.65, w * 0.42, w * 0.2], up: [0, 0, 1], side: pts.side, color: lash.colour });
      this.paths.push(pts);
      zSum += pts[0][2];
    }
    // the plane the mascara wand works in (the lashes' roots)
    this.zPlane = zSum / Math.max(this.lashes.length, 1);
    buildStrandGeometry(strands, this.mesh.geometry);
  }

  // the points of one lash rooted at fraction s along its lid margin
  path(lash, s, P, eyeCentres, lengthMul, jitter) {
    const { length, curl } = this.params;
    const m = this.margins[lash.eye];
    const c = eyeCentres[lash.eye];
    const root = along(lash.row === 'upper' ? m.upper : m.lower, P, s).p;
    let out = [root[0] - c.x, root[1] - c.y, 0];
    const ol = Math.hypot(out[0], out[1]) || 1; out = [out[0] / ol, out[1] / ol, 0];
    const upper = lash.row === 'upper';
    // longest towards the outer third of the upper lid, short at the inner corner
    const profile = upper ? 0.5 + 0.5 * Math.sin(Math.PI * Math.min(0.15 + 0.95 * s, 1)) : 0.6 + 0.4 * Math.sin(Math.PI * s);
    const L = (upper ? 0.08 : 0.026) * length * profile * lengthMul;
    const up = [0, upper ? 1 : -1, 0];
    // splay outward a little more towards the outer corner
    const outW = upper ? 0.35 + 0.8 * s : 0.35;
    // lashes leave the lid margin forwards (slightly down for the upper row), then curl
    const d0 = [out[0] * outW, out[1] * outW * 0.5 - up[1] * (upper ? 0.12 : -0.35), 1 + 0.05 * jitter];
    const dl = Math.hypot(...d0); d0[0] /= dl; d0[1] /= dl; d0[2] /= dl;
    const rise = (upper ? 0.6 + curl : 0.3) * 1.1;
    // the curl lifts the lash away from the eye: straight up mid-lid, fanning outwards towards the corners
    const lift = [out[0] * 0.55, up[1] * 0.6 + out[1] * 0.4, 0];
    const pts = [];
    const base = [root[0], root[1], root[2] + 0.012]; // the helper strip sits just inside the lid
    for (let k = 0; k <= 5; k++) {
      const t = k / 5;
      pts.push([
        base[0] + L * (d0[0] * t + lift[0] * rise * t * t),
        base[1] + L * (d0[1] * t + lift[1] * rise * t * t),
        base[2] + L * (d0[2] * t - 0.45 * rise * t * t),
      ]);
    }
    pts.side = [-out[1], out[0], 0]; // along the lid
    return pts;
  }

}
