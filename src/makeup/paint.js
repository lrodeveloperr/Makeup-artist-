// Painted makeup on the skin. Dabs are drawn into three textures laid out like the head's UV map:
//   colour  the pigment layer (lipstick, blush, pencil, liner, highlighter): premultiplied colour (uPaint)
//   coat    the gloss coat over it: its tint, premultiplied (rgb), and how much of the lips it covers (a: its shine)
//   finish  r: how strongly the coat tints what is under it; g: the pigment's shimmer; b: highlighter glow;
//           a: the coat's glitter (uFinish)
// A gloss is a clear, lightly tinted film: it only ever draws into the coat (and the coat's channels of finish), and
// lipstick only into the pigment layer, and the skin shader always lays the coat over the pigment. So gloss then
// lipstick looks exactly like lipstick then gloss (the lipstick's colour under the gloss's shine and tint), as on
// real lips. Each dab is rendered by drawing the head in texture space and measuring every texel's distance to the
// dab in the reference-head frame, so a dab is round on the face and continues across UV seams. Within a layer each
// new dab is laid "over" what is there, so the order of lipsticks (or of glosses) matters, and repeated passes build
// towards the full colour without exceeding it.
import * as GL from '../gl/mini.js';
import { TOOLS, FALLOFF_GLSL, walkerFor, dabRate } from './tools.js';
import { colourById } from './palette.js';
import { fromQ } from './makeup.js';
import { hexToLinear } from '../face/colors.js';

const BATCH = 32; // dabs per draw

const vertexShader = /* glsl */ `
attribute vec3 ref;
varying vec3 vRef;
void main() {
  vRef = ref;
  gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
}`;

const fragmentShader = /* glsl */ `
${FALLOFF_GLSL}
uniform vec4 uDabs[${BATCH}];  // xyz: centre; w: size (a factor of the radius)
uniform int uCount;
uniform float uRadius, uEdge, uRate;
uniform vec4 uOut;            // what a full dab lays (rgb; a: how much it covers), each scaled by the dab's coverage
varying vec3 vRef;
void main() {
  // the dabs of one batch share a colour, so their combined coverage does not depend on their order
  float keep = 1.0;
  for (int i = 0; i < ${BATCH}; i++) {
    if (i >= uCount) break;
    keep *= 1.0 - uRate * dabFalloff(uEdge, distance(vRef, uDabs[i].xyz) / (uRadius * uDabs[i].w));
  }
  float a = 1.0 - keep;
  if (a <= 0.0) discard;
  gl_FragColor = uOut * a;
}`;

