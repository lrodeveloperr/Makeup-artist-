// A minimal WebGL2 renderer for the face scene. It covers only what the game needs: custom shader
// materials, indexed meshes, a perspective camera, opaque and alpha-blended drawing, and
// neutral tone mapping to sRGB. The names follow Three.js so the face code reads the same, but this
// replaces a ~500 KB library with a few KB (load time on YouTube Playables).

export const FrontSide = 0, BackSide = 1, DoubleSide = 2;

// ---------------- small vector types ----------------
class Vec extends Float32Array {
  set(...a) { if (a.length === 1 && typeof a[0] !== 'number') super.set(a[0]); else super.set(a); return this; }
  copy(v) { super.set(v); return this; }
  clone() { return new this.constructor().copy(this); }
  setScalar(s) { this.fill(s); return this; }
  add(v) { for (let i = 0; i < this.length; i++) this[i] += v[i]; return this; }
  sub(v) { for (let i = 0; i < this.length; i++) this[i] -= v[i]; return this; }
  multiplyScalar(s) { for (let i = 0; i < this.length; i++) this[i] *= s; return this; }
  normalize() { return this.multiplyScalar(1 / (Math.hypot(...this) || 1)); }
  get x() { return this[0]; } set x(v) { this[0] = v; }
  get y() { return this[1]; } set y(v) { this[1] = v; }
}
export class Vector2 extends Vec { constructor(x = 0, y = 0) { super(2); this[0] = x; this[1] = y; } }
export class Vector3 extends Vec {
  constructor(x = 0, y = 0, z = 0) { super(3); this[0] = x; this[1] = y; this[2] = z; }
  get z() { return this[2]; } set z(v) { this[2] = v; }
  // rotate about a unit axis (Rodrigues)
  applyAxisAngle(k, a) {
    const c = Math.cos(a), s = Math.sin(a), [x, y, z] = this, d = (k[0] * x + k[1] * y + k[2] * z) * (1 - c);
    return this.set(x * c + (k[1] * z - k[2] * y) * s + k[0] * d, y * c + (k[2] * x - k[0] * z) * s + k[1] * d, z * c + (k[0] * y - k[1] * x) * s + k[2] * d);
  }
}
export class Vector4 extends Vec {
  constructor(x = 0, y = 0, z = 0, w = 0) { super(4); this.set(x, y, z, w); }
  get z() { return this[2]; } set z(v) { this[2] = v; }
  get w() { return this[3]; } set w(v) { this[3] = v; }
}
export class Color extends Vector3 { constructor(hex = 0) { super(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255); this.set(...[...this].map(srgbToLinear)); } }
const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

// ---------------- matrices (column-major, as WebGL expects) ----------------
const m4 = () => new Float32Array(16);
function mul4(a, b, out = m4()) {
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  }
  return out;
}
// rotation whose +z axis points from `eye` towards `target` (object) or away from it (camera)
function basis(eye, target, flip) {
  let z = [target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]];
  if (flip) z = z.map((v) => -v);
  const zl = Math.hypot(...z) || 1; z = z.map((v) => v / zl);
  let x = [z[2], 0, -z[0]]; // up (0,1,0) x z
  const xl = Math.hypot(...x) || 1; x = x.map((v) => v / xl);
  const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  return [x, y, z];
}
function normalMatrix(mv, out) {
  // inverse transpose of the upper 3x3
  const a = mv[0], b = mv[1], c = mv[2], d = mv[4], e = mv[5], f = mv[6], g = mv[8], h = mv[9], i = mv[10];
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C || 1;
  out[0] = A / det; out[1] = B / det; out[2] = C / det;
  out[3] = -(b * i - c * h) / det; out[4] = (a * i - c * g) / det; out[5] = -(a * h - b * g) / det;
  out[6] = (b * f - c * e) / det; out[7] = -(a * f - c * d) / det; out[8] = (a * e - b * d) / det;
  return out;
}

// ---------------- scene objects ----------------
export class Object3D {
  constructor() {
    this.position = new Vector3(); this.scale = new Vector3(1, 1, 1);
    this.rotation = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]; // columns: x, y, z axes
    this.children = []; this.visible = true; this.renderOrder = 0;
  }
  add(...objects) { this.children.push(...objects); return this; }
  clear() { this.children.length = 0; return this; }
  lookAt(target) { this.rotation = basis(this.position, target, false); }
  matrix() {
    const [x, y, z] = this.rotation, s = this.scale, p = this.position;
    return Float32Array.of(x[0] * s[0], x[1] * s[0], x[2] * s[0], 0, y[0] * s[1], y[1] * s[1], y[2] * s[1], 0, z[0] * s[2], z[1] * s[2], z[2] * s[2], 0, p[0], p[1], p[2], 1);
  }
}
export class Group extends Object3D {}
export class Scene extends Object3D { constructor() { super(); this.background = new Vector3(); } }
export class Mesh extends Object3D { constructor(geometry, material) { super(); this.geometry = geometry; this.material = material; } }

