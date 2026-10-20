// Locates points on the front of the head by their reference-head (x, y) coordinates, so details defined
// once in reference coordinates (brow hairs, marks) can be attached to the surface and follow every morph.
export class SurfaceSampler {
  // refSub: reference positions of the refined vertices; subQuads: refined quads (4 indices each)
  constructor(refSub, subQuads, { minX = -0.9, maxX = 0.9, minY = -1.6, maxY = 1.3, cell = 0.05 } = {}) {
    this.ref = refSub;
    this.quads = subQuads;
    this.minX = minX; this.minY = minY; this.cell = cell;
    this.nx = Math.ceil((maxX - minX) / cell); this.ny = Math.ceil((maxY - minY) / cell);
    this.grid = Array.from({ length: this.nx * this.ny }, () => []);
    const P = refSub;
    for (let q = 0; q < subQuads.length / 4; q++) {
      const ids = [0, 1, 2, 3].map((c) => subQuads[q * 4 + c]);
      // front-facing quads only (normal pointing towards +z in the reference head)
      const [a, b, c, d] = ids.map((i) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]);
      const nz = (c[0] - a[0]) * (d[1] - b[1]) - (c[1] - a[1]) * (d[0] - b[0]);
      if (nz <= 0) continue;
      const x0 = Math.min(a[0], b[0], c[0], d[0]), x1 = Math.max(a[0], b[0], c[0], d[0]);
      const y0 = Math.min(a[1], b[1], c[1], d[1]), y1 = Math.max(a[1], b[1], c[1], d[1]);
      for (let gx = this.cx(x0); gx <= this.cx(x1); gx++) for (let gy = this.cy(y0); gy <= this.cy(y1); gy++) {
        if (gx >= 0 && gy >= 0 && gx < this.nx && gy < this.ny) this.grid[gy * this.nx + gx].push(q);
      }
    }
  }
  cx(x) { return Math.floor((x - this.minX) / this.cell); }
  cy(y) { return Math.floor((y - this.minY) / this.cell); }

  // -> { i: [3 vertex indices], w: [3 weights] } for the front-most surface point at (x, y) (or, given z, the one
  // nearest that depth), or null
  locate(x, y, z) {
    const gx = this.cx(x), gy = this.cy(y);
    if (gx < 0 || gy < 0 || gx >= this.nx || gy >= this.ny) return null;
    const P = this.ref;
    let best = null, bestZ = -Infinity;
    for (const q of this.grid[gy * this.nx + gx]) {
      const ids = [0, 1, 2, 3].map((c) => this.quads[q * 4 + c]);
      for (const tri of [[ids[0], ids[1], ids[2]], [ids[0], ids[2], ids[3]]]) {
        const [a, b, c] = tri.map((i) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]);
        const det = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
        if (Math.abs(det) < 1e-12) continue;
        const w0 = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / det;
        const w1 = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / det;
        const w2 = 1 - w0 - w1;
        if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
        const pz = w0 * a[2] + w1 * b[2] + w2 * c[2], score = z === undefined ? pz : -Math.abs(pz - z);
        if (score > bestZ) { bestZ = score; best = { i: tri, w: [w0, w1, w2] }; }
      }
    }
    return best;
  }
}

// evaluate a located point on current positions / normals (Float32Array, 3 per vertex)
export function evalPoint(hit, P, out = [0, 0, 0]) {
  out[0] = out[1] = out[2] = 0;
  for (let k = 0; k < 3; k++) {
    const i = hit.i[k] * 3, w = hit.w[k];
    out[0] += w * P[i]; out[1] += w * P[i + 1]; out[2] += w * P[i + 2];
  }
  return out;
}
