// The tools in hand, in 3D (owner, 19 October 2026: the tool's graphics match the face's). Every tool is a small
// model in the head's units (decimetres), built from turned parts in real proportions, with its working tip at the
// origin and its handle along +y: the brush's tuft, the fan brush, the pencil's lead, the liner's felt tip, the middle
// of the mascara's brush, the lipstick's slanted bullet, the tweezers' tips holding a gem (the placed gems' own
// geometry and material), a contact lens. ToolView draws one into a small transparent canvas with the face's camera
// perspective, its three lights, sky and ground, tone mapping and colour space, at the face's scale (pixels per
// decimetre where she is), so a brush's tuft is as wide as the stroke it paints. The canvas is drawn once for each
// tool, colour and pose, and the game moves it with the pointer.
import * as GL from '../gl/mini.js';
import { LIGHT_GLSL, lightUniforms } from '../face/lighting.js';
import { hexToLinear } from '../face/colors.js';
import { CAMERA } from '../face/face-view.js';
import { addGem, gemMaterial } from './gems.js';

const vertexShader = /* glsl */ `
attribute vec3 local;
varying vec3 vN, vV, vLocal;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vV = -mv.xyz; vN = normalMatrix * normal; vLocal = local;
  gl_Position = projectionMatrix * mv;
}`;

