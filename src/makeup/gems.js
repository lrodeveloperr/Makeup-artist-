// Face gems: rhinestones, pearls, hearts, stars and flowers stuck on the skin, one per tap. A gem is stored as a
// point in the reference-head frame (like a stroke's points), found again on the current face, sat on the skin
// facing out along its normal and upright to the face, and drawn as a small 3D piece whose facets catch the salon
// lights. Its colour entry gives the shape (`shape`) and the material (`look`: glass, iris for iridescent glass,
// pearl or metal).
import * as GL from '../gl/mini.js';
import { SurfaceSampler, evalPoint } from '../face/surface.js';
import { LIGHT_GLSL, lightUniforms } from '../face/lighting.js';
import { hexToLinear } from '../face/colors.js';

const LOOKS = { glass: 0, iris: 1, pearl: 2, metal: 3 };
// outlines in the gem's plane (y up, about unit size), counter-clockwise and star-shaped about the origin
const ring = (n, f) => Array.from({ length: n }, (_, k) => f((k / n) * 2 * Math.PI));
const OUTLINE = {
  stone: ring(16, (a) => [Math.cos(a), Math.sin(a)]),
  drop: ring(24, (a) => { const s = Math.sin(a), c = Math.cos(a); return [c * 0.78 * (1 - 0.85 * Math.max(s, 0)), s > 0 ? 0.12 + s : 0.12 + 0.78 * s]; }),
  heart: ring(32, (a) => { const t = a + Math.PI / 2; const x = 16 * Math.sin(t) ** 3, y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t); return [-x / 16, y / 16 + 0.2]; }),
  star: ring(10, (a) => { const r = Math.round(a / (Math.PI / 5)) % 2 ? 0.46 : 1; return [r * Math.cos(a + Math.PI / 2), r * Math.sin(a + Math.PI / 2)]; }),
  flower: ring(40, (a) => { const r = 0.62 + 0.38 * Math.abs(Math.cos(2.5 * a)); return [r * Math.cos(a + Math.PI / 2), r * Math.sin(a + Math.PI / 2)]; }),
};
// size: across the gem in decimetres (bigger than life, so a gem reads on a phone); dome: height for size 1;
// waist: the crown facets' ring (scale of the outline, height); table: a flat top (rhinestone) or a point
const SHAPES = {
  stone: { size: 0.095, dome: 0.62, waist: [0.68, 0.36], table: true },
  drop: { size: 0.11, dome: 0.5, waist: [0.62, 0.3], table: true },
  heart: { size: 0.125, dome: 0.4, waist: [0.6, 0.26], table: false },
  star: { size: 0.135, dome: 0.32, waist: [0.55, 0.2], table: false },
  flower: { size: 0.125, dome: 0.36, waist: [0.5, 0.24], table: false },
  pearl: { size: 0.08 },
};
export const GEM_SHAPES = Object.keys(SHAPES);
const LIFT = 0.002; // above the skin, so the gem never sinks into it

const vertexShader = /* glsl */ `
attribute vec3 colour;
attribute vec2 kind; // look, seed
varying vec3 vN, vV, vCol, vLocal;
varying vec2 vKind;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vV = -mv.xyz; vN = normalMatrix * normal; vCol = colour; vKind = kind; vLocal = position;
  gl_Position = projectionMatrix * mv;
}`;

