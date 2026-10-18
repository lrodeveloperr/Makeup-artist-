// Skin shader for the head surface. Natural features (lips, flush, under-eye tone, freckles, beauty marks,
// vitiligo) are evaluated per pixel in the reference-head coordinate frame, so every generated face
// carries them in the same anatomical places. Applied makeup arrives later through uPaint (UV space).
import * as THREE from 'three';
import { LIGHT_GLSL, lightUniforms } from './lighting.js';

const vertexShader = /* glsl */ `
attribute vec3 ref;
attribute float cavity;
attribute vec4 regionA; // lipLine, lidMargin, cheek, underEye
attribute vec4 regionB; // nose, ear, lips, interior
varying vec3 vPos, vNormal, vRef;
varying vec2 vUv;
varying float vCavity;
varying vec4 vRA, vRB;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vPos = mv.xyz;
  vNormal = normalize(normalMatrix * normal);
  vRef = ref; vUv = uv; vCavity = cavity; vRA = regionA; vRB = regionB;
  gl_Position = projectionMatrix * mv;
}`;

const fragmentShader = /* glsl */ `
${LIGHT_GLSL}
uniform vec3 uSkin, uLip, uLipInner;
uniform vec4 uMouth;   // halfWidth, lineCentre, lineCorner, upperCentre
uniform vec4 uMouth2;  // upperPeak, upperPeakAt, lower, -
uniform float uSeed, uFlush, uUnderEye, uOil;
uniform vec4 uFreckles;  // density, contrast, size, spread over the forehead
uniform vec3 uFreckleCol;
uniform vec4 uMoles[4];  // reference position + radius (0 = none)
uniform vec4 uVitiligo;  // amount, scale, seed, -
uniform vec3 uScalpTint;  // hair colour painted onto the scalp (fine hairs at the hairline, shading under the hair)
uniform float uScalpAmount;
uniform vec4 uScalp;     // hairline: front height, temple height, side height, softness
uniform vec4 uBrowA;     // brow shape: peak position, peak height, tail, rise exponent
uniform vec4 uBrowB;     // fall exponent, thickness, length, density
uniform vec3 uBrowCol;
uniform sampler2D uPaint;
uniform float uPaintOn;
varying vec3 vPos, vNormal, vRef;
varying vec2 vUv;
varying float vCavity;
varying vec4 vRA, vRB;

float lipMask(vec3 r) {
  float t = abs(r.x) / uMouth.x;
  if (t >= 1.0 || r.z < 0.0) return 0.0;
  float line = mix(uMouth.y, uMouth.z, t * t);
  float dy = r.y - line;
  float taperU = pow(max(1.0 - pow(t, 2.2), 0.0), 0.8);
  float up = (uMouth.w + (uMouth2.x - uMouth.w) * exp(-pow((t - uMouth2.y) / 0.17, 2.0)) * smoothstep(0.0, uMouth2.y, t)) * taperU;
  float lo = uMouth2.z * pow(max(1.0 - t * t * t, 0.0), 0.9);
  float e = max(fwidth(dy) * 1.2, 0.0035);
  return smoothstep(-e, e, up - dy) * smoothstep(-e, e, dy + lo);
}

// soft fill under the brow hairs (same shape as brows.js)
float browMask(vec3 r) {
  if (r.z < 0.0) return 0.0;
  float u = (abs(r.x) - 0.115) / (0.49 * uBrowB.z - 0.115);
  if (u < -0.1 || u > 1.1) return 0.0;
  float uc = clamp(u, 0.0, 1.0);
  float a = uc < uBrowA.x ? pow(sin(1.5708 * uc / uBrowA.x), uBrowA.w) : 1.0 - (1.0 - uBrowA.z) * pow((uc - uBrowA.x) / (1.0 - uBrowA.x), uBrowB.x);
  float y = 0.17 + uBrowA.y * a;
  float h = uBrowB.y * (0.06 * (1.0 - uc) + 0.03 * uc);
  if (uc > 0.72) h *= 1.0 - 0.65 * ((uc - 0.72) / 0.28);
  float d = abs(r.y - y) / (0.5 * h);
  return (1.0 - smoothstep(0.5, 1.1, d)) * smoothstep(-0.06, 0.04, u) * (1.0 - smoothstep(0.9, 1.04, u));
}

// approximate hairline in reference coordinates: 1 on the scalp, 0 on the face and ears
// (kept identical to scalpMask in hair.js)
float scalpMask(vec3 r) {
  vec3 c = r - vec3(0.0, 0.15, -0.6);
  float a = abs(atan(c.x, c.z));        // 0 = front
  float el = atan(c.y, length(c.xz));   // elevation
  // hairline height around the head: forehead, temple, sideburn, around the ear, nape
  float h = uScalp.x;
  h = mix(h, uScalp.y, smoothstep(0.0, 0.4, a));
  h = mix(h, uScalp.y - 0.3, smoothstep(0.4, 0.78, a));
  h = mix(h, uScalp.z - 0.3, smoothstep(0.78, 0.98, a));
  h = mix(h, uScalp.z, smoothstep(0.98, 1.12, a));
  h = mix(h, -0.25, smoothstep(1.45, 1.62, a));
  h = mix(h, -0.6, smoothstep(1.62, 2.0, a));
  h = mix(h, -0.95, smoothstep(2.0, 2.6, a));
  return smoothstep(-uScalp.w, uScalp.w, el - h) * (1.0 - smoothstep(0.86, 0.96, vRB.y));
}

void main() {
  vec3 r = vRef;
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  vec3 v = normalize(-vPos);
  float interior = vRB.w;

  // --- micro relief: pores and fine texture as a bump on the normal ---
  float hgt = 0.6 * (1.0 - worley(r * 160.0, uSeed)) + 0.4 * fbm(r * 90.0 + uSeed);
  vec3 dpdx = dFdx(vPos), dpdy = dFdy(vPos);
  float dhx = dFdx(hgt), dhy = dFdy(hgt);
  vec3 r1 = cross(dpdy, n), r2 = cross(n, dpdx);
  float det = dot(dpdx, r1);
  vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
  float poreStrength = 0.0009 * (1.0 - vRB.z) * (1.0 - interior);
  n = normalize(abs(det) * n - poreStrength * grad);

  // --- albedo ---
  vec3 skin = uSkin * (0.94 + 0.12 * fbm(r * 6.0 + uSeed));
  // redness on cheeks, nose and ears; darker tone around the eyes
  vec3 flushCol = skin * vec3(1.12, 0.74, 0.76);
  skin = mix(skin, flushCol, clamp(uFlush * (vRA.z * 0.9 + vRB.x * 0.55), 0.0, 1.0));
  float periorbital = vRA.w * 0.8 + (1.0 - smoothstep(0.0, 0.22, vRA.y)) * 0.45;
  skin *= mix(vec3(1.0), vec3(0.8, 0.74, 0.8), clamp(uUnderEye * periorbital, 0.0, 1.0));
  // freckles: sparse spots over the nose and cheeks, optionally the forehead
  if (uFreckles.x > 0.0) {
    float w = worley(r * (55.0 / uFreckles.z), uSeed + 3.0);
    float spot = 1.0 - smoothstep(0.08, 0.2, w);
    float place = clamp(vRA.z * 1.3 + vRB.x * 1.2 + uFreckles.w * smoothstep(0.25, 0.6, r.y) * (1.0 - scalpMask(r)), 0.0, 1.0);
    float keep = step(1.0 - uFreckles.x, hash13(floor(r * (55.0 / uFreckles.z)) + uSeed));
    skin = mix(skin, uFreckleCol, spot * place * keep * uFreckles.y);
  }
  // beauty marks
  for (int i = 0; i < 4; i++) {
    if (uMoles[i].w <= 0.0) continue;
    float d = length(r - uMoles[i].xyz) / uMoles[i].w;
    skin = mix(skin, uFreckleCol * 0.45, (1.0 - smoothstep(0.7, 1.0, d)) * 0.9);
  }
  // vitiligo: depigmented patches with soft, irregular edges
  if (uVitiligo.x > 0.0) {
    float f = fbm(r * uVitiligo.y + uVitiligo.z) + 0.15 * fbm(r * uVitiligo.y * 4.0);
    float bias = (1.0 - smoothstep(0.0, 0.25, vRA.y)) * 0.15 + (1.0 - smoothstep(0.0, 0.2, vRA.x)) * 0.12;
    float patchMask = smoothstep(0.7 - uVitiligo.x * 0.3 - bias, 0.73 - uVitiligo.x * 0.3 - bias, f);
    skin = mix(skin, vec3(0.74, 0.52, 0.46), patchMask);
  }
  // brow fill: the skin tint between and under the brow hairs
  float brow = browMask(r) * uBrowB.w * (0.6 + 0.4 * fbm(r * 140.0 + uSeed));
  skin = mix(skin, uBrowCol, brow * 0.45);
  // natural lips
  float lip = lipMask(r) * (1.0 - interior);
  float innerLip = lip * (1.0 - smoothstep(0.0, 0.045, vRA.x));
  vec3 lipCol = mix(uLip, uLipInner, innerLip);
  skin = mix(skin, lipCol, lip);
  // inside the mouth and eye sockets: wet, dark pink
  skin = mix(skin, vec3(0.25, 0.06, 0.06), interior);
  // scalp under hair: slightly darker where hair roots shade it
  // hair painted onto the scalp: fine strands combed back at the hairline, denser further in, so the
  // hair layer above never shows a hard edge
  float sc = scalpMask(r);
  float strands = vnoise(vec3(r.x * 520.0, r.y * 45.0 + r.z * 45.0, r.z * 520.0) + uSeed);
  float paintHair = sc * smoothstep(0.25 - 0.25 * sc, 0.6 - 0.2 * sc, strands);
  skin = mix(skin, uScalpTint, uScalpAmount * clamp(paintHair + sc * sc * 0.6, 0.0, 1.0));

  // --- applied makeup (premultiplied colour in UV space) ---
  vec4 paint = uPaintOn > 0.5 ? texture2D(uPaint, vUv) : vec4(0.0);
  vec3 albedo = skin * (1.0 - paint.a) + paint.rgb;

  // --- lighting ---
  float ao = 1.0 - 0.55 * smoothstep(0.0, 0.05, vCavity);
  ao *= 1.0 - 0.6 * interior;
  float NoV = max(dot(n, v), 1e-3);
  float rough = mix(0.6, 0.47, uOil * (vRB.x + 0.6 * smoothstep(0.35, 0.75, r.y) * (1.0 - scalpMask(r))));
  rough = mix(rough, 0.28, lip);
  vec3 diffuse = ambient(n) * ao;
  vec3 spec = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    vec3 l = uLightDir[i];
    float NoL = dot(n, l);
    // wrapped diffuse with a red-shifted wrap: a cheap stand-in for light scattering under the skin
    vec3 wrap = vec3(0.42, 0.24, 0.18);
    vec3 d = clamp((vec3(NoL) + wrap) / (1.0 + wrap), 0.0, 1.0);
    d *= d * (3.0 - 2.0 * d) * 0.6 + 0.4 * d;
    diffuse += uLightCol[i] * d * mix(1.0, ao, 0.5);
    float nl = max(NoL, 0.0);
    if (nl > 0.0) {
      vec3 h = normalize(l + v);
      float NoH = max(dot(n, h), 0.0), VoH = max(dot(v, h), 0.0);
      float s = 0.0;
      s += 0.9 * D_GGX(NoH, rough * rough) * V_Smith(NoV, nl, rough * rough);
      s += 0.1 * D_GGX(NoH, 0.25 * 0.25) * V_Smith(NoV, nl, 0.25 * 0.25);
      spec += uLightCol[i] * s * F_Schlick(0.028, VoH) * nl * ao;
    }
  }
  vec3 col = albedo * diffuse + 0.5 * spec * (1.0 - paint.a * 0.4);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createSkinMaterial() {
  const emptyPaint = new THREE.DataTexture(new Uint8Array(4), 1, 1);
  emptyPaint.needsUpdate = true;
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    side: THREE.DoubleSide,
    uniforms: {
      ...lightUniforms(),
      uSkin: { value: new THREE.Vector3(0.5, 0.3, 0.2) },
      uLip: { value: new THREE.Vector3(0.4, 0.15, 0.13) },
      uLipInner: { value: new THREE.Vector3(0.4, 0.15, 0.13) },
      uMouth: { value: new THREE.Vector4() },
      uMouth2: { value: new THREE.Vector4() },
      uSeed: { value: 0 },
      uFlush: { value: 0.3 },
      uUnderEye: { value: 0.3 },
      uOil: { value: 0.5 },
      uFreckles: { value: new THREE.Vector4(0, 0, 1, 0) },
      uFreckleCol: { value: new THREE.Vector3(0.2, 0.1, 0.06) },
      uMoles: { value: [0, 1, 2, 3].map(() => new THREE.Vector4()) },
      uVitiligo: { value: new THREE.Vector4() },
      uScalpTint: { value: new THREE.Vector3(1, 1, 1) },
      uScalpAmount: { value: 0 },
      uScalp: { value: new THREE.Vector4(0.78, 0.5, 0.08, 0.03) },
      uBrowA: { value: new THREE.Vector4(0.64, 0.06, 0.15, 1) },
      uBrowB: { value: new THREE.Vector4(1.2, 1, 1, 0.8) },
      uBrowCol: { value: new THREE.Vector3(0.03, 0.02, 0.015) },
      uPaint: { value: emptyPaint },
      uPaintOn: { value: 0 },
    },
  });
}

export function setMouthLandmarks(material, m) {
  material.uniforms.uMouth.value.set(m.halfWidth, m.lineCentre, m.lineCorner, m.upperCentre);
  material.uniforms.uMouth2.value.set(m.upperPeak, m.upperPeakAt, m.lower, 0);
}