export class PerspectiveCamera extends Object3D {
  constructor(fov = 50, aspect = 1, near = 0.1, far = 100) {
    super(); this.fov = fov; this.aspect = aspect; this.near = near; this.far = far; this.target = new Vector3();
    this.projection = m4(); this.updateProjectionMatrix();
  }
  lookAt(target) { this.target.copy(target); }
  updateProjectionMatrix() {
    const f = 1 / Math.tan((this.fov * Math.PI) / 360), n = this.near, fa = this.far, p = this.projection;
    p.fill(0); p[0] = f / this.aspect; p[5] = f; p[10] = (fa + n) / (n - fa); p[11] = -1; p[14] = (2 * fa * n) / (n - fa);
  }
  view() {
    const [x, y, z] = basis(this.position, this.target, true), e = this.position;
    const dot = (a) => a[0] * e[0] + a[1] * e[1] + a[2] * e[2];
    return Float32Array.of(x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x), -dot(y), -dot(z), 1);
  }
}

// ---------------- geometry and materials ----------------
export class BufferAttribute {
  constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; this.version = 0; }
  set needsUpdate(v) { if (v) this.version++; }
}
export class Float32BufferAttribute extends BufferAttribute { constructor(array, itemSize) { super(Float32Array.from(array), itemSize); } }
let geometryIds = 0;
export class BufferGeometry {
  constructor() { this.id = ++geometryIds; this.attributes = {}; this.index = null; this.disposed = false; }
  setAttribute(name, attr) { this.attributes[name] = attr; return this; }
  setIndex(index) { this.index = Array.isArray(index) ? new BufferAttribute(Uint32Array.from(index), 1) : index; return this; }
  dispose() { this.disposed = true; }
}
// unit sphere with its poles on +z / -z
export class SphereGeometry extends BufferGeometry {
  constructor(radius = 1, segs = 32, rings = 16) {
    super();
    const pos = [], idx = [];
    for (let j = 0; j <= rings; j++) for (let i = 0; i <= segs; i++) {
      const v = (j / rings) * Math.PI, u = (i / segs) * 2 * Math.PI;
      pos.push(radius * Math.sin(v) * Math.cos(u), radius * Math.sin(v) * Math.sin(u), radius * Math.cos(v));
    }
    for (let j = 0; j < rings; j++) for (let i = 0; i < segs; i++) {
      const a = j * (segs + 1) + i, b = a + segs + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1); // counter-clockwise seen from outside
    }
    this.setAttribute('position', new Float32BufferAttribute(pos, 3));
    this.setAttribute('normal', new Float32BufferAttribute(pos.map((p) => p / radius), 3));
    this.setIndex(idx);
  }
}
export class DataTexture {
  constructor(data, width, height) { this.data = data; this.width = width; this.height = height; this.version = 0; }
  set needsUpdate(v) { if (v) this.version++; }
}
let materialIds = 0;
export class ShaderMaterial {
  constructor({ vertexShader, fragmentShader, uniforms = {}, transparent = false, depthWrite = true, side = FrontSide } = {}) {
    Object.assign(this, { vertexShader, fragmentShader, uniforms, transparent, depthWrite, side });
    this.id = ++materialIds;
  }
  clone() {
    const copy = (v) => (v instanceof Float32Array ? v.clone() : Array.isArray(v) ? v.map(copy) : v);
    const uniforms = Object.fromEntries(Object.entries(this.uniforms).map(([k, u]) => [k, { value: copy(u.value) }]));
    return new ShaderMaterial({ ...this, uniforms });
  }
}