// Where a batch of dabs can paint. A dab only changes texels within its radius on the face, so a draw covers just the
// head's triangles near the batch, clipped (scissored) to their texels, instead of the whole head filling both whole
// textures: the triangles are kept in a grid by their reference-head bounds, and every texel a dab reaches lies in a
// triangle whose bounds meet the dab's, so the small draw paints exactly what the whole one would.
class Reach {
  constructor(geometry, size, cell = 0.1) {
    const ref = geometry.attributes.ref.array, uv = geometry.attributes.uv.array, idx = geometry.index.array;
    const n = idx.length / 3, lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < ref.length; i += 3) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], ref[i + a]); hi[a] = Math.max(hi[a], ref[i + a]); }
    const dims = [0, 1, 2].map((a) => Math.floor((hi[a] - lo[a]) / cell) + 1);
    Object.assign(this, { size, cell, lo, dims, n });
    // each triangle's reference-head bounds (min xyz, max xyz) and UV bounds (min uv, max uv)
    this.box = new Float32Array(n * 6); this.uv = new Float32Array(n * 4);
    for (let t = 0; t < n; t++) {
      const b = this.box, u = this.uv;
      for (let a = 0; a < 3; a++) { b[t * 6 + a] = Infinity; b[t * 6 + 3 + a] = -Infinity; }
      u[t * 4] = u[t * 4 + 1] = Infinity; u[t * 4 + 2] = u[t * 4 + 3] = -Infinity;
      for (let c = 0; c < 3; c++) {
        const v = idx[t * 3 + c];
        for (let a = 0; a < 3; a++) { b[t * 6 + a] = Math.min(b[t * 6 + a], ref[v * 3 + a]); b[t * 6 + 3 + a] = Math.max(b[t * 6 + 3 + a], ref[v * 3 + a]); }
        for (let a = 0; a < 2; a++) { u[t * 4 + a] = Math.min(u[t * 4 + a], uv[v * 2 + a]); u[t * 4 + 2 + a] = Math.max(u[t * 4 + 2 + a], uv[v * 2 + a]); }
      }
    }
    // the grid: the triangles in each cell their bounds touch (a cell's list is items[start[c]] .. items[start[c + 1]])
    const cells = dims[0] * dims[1] * dims[2], count = new Int32Array(cells + 1);
    const each = (t, f) => {
      const [x0, y0, z0] = [0, 1, 2].map((a) => this.at(this.box[t * 6 + a], a)), [x1, y1, z1] = [0, 1, 2].map((a) => this.at(this.box[t * 6 + 3 + a], a));
      for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) f((z * dims[1] + y) * dims[0] + x);
    };
    for (let t = 0; t < n; t++) each(t, (c) => count[c + 1]++);
    for (let c = 0; c < cells; c++) count[c + 1] += count[c];
    this.start = count.slice(); this.items = new Int32Array(count[cells]);
    const fill = count.slice(0, cells);
    for (let t = 0; t < n; t++) each(t, (c) => { this.items[fill[c]++] = t; });
    this.mark = new Uint32Array(n); this.stamp = 0;
    this.index = idx; this.near = new Uint32Array(n * 3); this.count = 0; // the triangles found (their 3 indices each)
  }

  at(v, a) { return Math.min(this.dims[a] - 1, Math.max(0, Math.floor((v - this.lo[a]) / this.cell))); }

  // dabs: [x, y, z, size] in the reference-head frame (size: a factor of the radius), count: how many, radius: the
  // tool's;
  // -> the texels [x, y, width, height] they can paint, or null if they touch no part of the head; the triangles they
  // can paint are near[0 .. count]
  rect(dabs, count, radius) {
    const s = ++this.stamp, { box, uv, items, start, dims, index, near } = this;
    this.count = 0;
    let u0 = Infinity, v0 = Infinity, u1 = -Infinity, v1 = -Infinity;
    for (let i = 0; i < count; i++) {
      const d = dabs[i], p = [d[0], d[1], d[2]], r = radius * d[3];
      const lo = p.map((v, a) => this.at(v - r, a)), hi = p.map((v, a) => this.at(v + r, a));
      for (let z = lo[2]; z <= hi[2]; z++) for (let y = lo[1]; y <= hi[1]; y++) for (let x = lo[0]; x <= hi[0]; x++) {
        const c = (z * dims[1] + y) * dims[0] + x;
        for (let k = start[c]; k < start[c + 1]; k++) {
          const t = items[k];
          if (this.mark[t] === s) continue;
          let meets = true;
          for (let a = 0; a < 3 && meets; a++) meets = box[t * 6 + a] <= p[a] + r && box[t * 6 + 3 + a] >= p[a] - r;
          if (!meets) continue;
          this.mark[t] = s;
          near[this.count++] = index[t * 3]; near[this.count++] = index[t * 3 + 1]; near[this.count++] = index[t * 3 + 2];
          u0 = Math.min(u0, uv[t * 4]); v0 = Math.min(v0, uv[t * 4 + 1]); u1 = Math.max(u1, uv[t * 4 + 2]); v1 = Math.max(v1, uv[t * 4 + 3]);
        }
      }
    }
    if (u0 > u1) return null;
    const N = this.size, px = (v) => Math.min(N, Math.max(0, v));
    const x0 = px(Math.floor(u0 * N) - 1), y0 = px(Math.floor(v0 * N) - 1), x1 = px(Math.ceil(u1 * N) + 1), y1 = px(Math.ceil(v1 * N) + 1);
    return x1 > x0 && y1 > y0 ? [x0, y0, x1 - x0, y1 - y0] : null;
  }
}