const fragmentShader = /* glsl */ `
${LIGHT_GLSL}
uniform vec3 uColor, uIris[4];
uniform float uRough, uMetal, uFiber, uClear, uLens;
varying vec3 vN, vV, vLocal;
// the salon reflected in metal and lacquer (as in the gems)
vec3 room(vec3 r) {
  vec3 c = mix(vec3(0.32, 0.2, 0.2), vec3(1.05, 0.96, 0.92), smoothstep(-0.6, 0.8, r.y));
  c += 4.0 * uLightCol[0] * smoothstep(0.84, 0.94, dot(r, uLightDir[0]));
  c += 3.0 * uLightCol[1] * smoothstep(0.88, 0.96, dot(r, uLightDir[1]));
  return c;
}
void main() {
  vec3 n = normalize(vN), v = normalize(vV);
  float NoV = max(dot(n, v), 1e-3);
  vec3 base = uColor;
  // bristles: fine fibres running along the tuft
  if (uFiber > 0.0) base *= mix(1.0, 0.62 + 0.7 * vnoise(vec3(atan(vLocal.z, vLocal.x) * 38.0, vLocal.y * 9.0, vLocal.x * 300.0)), uFiber);
  // a contact lens: clear in the middle, the iris colours in rings to its edge
  if (uLens > 0.0) {
    float d = length(vLocal.xz) / uLens;
    base = d < 0.3 ? vec3(0.85, 0.87, 0.9) : d < 0.55 ? mix(uIris[0], uIris[1], (d - 0.3) / 0.25) : d < 0.85 ? mix(uIris[1], uIris[2], (d - 0.55) / 0.3) : mix(uIris[2], uIris[3], min((d - 0.85) / 0.15, 1.0));
  }
  float a = max(uRough * uRough, 0.003);
  vec3 diff = ambient(n), spec = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    vec3 l = uLightDir[i], h = normalize(l + v);
    float nl = max(dot(n, l), 0.0);
    diff += uLightCol[i] * nl;
    spec += uLightCol[i] * D_GGX(max(dot(n, h), 0.0), a) * V_Smith(NoV, nl, a) * nl;
  }
  vec3 f0 = mix(vec3(0.04), base, uMetal), F = f0 + (1.0 - f0) * pow(1.0 - NoV, 5.0), r = reflect(-v, n);
  vec3 col = base * (1.0 - uMetal) * diff * 0.9 + spec * F + uMetal * base * room(r) * 0.55 + uClear * F * room(r) * 0.35;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// ---- materials: a product colour in linear RGB, roughness, metal, bristle fibres, a clear lacquer ----
const mix = (a, b, t) => a.map((v, i) => v * (1 - t) + b[i] * t);
const lin = (hex) => hexToLinear(hex);
const metal = (hex) => ({ color: lin(hex), rough: 0.3, metal: 1 });
const GOLD = metal('#d9b25f'), SILVER = metal('#cfd3da'), ROSE_GOLD = metal('#dca58e');
const lacquer = (rgb) => ({ color: rgb, rough: 0.2, clear: 1 });
const satin = (rgb) => ({ color: rgb, rough: 0.42, clear: 0.4 });
const bristles = (rgb) => ({ color: rgb, rough: 0.6, fiber: 1 });
const CREAM = lin('#efe0cc'), INK = lin('#2a1d26'), BLACK = lin('#1b1518'), WOOD = lin('#e6bf8e');

// ---- geometry: parts in model space (tip at the origin, handle along +y) ----
// a turned part: profile [[radius, y], ...] swept round the y axis; smooth normals from the profile's slope (flat
// sides with `facets`, like a pencil's six); squash: [x, z] scales for a flattened part (a fan brush's ferrule)
function lathe(profile, { segments = 28, facets = 0, squash = [1, 1] } = {}) {
  const n = facets || segments, pos = [], nrm = [], loc = [];
  const ring = (j, i) => {
    const [r, y] = profile[j], t = facets ? ((i + 0.5) / n) * 2 * Math.PI : (i / n) * 2 * Math.PI;
    return [r * Math.cos(t) * squash[0], y, r * Math.sin(t) * squash[1], t];
  };
  const slope = (j) => {
    const a = profile[Math.max(0, j - 1)], b = profile[Math.min(profile.length - 1, j + 1)];
    const dr = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dr, dy) || 1;
    return [dy / l, -dr / l]; // (radial, axial) of the outward normal
  };
  const normal = (j, t, flat) => {
    const [nr, ny] = flat || slope(j), x = nr * Math.cos(t) / squash[0], z = nr * Math.sin(t) / squash[1], l = Math.hypot(x, ny, z) || 1;
    return [x / l, ny / l, z / l];
  };
  for (let j = 0; j + 1 < profile.length; j++) {
    const flat = facets ? slope(j + 0.5 | 0) : null;
    for (let i = 0; i < n; i++) {
      const a = ring(j, i), b = ring(j, (i + 1) % n), c = ring(j + 1, (i + 1) % n), d = ring(j + 1, i);
      const tm = facets ? ((i + 1) / n) * 2 * Math.PI : null;
      const na = normal(j, facets ? tm : a[3], flat), nb = normal(j, facets ? tm : b[3], flat), nc = normal(j + 1, facets ? tm : c[3], flat), nd = normal(j + 1, facets ? tm : d[3], flat);
      for (const [p, q] of [[a, na], [c, nc], [b, nb], [a, na], [d, nd], [c, nc]]) { pos.push(p[0], p[1], p[2]); nrm.push(...q); loc.push(p[0], p[1], p[2]); }
    }
  }
  return { pos, nrm, loc };
}
// a flat fan (the highlighter's fan brush): a sector about a pivot on the axis, `thick` deep
function fan(pivot, radius, spread, thick, segments = 24) {
  const pos = [], nrm = [], loc = [], pt = (k, z) => { const t = -spread + (2 * spread * k) / segments; return [radius * Math.sin(t), pivot - radius * Math.cos(t), z]; };
  const tri = (a, b, c, nv) => { for (const p of [a, b, c]) { pos.push(...p); nrm.push(...nv); loc.push(...p); } };
  for (let k = 0; k < segments; k++) {
    const p0 = [0, pivot, thick], p1 = [0, pivot, -thick];
    tri(p0, pt(k, thick), pt(k + 1, thick), [0, 0, 1]);
    tri(p1, pt(k + 1, -thick), pt(k, -thick), [0, 0, -1]);
    const a = pt(k, thick), b = pt(k + 1, thick), c = pt(k + 1, -thick), d = pt(k, -thick), t = -spread + (2 * spread * (k + 0.5)) / segments, rim = [Math.sin(t), -Math.cos(t), 0];
    tri(a, c, b, rim); tri(a, d, c, rim);
  }
  return { pos, nrm, loc };
}
// a lipstick's bullet: a cylinder of radius r cut on the slant at its tip (from y = 0 at x = -r up to y = cut at
// x = r) and running to y = len; the slanted face has its own flat normal
function bullet(r, cut, len, segments = 32) {
  const pos = [], nrm = [], loc = [], at = (t) => [r * Math.cos(t), cut * (Math.cos(t) + 1) / 2, r * Math.sin(t)];
  const push = (p, q) => { pos.push(...p); nrm.push(...q); loc.push(...p); };
  const face = [cut / (2 * r), -1, 0], fl = Math.hypot(...face), fn = face.map((v) => v / fl);
  for (let i = 0; i < segments; i++) {
    const t0 = (i / segments) * 2 * Math.PI, t1 = ((i + 1) / segments) * 2 * Math.PI, a = at(t0), b = at(t1);
    const a2 = [a[0], len, a[2]], b2 = [b[0], len, b[2]], na = [Math.cos(t0), 0, Math.sin(t0)], nb = [Math.cos(t1), 0, Math.sin(t1)];
    push(a, na); push(b2, nb); push(b, nb); push(a, na); push(a2, na); push(b2, nb);
    push([0, cut / 2, 0], fn); push(b, fn); push(a, fn);
  }
  return { pos, nrm, loc };
}
// a thin flat strip from p0 to p1 (a tweezers' prong): width across x, depth in z
function strip(p0, p1, w0, w1, depth) {
  const pos = [], nrm = [], loc = [];
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1], l = Math.hypot(dx, dy), sx = -dy / l, sy = dx / l;
  const corner = (p, w, z) => [p[0] + sx * w, p[1] + sy * w, z];
  const quad = (a, b, c, d, nv) => { for (const p of [a, c, b, a, d, c]) { pos.push(...p); nrm.push(...nv); loc.push(...p); } };
  const A = (s, z) => corner(p0, s * w0, z), B = (s, z) => corner(p1, s * w1, z);
  quad(A(-1, depth), A(1, depth), B(1, depth), B(-1, depth), [0, 0, 1]);
  quad(A(1, -depth), A(-1, -depth), B(-1, -depth), B(1, -depth), [0, 0, -1]);
  quad(A(1, depth), A(1, -depth), B(1, -depth), B(1, depth), [sx, sy, 0]);
  quad(A(-1, -depth), A(-1, depth), B(-1, depth), B(-1, -depth), [-sx, -sy, 0]);
  return { pos, nrm, loc };
}

// The tools: their parts and materials. c: the colour (a palette entry); r: the tool's paint radius (decimetres)
const TOOLS = {
  brush: (c) => [
    [lathe([[0, 0], [0.032, 0.005], [0.062, 0.02], [0.082, 0.05], [0.089, 0.085], [0.082, 0.13], [0.064, 0.17], [0.052, 0.2]]), bristles(mix(CREAM, lin(c.hex), 0.6))],
    [lathe([[0.052, 0.2], [0.054, 0.215], [0.054, 0.42], [0.046, 0.44]]), ROSE_GOLD],
    [lathe([[0.046, 0.44], [0.041, 0.6], [0.032, 0.92], [0.034, 1.0], [0.02, 1.04], [0, 1.05]]), lacquer(INK)],
  ],
  // a fan brush: a thin spread of bristles fanning out from a flattened ferrule, its rounded edge the working tip (the
  // game holds it with that edge along her cheekbone)
  glow: (c) => [
    [fan(0.27, 0.27, 0.6, 0.006), bristles(mix(CREAM, lin(c.hex), 0.45))],
    [lathe([[0.03, 0.2], [0.03, 0.32]], { squash: [1.5, 0.4] }), GOLD],
    [lathe([[0.022, 0.32], [0.019, 0.7], [0.016, 0.98], [0, 1.0]]), lacquer(lin('#f2e3e8'))],
  ],
  pencil: (c) => [
    [lathe([[0, 0], [0.011, 0.03]], { segments: 18 }), satin(lin(c.hex))],
    [lathe([[0.011, 0.03], [0.038, 0.17]], { segments: 18 }), { color: WOOD, rough: 0.75 }],
    [lathe([[0.038, 0.17], [0.038, 0.94]], { facets: 6 }), lacquer(lin(c.hex))],
    [lathe([[0.039, 0.94], [0.039, 1.0], [0.02, 1.01], [0, 1.01]]), GOLD],
  ],
  liner: (c) => [
    [lathe([[0, 0], [0.006, 0.012], [0.012, 0.05]], { segments: 16 }), satin(lin(c.hex))],
    [lathe([[0.018, 0.05], [0.022, 0.06], [0.027, 0.12]]), SILVER],
    [lathe([[0.04, 0.12], [0.04, 0.2]]), lacquer(lin(c.hex))],
    [lathe([[0.04, 0.2], [0.04, 0.95], [0.033, 1.0], [0, 1.01]]), lacquer(BLACK)],
  ],
  // the mascara works with the middle of its brush (the origin)
  mascara: (c) => [
    [lathe([[0.01, -0.12], [0.027, -0.095], [0.034, -0.02], [0.031, 0.08], [0.012, 0.12]]), bristles(mix(BLACK, lin(c.hex), 0.55))],
    [lathe([[0.007, 0.12], [0.007, 0.45]], { segments: 12 }), SILVER],
    [lathe([[0.053, 0.45], [0.053, 0.51]]), GOLD],
    [lathe([[0.05, 0.51], [0.05, 1.05], [0.043, 1.1], [0, 1.11]]), lacquer(mix(BLACK, lin(c.hex), 0.25))],
  ],
  // the lipstick works with the low point of its slanted bullet (moved to the origin), wound up as far as a woman
  // winds it to use: about 1.5 cm of bullet above the gold sleeve
  lip: (c) => [
    [bullet(0.045, 0.08, 0.15), satin(lin(c.hex)), [0.045, 0]],
    [lathe([[0.05, 0.15], [0.05, 0.27]]), GOLD, [0.045, 0]],
    [lathe([[0.058, 0.27], [0.058, 0.45], [0.059, 0.45], [0.059, 0.49], [0.058, 0.49], [0.058, 0.8], [0.05, 0.83], [0, 0.83]]), lacquer(BLACK), [0.045, 0]],
  ],
  // tweezers: two sprung arms joined at the back, their tips gripping the gem's sides (the gem is added separately,
  // facing her)
  gem: (c) => {
    const g = 0.5 * (c.shape === 'pearl' ? 0.08 : { stone: 0.095, drop: 0.11, heart: 0.125, star: 0.135, flower: 0.125 }[c.shape] ?? 0.1);
    return [
      [strip([g * 0.75, 0.01], [g + 0.012, 0.16], 0.004, 0.009, 0.006), SILVER],
      [strip([-g * 0.75, 0.01], [-g - 0.012, 0.16], 0.004, 0.009, 0.006), SILVER],
      [strip([g + 0.012, 0.16], [0.016, 0.82], 0.009, 0.013, 0.006), SILVER],
      [strip([-g - 0.012, 0.16], [-0.016, 0.82], 0.009, 0.013, 0.006), SILVER],
      [lathe([[0.03, 0.8], [0.03, 0.88], [0.02, 0.9], [0, 0.9]], { squash: [1, 0.35] }), SILVER],
    ];
  },
  lens: () => [],
};

// a pose: the tool lies along `dir` on screen (from its tip to its handle, y down) and leans `tilt` radians towards
// the viewer, as a hand holds it; `roll` turns it about its own axis
function poser({ dir, tilt = 0.55, roll = 0 }) {
  const [dx, dy] = dir, l = Math.hypot(dx, dy), ux = dx / l, uy = -dy / l; // screen down is world -y
  const th = Math.atan2(-ux, uy), ct = Math.cos(th), st = Math.sin(th), cl = Math.cos(tilt), sl = Math.sin(tilt), cr = Math.cos(roll), sr = Math.sin(roll);
  return ([x, y, z]) => {
    const x1 = x * cr + z * sr, z1 = -x * sr + z * cr; // roll about the tool's own axis
    const y2 = y * cl, z2 = z1 * cl + y * sl; // lean the handle towards the viewer
    return [x1 * ct - y2 * st, x1 * st + y2 * ct, z2];
  };
}

export class ToolView {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.renderer = new GL.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true });
    this.scene = new GL.Scene();
    this.scene.background = null;
    this.camera = new GL.PerspectiveCamera(CAMERA.fov, 1, 0.5, 60);
    this.meshes = [];
  }

  // Draw a tool in a colour (a palette entry), posed as `pose` (see poser), at k CSS pixels per decimetre, for a
  // screen of pixel ratio dpr. Returns where its working tip is in the canvas (CSS pixels) and the canvas's size.
  draw(tool, c, pose, k, dpr = 1) {
    for (const m of this.meshes) m.geometry.dispose();
    this.meshes = [];
    this.scene.clear();
    const place = poser(pose), bounds = [Infinity, Infinity, -Infinity, -Infinity];
    const grow = ([x, y, z]) => {
      const f = CAMERA.distance / (CAMERA.distance - z); // nearer the viewer looks a little bigger
      bounds[0] = Math.min(bounds[0], x * f); bounds[1] = Math.min(bounds[1], y * f); bounds[2] = Math.max(bounds[2], x * f); bounds[3] = Math.max(bounds[3], y * f);
    };
    for (const [part, mat, shift = [0, 0]] of TOOLS[tool](c)) {
      const pos = [], nrm = [];
      for (let i = 0; i < part.pos.length; i += 3) {
        const p = place([part.pos[i] + shift[0], part.pos[i + 1] + shift[1], part.pos[i + 2]]), q = place([part.nrm[i], part.nrm[i + 1], part.nrm[i + 2]]);
        pos.push(...p); nrm.push(...q); grow(p);
      }
      const geo = new GL.BufferGeometry();
      geo.setAttribute('position', new GL.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new GL.Float32BufferAttribute(nrm, 3));
      geo.setAttribute('local', new GL.Float32BufferAttribute(part.loc, 3));
      this.add(geo, mat);
    }
    // the gem held at the tip, or the lens: facing her, upright (unposed)
    if (tool === 'gem') {
      const pos = [], nrm = [], col = [], kind = [];
      addGem(c, [0, 0, 0.012], [0, 0, 1], 0, pos, nrm, col, kind);
      for (let i = 0; i < pos.length; i += 3) grow([pos[i], pos[i + 1], pos[i + 2]]);
      const geo = new GL.BufferGeometry();
      geo.setAttribute('position', new GL.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new GL.Float32BufferAttribute(nrm, 3));
      geo.setAttribute('colour', new GL.Float32BufferAttribute(col, 3));
      geo.setAttribute('kind', new GL.Float32BufferAttribute(kind, 2));
      const mesh = new GL.Mesh(geo, gemMaterial());
      this.scene.add(mesh); this.meshes.push(mesh);
    }
    if (tool === 'lens') {
      // a thin dome, iris-sized, from its rim in to its middle (so its surface faces out)
      const R = 0.055, part = lathe([[R, -0.001], [0.045, 0.002], [0.028, 0.005], [0, 0.006]], { segments: 40 });
      const turn = ([x, y, z]) => [x, -z, y]; // its axis towards the viewer
      const pos = [], nrm = [];
      for (let i = 0; i < part.pos.length; i += 3) {
        const p = turn([part.pos[i], part.pos[i + 1], part.pos[i + 2]]);
        pos.push(...p); nrm.push(...turn([part.nrm[i], part.nrm[i + 1], part.nrm[i + 2]])); grow(p);
      }
      const geo = new GL.BufferGeometry();
      geo.setAttribute('position', new GL.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new GL.Float32BufferAttribute(nrm, 3));
      geo.setAttribute('local', new GL.Float32BufferAttribute(part.loc, 3));
      this.add(geo, { color: [1, 1, 1], rough: 0.22, clear: 0.45, lens: R, iris: c.iris.map(lin) });
    }
    // the canvas: the tool's extent at k pixels per decimetre, with a margin; the camera sees exactly that, from the
    // face camera's distance and so with its perspective
    const m = 6, w = Math.ceil((bounds[2] - bounds[0]) * k + 2 * m), h = Math.ceil((bounds[3] - bounds[1]) * k + 2 * m);
    const cx = (bounds[0] + bounds[2]) / 2, cy = (bounds[1] + bounds[3]) / 2;
    this.camera.aspect = w / h;
    this.camera.fov = (2 * Math.atan(h / (2 * k) / CAMERA.distance) * 180) / Math.PI;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(cx, cy, CAMERA.distance);
    this.camera.lookAt(new GL.Vector3(cx, cy, 0));
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h);
    this.renderer.render(this.scene, this.camera);
    return { canvas: this.canvas, tip: [w / 2 - cx * k, h / 2 + cy * k], width: w, height: h };
  }

  add(geo, mat) {
    const u = lightUniforms();
    Object.assign(u, {
      uColor: { value: new GL.Vector3(...mat.color) }, uRough: { value: mat.rough ?? 0.5 }, uMetal: { value: mat.metal ?? 0 },
      uFiber: { value: mat.fiber ?? 0 }, uClear: { value: mat.clear ?? 0 }, uLens: { value: mat.lens ?? 0 },
      uIris: { value: (mat.iris || [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]).map((v) => new GL.Vector3(...v)) },
    });
    const mesh = new GL.Mesh(geo, new GL.ShaderMaterial({ vertexShader, fragmentShader, uniforms: u, side: GL.DoubleSide }));
    this.scene.add(mesh); this.meshes.push(mesh);
  }
}