const fragmentShader = /* glsl */ `
${LIGHT_GLSL}
varying vec3 vN, vV, vCol, vLocal;
varying vec2 vKind;
// the salon seen in a facet: warm wall below, bright ceiling, and the studio lights as bright panels
vec3 room(vec3 r) {
  vec3 c = mix(vec3(0.32, 0.2, 0.2), vec3(1.05, 0.96, 0.92), smoothstep(-0.6, 0.8, r.y));
  c += 4.0 * uLightCol[0] * smoothstep(0.84, 0.94, dot(r, uLightDir[0]));
  c += 3.0 * uLightCol[1] * smoothstep(0.88, 0.96, dot(r, uLightDir[1]));
  c += 2.0 * smoothstep(0.93, 0.98, dot(r, normalize(vec3(0.5, 0.75, 0.45))));
  return c;
}
vec3 rainbow(float h) { return clamp(abs(fract(h + vec3(0.0, 0.667, 0.333)) * 6.0 - 3.0) - 1.0, 0.0, 1.0); }
void main() {
  vec3 n = normalize(vN), v = normalize(vV);
  float look = vKind.x, NoV = max(dot(n, v), 0.0), fres = pow(1.0 - NoV, 4.0);
  vec3 r = reflect(-v, n), col;
  vec3 spec = vec3(0.0), diff = ambient(n);
  float rough = look > 2.5 ? 0.2 : look > 1.5 ? 0.32 : 0.06;
  for (int i = 0; i < 3; i++) {
    vec3 l = uLightDir[i], h = normalize(l + v);
    float nl = max(dot(n, l), 0.0);
    diff += uLightCol[i] * nl;
    spec += uLightCol[i] * D_GGX(max(dot(n, h), 0.0), rough * rough) * V_Smith(NoV, nl, rough * rough) * nl;
  }
  if (look > 2.5) {
    // metal: the room and the lights reflected in the metal's colour
    col = vCol * (0.25 * diff + 0.75 * room(r)) + vCol * spec;
  } else if (look > 1.5) {
    // pearl: a soft body with a broad sheen and a faint pink-green play of colour towards its edge
    vec3 orient = mix(vec3(1.0), rainbow(0.85 + 0.25 * NoV + vKind.y), 0.25 * (1.0 - NoV));
    col = vCol * diff * 0.8 * orient + 0.25 * spec + 0.35 * fres * room(r);
  } else {
    // cut glass: its colour lit through the stone, each facet mirroring the room, and the lights flashing in it;
    // iridescent glass splits the light into colours facet by facet
    vec3 through = room(refract(-v, n, 0.6));
    col = vCol * vCol * (0.12 * diff + 0.75 * through) + mix(0.08, 1.0, fres) * room(r) * mix(vec3(1.0), vCol, 0.4) + 2.0 * spec;
    float fire = look > 0.5 ? 0.7 : 0.18 * smoothstep(0.5, 0.9, dot(vCol, vec3(0.33)));
    col += fire * rainbow(dot(n, vec3(2.1, 3.7, 1.3)) + vKind.y) * (0.4 + room(r).g * 0.4);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// the gems' material (also the gem held in the tweezers, makeup/tools3d.js)
export const gemMaterial = () => new GL.ShaderMaterial({ vertexShader, fragmentShader, uniforms: lightUniforms() });

export class Gems {
  // hg: HeadGeometry (current positions and normals of the face)
  constructor(hg) {
    this.hg = hg;
    // the whole front of the head, neck and shoulders: wherever the brush can paint, a gem can go
    this.sampler = new SurfaceSampler(hg.refSub, hg.sub.subQuads, { minX: -1.6, maxX: 1.6, minY: -3.2, maxY: 1.6, cell: 0.05 });
    this.material = gemMaterial();
    this.mesh = new GL.Mesh(new GL.BufferGeometry(), this.material);
    this.mesh.visible = false;
    this.list = [];
  }

  // where a gem at a reference-head point sits on the current face: the surface point, or null if none is there
  locate(ref) { return this.sampler.locate(ref[0], ref[1], ref[2]); }

  // gems: [{ ref: [x, y, z], colour }] (colour: a palette entry with shape and look); rebuilds the mesh
  set(gems) {
    this.list = gems.slice();
    const pos = [], nrm = [], col = [], kind = [];
    this.list.forEach((g, i) => this.build(g, i, pos, nrm, col, kind));
    const geo = new GL.BufferGeometry();
    geo.setAttribute('position', new GL.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new GL.Float32BufferAttribute(nrm, 3));
    geo.setAttribute('colour', new GL.Float32BufferAttribute(col, 3));
    geo.setAttribute('kind', new GL.Float32BufferAttribute(kind, 2));
    this.mesh.geometry.dispose();
    this.mesh.geometry = geo;
    this.mesh.visible = pos.length > 0;
  }

  build(g, index, pos, nrm, col, kind) {
    const hit = this.locate(g.ref);
    if (!hit) return;
    const p = evalPoint(hit, this.hg.subPos), n = evalPoint(hit, this.hg.subNrm);
    const nl = Math.hypot(...n);
    for (let k = 0; k < 3; k++) n[k] /= nl;
    addGem(g.colour, p, n, index, pos, nrm, col, kind);
  }
}

// One gem's triangles (into pos, nrm, col, kind; the gem material's attributes): colour c (a palette entry with shape
// and look) sat at point p facing out along the unit normal n, upright ("up" is the head's up, laid onto the surface)
export function addGem(c, p, n, index, pos, nrm, col, kind) {
  const shape = SHAPES[c.shape], half = shape.size / 2;
  const up = [-n[1] * n[0], 1 - n[1] * n[1], -n[1] * n[2]], ul = Math.hypot(...up) || 1;
  for (let k = 0; k < 3; k++) up[k] /= ul;
  const right = [up[1] * n[2] - up[2] * n[1], up[2] * n[0] - up[0] * n[2], up[0] * n[1] - up[1] * n[0]];
  const at = (u, v, w) => [0, 1, 2].map((k) => p[k] + n[k] * (LIFT + w * half) + (right[k] * u + up[k] * v) * half);
  const lin = hexToLinear(c.hex), look = LOOKS[c.look], seed = (index * 0.618) % 1;
  const emit = (a, b, d, na, nb, nd) => {
    pos.push(...a, ...b, ...d);
    if (na) nrm.push(...na, ...nb, ...nd);
    else {
      // a flat facet
      const e1 = b.map((x, k) => x - a[k]), e2 = d.map((x, k) => x - a[k]);
      const f = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], l = Math.hypot(...f) || 1;
      for (let k = 0; k < 3; k++) nrm.push(f[0] / l, f[1] / l, f[2] / l);
    }
    for (let k = 0; k < 3; k++) { col.push(...lin); kind.push(look, seed); }
  };
  if (c.shape === 'pearl') {
    // a half sphere with smooth normals
    const R = 6, S = 16, pt = (j, i) => { const t = (j / R) * Math.PI / 2, a = (i / S) * 2 * Math.PI; return [Math.cos(t) * Math.cos(a), Math.cos(t) * Math.sin(a), Math.sin(t)]; };
    const world = (q) => at(q[0], q[1], q[2]), normal = (q) => [0, 1, 2].map((k) => right[k] * q[0] + up[k] * q[1] + n[k] * q[2]);
    for (let j = 0; j < R; j++) for (let i = 0; i < S; i++) {
      const a = pt(j, i), b = pt(j, i + 1), d = pt(j + 1, i + 1), e = pt(j + 1, i);
      emit(world(a), world(b), world(d), normal(a), normal(b), normal(d));
      if (j < R - 1) emit(world(a), world(d), world(e), normal(a), normal(d), normal(e));
    }
    return;
  }
  // a faceted dome: the outline on the skin, a ring of crown facets, then a flat table or a point
  const o = OUTLINE[c.shape], [ws, wh] = shape.waist, top = shape.dome;
  for (let i = 0; i < o.length; i++) {
    const [x0, y0] = o[i], [x1, y1] = o[(i + 1) % o.length];
    const a = at(x0, y0, 0), b = at(x1, y1, 0), d = at(x1 * ws, y1 * ws, wh), e = at(x0 * ws, y0 * ws, wh);
    emit(a, b, d); emit(a, d, e);
    if (!shape.table) { emit(e, d, at(0, 0, top)); continue; }
    // the table: a second ring of facets up to a flat top
    const f = at(x1 * 0.42, y1 * 0.42, top), g2 = at(x0 * 0.42, y0 * 0.42, top);
    emit(e, d, f); emit(e, f, g2); emit(g2, f, at(0, 0, top));
  }
}