// ---------------- renderer ----------------
const PRELUDE = `#version 300 es
precision highp float;
precision highp int;
#define texture2D texture
`;
const VERTEX_PRELUDE = `${PRELUDE}#define attribute in
#define varying out
uniform mat4 modelViewMatrix, projectionMatrix;
uniform mat3 normalMatrix;
in vec3 position;
in vec3 normal;
in vec2 uv;
`;
const FRAGMENT_PRELUDE = `${PRELUDE}#define varying in
out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
// Khronos PBR Neutral tone mapping, then the sRGB transfer function
vec3 neutralToneMap(vec3 color) {
  const float start = 0.76, desaturation = 0.15;
  float x = min(color.r, min(color.g, color.b));
  float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  color -= offset;
  float peak = max(color.r, max(color.g, color.b));
  if (peak < start) return color;
  float d = 1.0 - start;
  float newPeak = 1.0 - d * d / (peak + d - start);
  color *= newPeak / peak;
  float g = 1.0 - 1.0 / (desaturation * (peak - newPeak) + 1.0);
  return mix(color, vec3(newPeak), g);
}
vec3 linearToSRGB(vec3 c) { return mix(c * 12.92, pow(c, vec3(0.41666)) * 1.055 - 0.055, step(0.0031308, c)); }
`;
const OUTPUT = { '#include <tonemapping_fragment>': 'gl_FragColor.rgb = neutralToneMap(gl_FragColor.rgb);', '#include <colorspace_fragment>': 'gl_FragColor.rgb = linearToSRGB(gl_FragColor.rgb);' };

