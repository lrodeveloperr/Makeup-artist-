// The paintable head surface: morph -> subdivide -> normals, written into one BufferGeometry whose
// topology and UV layout never change between faces.
import * as GL from '../gl/mini.js';
import { morph } from './head-data.js';
import { buildSubdivision, quadNormals } from './subdivide.js';

export class HeadGeometry {
  constructor(head) {
    this.head = head;
    const V = head.headVertexCount;
    this.sub = buildSubdivision(head.quadV, head.quadT, head.uvs, V);
    const { renderCount, renderUV, index } = this.sub;
    this.base = new Float32Array(head.positions.length);
    this.subPos = new Float32Array(this.sub.subCount * 3);
    this.subNrm = new Float32Array(this.sub.subCount * 3);
    this.baseNrm = new Float32Array(V * 3);
    this.cavity = new Float32Array(V);
    this.smooth = new Float32Array(V * 3);
    this.smoothTmp = new Float32Array(V * 3);
    this.valence = new Float32Array(V);
    const ev = this.sub.edges;
    for (let e = 0; e < ev.length; e++) this.valence[ev[e]]++;
    const g = (this.geometry = new GL.BufferGeometry());
    g.setIndex(new GL.BufferAttribute(index, 1));
    g.setAttribute('position', new GL.BufferAttribute(new Float32Array(renderCount * 3), 3));
    g.setAttribute('normal', new GL.BufferAttribute(new Float32Array(renderCount * 3), 3));
    g.setAttribute('uv', new GL.BufferAttribute(renderUV, 2));
    g.setAttribute('cavity', new GL.BufferAttribute(new Float32Array(renderCount), 1));
    // reference-head position of every render vertex: a stable coordinate frame for procedural detail
    this.refSub = this.sub.refine(head.positions);
    g.setAttribute('ref', new GL.BufferAttribute(this.gather(this.refSub, 3), 3));
    // feature regions (see build-head.mjs): two vec4 attributes
    const nc = head.regionChannels.length;
    this.subRegions = this.sub.refine(head.regions, null, nc);
    this.regionIndex = Object.fromEntries(head.regionChannels.map((c, i) => [c, i]));
    const reg = this.gather(this.subRegions, nc);
    const A = new Float32Array(renderCount * 4), B = new Float32Array(renderCount * 4);
    for (let i = 0; i < renderCount; i++) for (let a = 0; a < 4; a++) { A[i * 4 + a] = reg[i * nc + a]; B[i * 4 + a] = reg[i * nc + 4 + a]; }
    g.setAttribute('regionA', new GL.BufferAttribute(A, 4));
    g.setAttribute('regionB', new GL.BufferAttribute(B, 4));
  }

  // copy a per-sub-vertex field (n components) to the render vertices
  gather(src, n, out = new Float32Array(this.sub.renderCount * n)) {
    const rp = this.sub.renderPos;
    for (let i = 0; i < rp.length; i++) for (let a = 0; a < n; a++) out[i * n + a] = src[rp[i] * n + a];
    return out;
  }

  // shape: { dimensionId: value in [-1, 1] }
  setShape(shape) {
    morph(this.head, shape, this.base);
    this.smoothNoseSides();
    this.sub.refine(this.base, this.subPos);
    quadNormals(this.subPos, this.sub.subQuads, this.sub.subCount, this.subNrm);
    this.updateCavity();
    const g = this.geometry;
    this.gather(this.subPos, 3, g.attributes.position.array);
    this.gather(this.subNrm, 3, g.attributes.normal.array);
    this.gather(this.sub.refine(this.cavity, null, 1), 1, g.attributes.cavity.array);
    for (const a of ['position', 'normal', 'cavity']) g.attributes[a].needsUpdate = true;
    return this.base;
  }

