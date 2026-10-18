// Thin hair strands (brows, lashes) drawn as ribbons. Ribbons narrower than about a pixel are widened on
// screen and made proportionally more transparent, so fine hairs keep their coverage at any resolution.
import * as THREE from 'three';
import { LIGHT_GLSL, lightUniforms } from './lighting.js';

const vertexShader = /* glsl */ `
attribute vec3 offset;   // half-width vector across the ribbon
attribute vec3 tangent;
attribute vec3 color;
attribute vec2 st;       // s: -1/+1 across, t: 0 root .. 1 tip
uniform vec2 uViewport;
uniform float uMinPx;
varying vec3 vColor, vTangent, vPos, vNormalHint;
varying vec2 vSt;
varying float vCoverage;
void main() {
  vec4 c0 = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vec4 c1 = projectionMatrix * modelViewMatrix * vec4(position + offset, 1.0);
  vec2 d = (c1.xy / c1.w - c0.xy / c0.w) * 0.5 * uViewport;
  float px = length(d);
  float k = px < uMinPx ? uMinPx / max(px, 1e-4) : 1.0;
  vCoverage = 1.0 / k;
  vec3 p = position + offset * st.x * k;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vPos = mv.xyz;
  vTangent = normalize(normalMatrix * tangent);
  vNormalHint = normalize(normalMatrix * cross(tangent, offset));
  vColor = color; vSt = st;
  gl_Position = projectionMatrix * mv;
}`;

const fragmentShader = /* glsl */ `
${LIGHT_GLSL}
uniform float uOpacity, uSpec;
varying vec3 vColor, vTangent, vPos, vNormalHint;
varying vec2 vSt;
varying float vCoverage;
void main() {
  vec3 v = normalize(-vPos);
  vec3 T = normalize(vTangent);
  vec3 n = normalize(vNormalHint);
  if (dot(n, v) < 0.0) n = -n;
  vec3 col = vColor * ambient(n);
  for (int i = 0; i < 3; i++) {
    vec3 l = uLightDir[i];
    float TL = dot(T, l);
    float diff = sqrt(max(1.0 - TL * TL, 0.0)) * 0.6 + 0.4 * max(dot(n, l), 0.0);
    vec3 h = normalize(l + v);
    float TH = dot(T, h);
    float spec = pow(sqrt(max(1.0 - TH * TH, 0.0)), 60.0) * uSpec;
    col += uLightCol[i] * (vColor * diff * 0.75 + spec);
  }
  float edge = 1.0 - smoothstep(0.55, 1.0, abs(vSt.x));
  float tip = 1.0 - smoothstep(0.55, 1.0, vSt.y);
  float a = uOpacity * vCoverage * mix(1.0, edge, step(0.5, vCoverage)) * mix(0.35, 1.0, tip);
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createStrandMaterial({ opacity = 1, minPx = 0.6, spec = 0.12 } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader, fragmentShader,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { ...lightUniforms(), uOpacity: { value: opacity }, uSpec: { value: spec }, uViewport: { value: new THREE.Vector2(600, 800) }, uMinPx: { value: minPx } },
  });
}

// Builds ribbon geometry from strands: { points: [[x,y,z]...], widths: [...], up: [x,y,z] (ribbon normal hint), color: [r,g,b] }
export function buildStrandGeometry(strands, geometry = new THREE.BufferGeometry()) {
  let nv = 0, ni = 0;
  for (const s of strands) { nv += s.points.length * 2; ni += (s.points.length - 1) * 6; }
  const pos = new Float32Array(nv * 3), off = new Float32Array(nv * 3), tan = new Float32Array(nv * 3), col = new Float32Array(nv * 3), st = new Float32Array(nv * 2);
  const index = new Uint32Array(ni);
  let v = 0, n = 0;
  for (const s of strands) {
    const P = s.points, m = P.length;
    for (let k = 0; k < m; k++) {
      const a = P[Math.max(k - 1, 0)], b = P[Math.min(k + 1, m - 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2];
      const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      // across-ribbon direction: perpendicular to the strand and to the hint (camera or skin normal)
      const u = s.up;
      let ox = ty * u[2] - tz * u[1], oy = tz * u[0] - tx * u[2], oz = tx * u[1] - ty * u[0];
      const ol = Math.hypot(ox, oy, oz) || 1;
      const w = s.widths[k] / 2;
      ox *= w / ol; oy *= w / ol; oz *= w / ol;
      const t = k / (m - 1);
      for (const side of [-1, 1]) {
        pos.set(P[k], v * 3); off.set([ox, oy, oz], v * 3); tan.set([tx, ty, tz], v * 3); col.set(s.color, v * 3);
        st[v * 2] = side; st[v * 2 + 1] = t;
        v++;
      }
      if (k < m - 1) {
        const i0 = v - 2;
        index.set([i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2], n);
        n += 6;
      }
    }
  }
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute('offset', new THREE.BufferAttribute(off, 3));
  geometry.setAttribute('tangent', new THREE.BufferAttribute(tan, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geometry.setAttribute('st', new THREE.BufferAttribute(st, 2));
  geometry.computeBoundingSphere();
  return geometry;
}