export class WebGLRenderer {
  constructor({ canvas, antialias = true, preserveDrawingBuffer = false } = {}) {
    this.domElement = canvas || document.createElement('canvas');
    const gl = this.domElement.getContext('webgl2', { antialias, alpha: false, preserveDrawingBuffer, premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL2 is not available');
    this.gl = gl;
    this.pixelRatio = 1;
    this.programs = new Map(); this.buffers = new Map(); this.vaos = new Map(); this.textures = new Map();
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    gl.frontFace(gl.CCW);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }
  setPixelRatio(r) { this.pixelRatio = r; }
  setSize(w, h, updateStyle = true) {
    this.domElement.width = Math.floor(w * this.pixelRatio); this.domElement.height = Math.floor(h * this.pixelRatio);
    if (updateStyle) { this.domElement.style.width = w + 'px'; this.domElement.style.height = h + 'px'; }
  }
  getDrawingBufferSize(out = new Vector2()) { return out.set(this.gl.drawingBufferWidth, this.gl.drawingBufferHeight); }

  // one GL program per distinct shader source
  program(material) {
    const key = material.vertexShader + '\0' + material.fragmentShader;
    let p = this.programs.get(key);
    if (p) return p;
    const gl = this.gl;
    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s));
      return s;
    };
    let fs = material.fragmentShader;
    for (const [k, v] of Object.entries(OUTPUT)) fs = fs.replace(k, v);
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERTEX_PRELUDE + material.vertexShader));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAGMENT_PRELUDE + fs));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('program: ' + gl.getProgramInfoLog(prog));
    const uniforms = {};
    for (let i = 0; i < gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS); i++) {
      const info = gl.getActiveUniform(prog, i);
      uniforms[info.name.replace(/\[0\]$/, '')] = { loc: gl.getUniformLocation(prog, info.name), type: info.type, size: info.size };
    }
    const attributes = {};
    for (let i = 0; i < gl.getProgramParameter(prog, gl.ACTIVE_ATTRIBUTES); i++) {
      const info = gl.getActiveAttrib(prog, i);
      attributes[info.name] = gl.getAttribLocation(prog, info.name);
    }
    p = { id: this.programs.size + 1, prog, uniforms, attributes };
    this.programs.set(key, p);
    return p;
  }

  buffer(attr, target) {
    const gl = this.gl;
    let b = this.buffers.get(attr);
    if (!b) { b = { buf: gl.createBuffer(), version: -1 }; this.buffers.set(attr, b); }
    if (b.version !== attr.version) {
      gl.bindBuffer(target, b.buf);
      gl.bufferData(target, attr.array, b.version === -1 ? gl.STATIC_DRAW : gl.DYNAMIC_DRAW);
      b.version = attr.version;
    }
    return b.buf;
  }

  vao(geometry, p) {
    const gl = this.gl, key = geometry.id + ':' + p.id;
    let entry = this.vaos.get(key);
    const versions = Object.values(geometry.attributes).map((a) => a.version).join(',') + ';' + (geometry.index ? geometry.index.version : '');
    if (!entry) { entry = { vao: gl.createVertexArray(), geometry, versions: null }; this.vaos.set(key, entry); }
    gl.bindVertexArray(entry.vao);
    if (entry.versions !== versions || entry.indexAttr !== geometry.index) {
      for (const [name, loc] of Object.entries(p.attributes)) {
        const attr = geometry.attributes[name];
        if (!attr || loc < 0) { if (loc >= 0) gl.disableVertexAttribArray(loc); continue; }
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer(attr, gl.ARRAY_BUFFER));
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, attr.itemSize, gl.FLOAT, false, 0, 0);
      }
      if (geometry.index) gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffer(geometry.index, gl.ELEMENT_ARRAY_BUFFER));
      entry.versions = versions; entry.indexAttr = geometry.index;
    }
    return entry;
  }

  texture(tex, unit) {
    const gl = this.gl;
    let t = this.textures.get(tex);
    if (!t) { t = { tex: gl.createTexture(), version: -1 }; this.textures.set(tex, t); }
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    if (t.version !== tex.version) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, tex.width, tex.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, tex.data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      t.version = tex.version;
    }
  }

  setUniforms(p, material, builtins) {
    const gl = this.gl;
    let unit = 0;
    for (const [name, u] of Object.entries(p.uniforms)) {
      const value = name in builtins ? builtins[name] : material.uniforms[name]?.value;
      if (value === undefined) continue;
      const flat = Array.isArray(value) ? Float32Array.from(value.flatMap((v) => [...v])) : value;
      switch (u.type) {
        case gl.FLOAT: gl.uniform1f(u.loc, value); break;
        case gl.INT: case gl.BOOL: gl.uniform1i(u.loc, value); break;
        case gl.FLOAT_VEC2: gl.uniform2fv(u.loc, flat); break;
        case gl.FLOAT_VEC3: gl.uniform3fv(u.loc, flat); break;
        case gl.FLOAT_VEC4: gl.uniform4fv(u.loc, flat); break;
        case gl.FLOAT_MAT3: gl.uniformMatrix3fv(u.loc, false, value); break;
        case gl.FLOAT_MAT4: gl.uniformMatrix4fv(u.loc, false, value); break;
        case gl.SAMPLER_2D: this.texture(value, unit); gl.uniform1i(u.loc, unit++); break;
        default: break;
      }
    }
  }

  // free GPU buffers of geometries that were disposed
  collect() {
    const gl = this.gl;
    for (const [key, entry] of this.vaos) {
      if (!entry.geometry.disposed) continue;
      gl.deleteVertexArray(entry.vao);
      for (const a of [...Object.values(entry.geometry.attributes), entry.geometry.index]) {
        const b = a && this.buffers.get(a);
        if (b) { gl.deleteBuffer(b.buf); this.buffers.delete(a); }
      }
      this.vaos.delete(key);
    }
  }

  render(scene, camera) {
    const gl = this.gl;
    this.collect();
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    const bg = scene.background;
    gl.clearColor(...linearBackground(bg), 1);
    gl.depthMask(true);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const view = camera.view();
    const items = [];
    const walk = (o, parentVisible) => {
      if (!o.visible || !parentVisible) return;
      if (o.geometry && o.material) items.push(o);
      for (const c of o.children) walk(c, true);
    };
    walk(scene, true);
    let n = 0;
    for (const o of items) { o.__order = n++; o.__mv = mul4(view, o.matrix()); }
    const opaque = items.filter((o) => !o.material.transparent).sort((a, b) => a.renderOrder - b.renderOrder || a.__order - b.__order);
    const transparent = items.filter((o) => o.material.transparent).sort((a, b) => a.renderOrder - b.renderOrder || a.__mv[14] - b.__mv[14]);
    const nm = new Float32Array(9);
    const draw = (o, side) => {
      const p = this.program(o.material);
      gl.useProgram(p.prog);
      this.setUniforms(p, o.material, { modelViewMatrix: o.__mv, projectionMatrix: camera.projection, normalMatrix: normalMatrix(o.__mv, nm) });
      if (side === DoubleSide) gl.disable(gl.CULL_FACE);
      else { gl.enable(gl.CULL_FACE); gl.cullFace(side === FrontSide ? gl.BACK : gl.FRONT); }
      gl.depthMask(o.material.depthWrite);
      this.vao(o.geometry, p);
      const g = o.geometry;
      if (g.index) gl.drawElements(gl.TRIANGLES, g.index.array.length, g.index.array instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0);
      else gl.drawArrays(gl.TRIANGLES, 0, g.attributes.position.array.length / 3);
    };
    gl.disable(gl.BLEND);
    for (const o of opaque) draw(o, o.material.side);
    gl.enable(gl.BLEND);
    for (const o of transparent) {
      // double-sided transparent surfaces: back faces first, then front faces
      if (o.material.side === DoubleSide) { draw(o, BackSide); draw(o, FrontSide); } else draw(o, o.material.side);
    }
    gl.bindVertexArray(null);
  }
}
// the clear colour is written as-is, so convert the linear background to sRGB like the shaders' output
const linearBackground = (c) => [...c].map((v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055));