export class PaintLayer {
  constructor(renderer, headGeometry, size = 1024) {
    this.renderer = renderer;
    // half-float where the device can render to it, so many light dabs build up smoothly and replaying a saved
    // stroke in bigger batches gives the same result as painting it live (8-bit rounds every draw)
    this.colour = new GL.RenderTarget(size, size, { float: true });
    this.finish = new GL.RenderTarget(size, size, { float: true });
    this.coat = new GL.RenderTarget(size, size, { float: true });
    this.dabs = Array.from({ length: BATCH }, () => new GL.Vector4());
    this.material = new GL.ShaderMaterial({
      vertexShader, fragmentShader,
      uniforms: {
        uDabs: { value: this.dabs }, uCount: { value: 0 },
        uRadius: { value: 1 }, uEdge: { value: 0 }, uRate: { value: 0 }, uOut: { value: new GL.Vector4() },
      },
    });
    this.reach = new Reach(headGeometry.geometry, size);
    // the head's vertices (shared, not copied) with only the triangles near the batch being drawn
    const near = new GL.BufferGeometry();
    near.attributes = headGeometry.geometry.attributes;
    near.setIndex(new GL.BufferAttribute(this.reach.near.subarray(0, 0), 1));
    this.mesh = new GL.Mesh(near, this.material);
    this.clear();
  }

  clear() {
    this.renderer.drawToTarget(this.colour, null, { clear: true });
    this.renderer.drawToTarget(this.finish, null, { clear: true });
    this.renderer.drawToTarget(this.coat, null, { clear: true });
  }

  // dabs: [[x, y, z, size?], ...] in the reference-head frame, all with one tool and colour
  draw(tool, colourId, dabs) {
    if (!dabs.length) return;
    const t = TOOLS[tool], col = colourById(colourId), u = this.material.uniforms, rgb = hexToLinear(col.hex);
    // the passes each batch draws: [target, rate, what a full dab lays, channels written]
    const passes = col.gloss
      // a gloss: its tint, up to how strongly it tints (`tint`), and its shine over the lips it covers; how strongly
      // the coat tints; its glitter (taken together with the glitter already there, so a later clear gloss keeps it)
      ? [[this.coat, dabRate(tool), [...rgb.map((c) => c * col.tint), 1], null],
        [this.finish, dabRate(tool), [col.tint, 0, 0, 1], [true, false, false, false]],
        [this.finish, dabRate(tool) * (col.shimmer || 0), [0, 0, 0, 1], [false, false, false, true]]]
      // a pigment: its colour (a sheer one, like highlighter, builds slowly), and its shimmer and glow, which build
      // like a full one
      : [[this.colour, dabRate(tool, col.sheer ?? 1), [...rgb, 1], null],
        [this.finish, dabRate(tool), [0, col.shimmer || 0, col.glow || 0, 1], [false, true, true, false]]];
    u.uRadius.value = t.radius; u.uEdge.value = t.edge;
    for (let i = 0; i < dabs.length; i += BATCH) {
      const n = Math.min(BATCH, dabs.length - i);
      for (let k = 0; k < n; k++) this.dabs[k].set(dabs[i + k][0], dabs[i + k][1], dabs[i + k][2], dabs[i + k][3] ?? 1);
      const scissor = this.reach.rect(this.dabs, n, t.radius);
      if (!scissor) continue; // off the head: nothing to paint
      const index = this.mesh.geometry.index;
      index.array = this.reach.near.subarray(0, this.reach.count); index.needsUpdate = true;
      u.uCount.value = n;
      for (const [target, rate, lay, mask] of passes) {
        u.uRate.value = rate; u.uOut.value.set(...lay);
        this.renderer.drawToTarget(target, this.mesh, { scissor, mask });
      }
    }
  }
}

// Feeds a skin stroke's saved points through a DabWalker and draws the dabs. Live painting and replay both use
// it, so they produce the same dabs.
export class StrokePainter {
  constructor(layer, tool, colour) { Object.assign(this, { layer, tool, colour }); this.walker = walkerFor(tool); }
  // q: integer point [x, y, z] (see makeup.js); true if anything was drawn
  add(q) { return this.draw(this.walker.add([fromQ(q[0]), fromQ(q[1]), fromQ(q[2])])); }
  // the end of a segment (the liner draws its tip now)
  lift() { return this.draw(this.walker.lift()); }
  draw(dabs) { this.layer.draw(this.tool, this.colour, dabs); return dabs.length > 0; }
  // a whole saved stroke at once (dabs drawn in batches)
  static replay(layer, stroke) {
    const walker = walkerFor(stroke.tool), dabs = [];
    for (const seg of stroke.segments) {
      for (let i = 0; i < seg.length; i += 3) dabs.push(...walker.add([fromQ(seg[i]), fromQ(seg[i + 1]), fromQ(seg[i + 2])]));
      dabs.push(...walker.lift());
    }
    layer.draw(stroke.tool, stroke.colour, dabs);
  }
}
