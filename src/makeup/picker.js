// What the pointer touches on the face. The camera and face are fixed while the player works, so the skin's
// triangles are projected to the screen once (per face, size or camera change) and binned in a grid; a pick then
// tests only the few triangles under the pointer and keeps the nearest. The eyeballs are tested exactly as
// spheres. Hair and the outfit are not picked: strokes pass under hair to the skin, and the applicator refuses
// skin under the outfit.
//
// pick(x, y) (CSS pixels in the canvas) returns
//   { kind: 'skin', ref: [x, y, z] (reference-head point), pos: [x, y, z] (current face), at: its triangle's vertices
//     a, b, c and their weights u, v, w }
//   { kind: 'eye', eye: 'left' | 'right', iris: boolean }
//   null when nothing is under the pointer
const CELL = 8; // grid cell, CSS pixels
const EDGE = 1e-4; // barycentric tolerance, so a point on a shared edge or vertex never falls between triangles

export class Picker {
  // hg: HeadGeometry; eyes: Eyes (meshes[0] is the left eye); camera: PerspectiveCamera; width/height: CSS pixels
  update(hg, eyes, camera, width, height) {
    const g = hg.geometry, P = g.attributes.position.array, idx = g.index.array;
    this.P = P; this.ref = g.attributes.ref.array; this.idx = idx; this.W = width; this.H = height;
    this.camera = camera; this.eyes = eyes;
    const view = camera.view(), proj = camera.projection, n = P.length / 3;
    // view-space axes of the camera (rows of the view rotation) for building rays
    this.cx = [view[0], view[4], view[8]]; this.cy = [view[1], view[5], view[9]]; this.cz = [view[2], view[6], view[10]];
    this.eye = [camera.position[0], camera.position[1], camera.position[2]];
    const sx = (this.sx = new Float32Array(n)), sy = (this.sy = new Float32Array(n)), dz = (this.dz = new Float32Array(n));
    for (let i = 0; i < n; i++) {
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
      const vx = view[0] * x + view[4] * y + view[8] * z + view[12];
      const vy = view[1] * x + view[5] * y + view[9] * z + view[13];
      const vz = view[2] * x + view[6] * y + view[10] * z + view[14];
      const cxp = proj[0] * vx, cyp = proj[5] * vy, w = -vz;
      sx[i] = (cxp / w * 0.5 + 0.5) * width;
      sy[i] = (0.5 - cyp / w * 0.5) * height;
      dz[i] = vz; // larger (less negative) is nearer the camera
    }
    const cols = (this.cols = Math.ceil(width / CELL) + 1), rows = (this.rows = Math.ceil(height / CELL) + 1);
    const count = new Uint32Array(cols * rows + 1), tris = idx.length / 3;
    const range = (t, f) => {
      const a = idx[t * 3], b = idx[t * 3 + 1], c = idx[t * 3 + 2];
      const x0 = Math.max(0, Math.floor(Math.min(sx[a], sx[b], sx[c]) / CELL)), x1 = Math.min(cols - 1, Math.floor(Math.max(sx[a], sx[b], sx[c]) / CELL));
      const y0 = Math.max(0, Math.floor(Math.min(sy[a], sy[b], sy[c]) / CELL)), y1 = Math.min(rows - 1, Math.floor(Math.max(sy[a], sy[b], sy[c]) / CELL));
      for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) f(yy * cols + xx);
    };
    for (let t = 0; t < tris; t++) range(t, (k) => count[k + 1]++);
    for (let k = 1; k < count.length; k++) count[k] += count[k - 1];
    const fill = count.slice(), items = new Uint32Array(count[count.length - 1]);
    for (let t = 0; t < tris; t++) range(t, (k) => { items[fill[k]++] = t; });
    this.start = count; this.items = items;
  }

  // canvas CSS pixel position of a face-space point (for tests and on-screen hints)
  project(p) {
    const c = this.camera, t = Math.tan((c.fov * Math.PI) / 360);
    const v = [p[0] - this.eye[0], p[1] - this.eye[1], p[2] - this.eye[2]];
    const dot = (a) => a[0] * v[0] + a[1] * v[1] + a[2] * v[2];
    const depth = -dot(this.cz);
    return [(dot(this.cx) / depth / (t * c.aspect) * 0.5 + 0.5) * this.W, (0.5 - dot(this.cy) / depth / t * 0.5) * this.H];
  }

  // ray from the camera through a canvas point: { o, d } in face space
  ray(x, y) {
    const c = this.camera, t = Math.tan((c.fov * Math.PI) / 360);
    const nx = (x / this.W) * 2 - 1, ny = 1 - (y / this.H) * 2;
    const d = [0, 1, 2].map((a) => -this.cz[a] + this.cx[a] * nx * t * c.aspect + this.cy[a] * ny * t);
    const l = Math.hypot(...d);
    return { o: this.eye, d: d.map((v) => v / l) };
  }

  // nearest skin point under the pointer, or null
  skin(x, y) {
    if (!this.items || !(x >= 0 && y >= 0 && x < this.W && y < this.H)) return null;
    const k = Math.floor(y / CELL) * this.cols + Math.floor(x / CELL);
    const { sx, sy, dz, idx } = this;
    let best = null;
    for (let j = this.start[k]; j < this.start[k + 1]; j++) {
      const t = this.items[j], a = idx[t * 3], b = idx[t * 3 + 1], c = idx[t * 3 + 2];
      const d = (sy[b] - sy[c]) * (sx[a] - sx[c]) + (sx[c] - sx[b]) * (sy[a] - sy[c]);
      if (Math.abs(d) < 1e-9) continue;
      const u = ((sy[b] - sy[c]) * (x - sx[c]) + (sx[c] - sx[b]) * (y - sy[c])) / d;
      const v = ((sy[c] - sy[a]) * (x - sx[c]) + (sx[a] - sx[c]) * (y - sy[c])) / d;
      const w = 1 - u - v;
      if (u < -EDGE || v < -EDGE || w < -EDGE) continue;
      const depth = u * dz[a] + v * dz[b] + w * dz[c];
      if (!best || depth > best.depth) best = { depth, a, b, c, u, v, w };
    }
    if (!best) return null;
    const lerp = (A) => [0, 1, 2].map((i) => best.u * A[best.a * 3 + i] + best.v * A[best.b * 3 + i] + best.w * A[best.c * 3 + i]);
    return { kind: 'skin', ref: lerp(this.ref), pos: lerp(this.P), depth: -best.depth, at: best };
  }

  // exact ray-sphere test against each eyeball; returns the nearer hit
  eyeHit(x, y) {
    const { o, d } = this.ray(x, y);
    let best = null;
    this.eyes.meshes.forEach((m, k) => {
      const c = m.position, r = m.scale[0];
      const oc = [o[0] - c[0], o[1] - c[1], o[2] - c[2]];
      const b = oc[0] * d[0] + oc[1] * d[1] + oc[2] * d[2], cc = oc[0] * oc[0] + oc[1] * oc[1] + oc[2] * oc[2] - r * r;
      const disc = b * b - cc;
      if (disc < 0) return;
      const t = -b - Math.sqrt(disc);
      if (t <= 0 || (best && t >= best.t)) return;
      const h = [o[0] + d[0] * t - c[0], o[1] + d[1] * t - c[1], o[2] + d[2] * t - c[2]];
      const [ax, ay, az] = m.rotation; // eye axes; +z looks at the camera
      const dot = (u) => (u[0] * h[0] + u[1] * h[1] + u[2] * h[2]) / r;
      const size = m.material.uniforms.uIrisSize.value;
      const iris = dot(az) > 0 && Math.hypot(dot(ax), dot(ay)) < size * 1.1;
      // depth along the camera axis, comparable with skin hits
      const depth = -t * (d[0] * this.cz[0] + d[1] * this.cz[1] + d[2] * this.cz[2]);
      best = { t, depth, kind: 'eye', eye: k === 0 ? 'left' : 'right', iris };
    });
    return best;
  }

  // The lid's edge nearest a point on an eyeball: the first skin met moving straight out from the eye's centre on
  // screen, within 45 % of the eye's radius (so a line traced along the lashes hugs the lid, but a stroke across the
  // middle of the eye finds nothing). Returns a skin hit, or null.
  lidNear(x, y, eye) {
    const m = this.eyes.meshes[eye === 'left' ? 0 : 1], c = m.position;
    const [cx, cy] = this.project(c), [rx, ry] = this.project([c[0] + m.scale[0], c[1], c[2]]);
    const r = Math.hypot(rx - cx, ry - cy), dx = x - cx, dy = y - cy, l = Math.hypot(dx, dy) || 1;
    for (let k = 0.5; k <= r * 0.45; k += 0.5) {
      const h = this.pick(x + (dx / l) * k, y + (dy / l) * k);
      if (h?.kind === 'skin') return h;
    }
    return null;
  }

  // whatever is nearest under the pointer: an eyeball (in the eye opening) or skin
  pick(x, y) {
    const s = this.skin(x, y), e = this.eyeHit(x, y);
    if (e && (!s || e.depth < s.depth)) return { kind: 'eye', eye: e.eye, iris: e.iris };
    return s;
  }

  // the pointer's position on the plane z = zPlane in face space (where the lashes are), or null
  onPlane(x, y, zPlane) {
    if (!this.items || !(x >= 0 && y >= 0 && x < this.W && y < this.H)) return null;
    const { o, d } = this.ray(x, y);
    if (Math.abs(d[2]) < 1e-6) return null;
    const t = (zPlane - o[2]) / d[2];
    return [o[0] + d[0] * t, o[1] + d[1] * t];
  }
}
