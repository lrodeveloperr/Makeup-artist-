// One level of Catmull-Clark subdivision for the head's quad mesh, with face-varying UVs.
// The topology is built once; positions are refined every time a new face is morphed.
export function buildSubdivision(quadV, quadT, uvs, vertexCount) {
  const F = quadV.length / 4;
  const edgeId = new Map();
  const ev = [], ef = [];
  const key = (a, b) => (a < b ? a * 65536 + b : b * 65536 + a);
  const quadE = new Int32Array(F * 4);
  for (let f = 0; f < F; f++) {
    for (let c = 0; c < 4; c++) {
      const a = quadV[f * 4 + c], b = quadV[f * 4 + ((c + 1) & 3)];
      const k = key(a, b);
      let e = edgeId.get(k);
      if (e === undefined) { e = ev.length / 2; edgeId.set(k, e); ev.push(a, b); ef.push(f, -1); }
      else ef[e * 2 + 1] = f;
      quadE[f * 4 + c] = e;
    }
  }
  const E = ev.length / 2;
  // per-vertex adjacency (faces and edges), and boundary neighbours
  const vFaces = Array.from({ length: vertexCount }, () => []);
  const vEdges = Array.from({ length: vertexCount }, () => []);
  for (let f = 0; f < F; f++) for (let c = 0; c < 4; c++) vFaces[quadV[f * 4 + c]].push(f);
  for (let e = 0; e < E; e++) { vEdges[ev[e * 2]].push(e); vEdges[ev[e * 2 + 1]].push(e); }
  const boundaryNb = new Int32Array(vertexCount * 2).fill(-1);
  for (let e = 0; e < E; e++) {
    if (ef[e * 2 + 1] !== -1) continue;
    for (const [v, o] of [[ev[e * 2], ev[e * 2 + 1]], [ev[e * 2 + 1], ev[e * 2]]]) {
      if (boundaryNb[v * 2] === -1) boundaryNb[v * 2] = o; else boundaryNb[v * 2 + 1] = o;
    }
  }
  const subCount = vertexCount + E + F;

  // render vertices: unique (sub position, uv) pairs
  const rvPos = [], rvUV = [], rvKey = new Map();
  const uvOf = (t) => [uvs[t * 2] / 65535, uvs[t * 2 + 1] / 65535];
  const rv = (pos, k, uv) => {
    const kk = pos + ':' + k;
    let i = rvKey.get(kk);
    if (i === undefined) { i = rvPos.length; rvKey.set(kk, i); rvPos.push(pos); rvUV.push(uv[0], uv[1]); }
    return i;
  };
  const index = new Uint32Array(F * 4 * 6);
  const subQuads = new Uint32Array(F * 16); // sub-position indices of each refined quad (for adjacency)
  let n = 0;
  for (let f = 0; f < F; f++) {
    const t = [0, 1, 2, 3].map((c) => quadT[f * 4 + c]);
    const uv = t.map(uvOf);
    const fp = vertexCount + E + f;
    const fuv = [(uv[0][0] + uv[1][0] + uv[2][0] + uv[3][0]) / 4, (uv[0][1] + uv[1][1] + uv[2][1] + uv[3][1]) / 4];
    const corner = (c) => rv(quadV[f * 4 + c], 't' + t[c], uv[c]);
    const edge = (c) => {
      const c2 = (c + 1) & 3, a = t[c], b = t[c2];
      return rv(vertexCount + quadE[f * 4 + c], 'e' + Math.min(a, b) + '_' + Math.max(a, b),
        [(uv[c][0] + uv[c2][0]) / 2, (uv[c][1] + uv[c2][1]) / 2]);
    };
    const face = rv(fp, 'f', fuv);
    for (let c = 0; c < 4; c++) {
      const q = [corner(c), edge(c), face, edge((c + 3) & 3)];
      index.set([q[0], q[1], q[2], q[0], q[2], q[3]], n);
      n += 6;
      const s = [quadV[f * 4 + c], vertexCount + quadE[f * 4 + c], fp, vertexCount + quadE[f * 4 + ((c + 3) & 3)]];
      subQuads.set(s, (f * 4 + c) * 4);
    }
  }

  // refine any per-vertex field with `n` components (3 for positions)
  function refine(P, out, n = 3) {
    out = out || new Float32Array(subCount * n);
    const fpOff = (vertexCount + E) * n, epOff = vertexCount * n;
    for (let f = 0; f < F; f++) for (let a = 0; a < n; a++) {
      out[fpOff + f * n + a] = (P[quadV[f * 4] * n + a] + P[quadV[f * 4 + 1] * n + a] + P[quadV[f * 4 + 2] * n + a] + P[quadV[f * 4 + 3] * n + a]) / 4;
    }
    for (let e = 0; e < E; e++) {
      const v0 = ev[e * 2] * n, v1 = ev[e * 2 + 1] * n, f0 = ef[e * 2], f1 = ef[e * 2 + 1];
      for (let a = 0; a < n; a++) {
        out[epOff + e * n + a] = f1 === -1 ? (P[v0 + a] + P[v1 + a]) / 2
          : (P[v0 + a] + P[v1 + a] + out[fpOff + f0 * n + a] + out[fpOff + f1 * n + a]) / 4;
      }
    }
    for (let v = 0; v < vertexCount; v++) {
      const fs = vFaces[v];
      if (!fs.length) { for (let a = 0; a < n; a++) out[v * n + a] = P[v * n + a]; continue; }
      if (boundaryNb[v * 2] !== -1) {
        const b0 = boundaryNb[v * 2] * n, b1 = (boundaryNb[v * 2 + 1] === -1 ? boundaryNb[v * 2] : boundaryNb[v * 2 + 1]) * n;
        for (let a = 0; a < n; a++) out[v * n + a] = 0.75 * P[v * n + a] + 0.125 * (P[b0 + a] + P[b1 + a]);
        continue;
      }
      const es = vEdges[v], k = es.length;
      for (let a = 0; a < n; a++) {
        let q = 0, r = 0;
        for (const f of fs) q += out[fpOff + f * n + a];
        for (const e of es) r += (P[ev[e * 2] * n + a] + P[ev[e * 2 + 1] * n + a]) / 2;
        out[v * n + a] = (q / fs.length + 2 * r / k + (k - 3) * P[v * n + a]) / k;
      }
    }
    return out;
  }

  return {
    edges: Uint32Array.from(ev),
    subCount,
    renderCount: rvPos.length,
    renderPos: Uint32Array.from(rvPos),
    renderUV: Float32Array.from(rvUV),
    index,
    subQuads,
    refine,
  };
}

// area-weighted vertex normals over the refined quads (shared across UV seams)
export function quadNormals(P, subQuads, count, out = new Float32Array(count * 3)) {
  out.fill(0);
  for (let q = 0; q < subQuads.length; q += 4) {
    const a = subQuads[q] * 3, b = subQuads[q + 1] * 3, c = subQuads[q + 2] * 3, d = subQuads[q + 3] * 3;
    // normal of a quad: cross of its diagonals
    const x1 = P[c] - P[a], y1 = P[c + 1] - P[a + 1], z1 = P[c + 2] - P[a + 2];
    const x2 = P[d] - P[b], y2 = P[d + 1] - P[b + 1], z2 = P[d + 2] - P[b + 2];
    const nx = y1 * z2 - z1 * y2, ny = z1 * x2 - x1 * z2, nz = x1 * y2 - y1 * x2;
    for (const v of [a, b, c, d]) { out[v] += nx; out[v + 1] += ny; out[v + 2] += nz; }
  }
  for (let i = 0; i < out.length; i += 3) {
    const l = Math.hypot(out[i], out[i + 1], out[i + 2]) || 1;
    out[i] /= l; out[i + 1] /= l; out[i + 2] /= l;
  }
  return out;
}