  // Where the nose's shape targets fade out, down each side of the nose from the inner corner of the eye, the blend
  // can leave a stray crease that shows as a fine vertical line (owner, 20 October 2026). Only in that strip the
  // shape's change from the base head is smoothed; the nose itself, the cheeks and the rest of the face keep their
  // shape exactly.
  smoothNoseSides() {
    const V = this.head.headVertexCount, ev = this.sub.edges, P = this.base, P0 = this.head.positions;
    if (!this.noseSide) {
      const R = this.head.regions, nc = this.head.regionChannels.length, lid = this.regionIndex.lidMargin, interior = this.regionIndex.interior;
      const ss = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
      // the strip down each side of the nose on the base head (dm; eyes at y = 0): beside the bridge, from the inner
      // corner of the eye to just above the nostril, on the front of the face, clear of the lids
      this.noseSide = new Float32Array(V);
      for (let v = 0; v < V; v++) {
        const x = Math.abs(P0[v * 3]), y = P0[v * 3 + 1], z = P0[v * 3 + 2];
        this.noseSide[v] = ss(0.05, 0.09, x) * (1 - ss(0.24, 0.3, x)) * ss(-0.4, -0.32, y) * (1 - ss(0.0, 0.06, y)) * ss(0.0, 0.1, z)
          * ss(0.02, 0.05, R[v * nc + lid]) * (1 - R[v * nc + interior]);
      }
      this.delta = new Float32Array(V * 3); this.deltaTmp = new Float32Array(V * 3);
    }
    let D = this.delta, T = this.deltaTmp;
    for (let i = 0; i < V * 3; i++) D[i] = P[i] - P0[i];
    for (let it = 0; it < 6; it++) {
      T.fill(0);
      for (let e = 0; e < ev.length; e += 2) {
        const a = ev[e] * 3, b = ev[e + 1] * 3;
        for (let k = 0; k < 3; k++) { T[a + k] += D[b + k]; T[b + k] += D[a + k]; }
      }
      for (let v = 0; v < V; v++) for (let k = 0; k < 3; k++) T[v * 3 + k] = 0.5 * D[v * 3 + k] + 0.5 * T[v * 3 + k] / this.valence[v];
      [D, T] = [T, D];
    }
    for (let v = 0; v < V; v++) {
      const w = this.noseSide[v];
      if (w > 0) for (let k = 0; k < 3; k++) P[v * 3 + k] += (P0[v * 3 + k] + D[v * 3 + k] - P[v * 3 + k]) * w;
    }
  }

  // How far each vertex sits below its smoothed neighbourhood: a cheap, shape-aware stand-in for
  // ambient occlusion in creases (eye sockets, nostrils, mouth corners, ears).
  updateCavity() {
    const V = this.head.headVertexCount, ev = this.sub.edges;
    quadNormals(this.base, this.head.quadV, V, this.baseNrm);
    let S = this.smooth, T = this.smoothTmp;
    S.set(this.base.subarray(0, V * 3));
    for (let it = 0; it < 6; it++) {
      T.fill(0);
      for (let e = 0; e < ev.length; e += 2) {
        const a = ev[e] * 3, b = ev[e + 1] * 3;
        for (let k = 0; k < 3; k++) { T[a + k] += S[b + k]; T[b + k] += S[a + k]; }
      }
      for (let v = 0; v < V; v++) for (let k = 0; k < 3; k++) T[v * 3 + k] = 0.5 * S[v * 3 + k] + 0.5 * T[v * 3 + k] / this.valence[v];
      [S, T] = [T, S];
    }
    const P = this.base, N = this.baseNrm;
    for (let v = 0; v < V; v++) {
      const d = (S[v * 3] - P[v * 3]) * N[v * 3] + (S[v * 3 + 1] - P[v * 3 + 1]) * N[v * 3 + 1] + (S[v * 3 + 2] - P[v * 3 + 2]) * N[v * 3 + 2];
      this.cavity[v] = d; // positive: vertex lies in a hollow
    }
  }

  // centroid and mean radius of a helper vertex group in the current (morphed) base positions
  helperSphere(name) {
    const h = this.head.helpers[name], P = this.base;
    const c = new GL.Vector3();
    for (let k = 0; k < h.count; k++) c.x += P[(h.start + k) * 3], c.y += P[(h.start + k) * 3 + 1], c.z += P[(h.start + k) * 3 + 2];
    c.multiplyScalar(1 / h.count);
    let r = 0;
    for (let k = 0; k < h.count; k++) r += Math.hypot(P[(h.start + k) * 3] - c.x, P[(h.start + k) * 3 + 1] - c.y, P[(h.start + k) * 3 + 2] - c.z);
    return { center: c, radius: r / h.count };
  }
}
