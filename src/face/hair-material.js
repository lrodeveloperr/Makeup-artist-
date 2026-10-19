// Hair shading. Surfaces carry a flow direction (the way the hair lies) and a root-to-tip coordinate; the pattern
// (strands, waves, curls, braids, locs or cornrows) is procedural, so no hair textures are shipped.
import * as GL from '../gl/mini.js';
import { LIGHT_GLSL, lightUniforms } from './lighting.js';

export const HAIR_MODE = { strands: 0, wavy: 1, curly: 2, braid: 3, loc: 4, cornrows: 5 };

const vertexShader = /* glsl */ `
attribute vec3 flow;
attribute vec4 hair;   // x: root(0)..tip(1), y: alpha, z: strand id / tube angle, w: shade
varying vec3 vPos, vNormal, vFlow, vObj;
varying vec4 vHair;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vPos = mv.xyz;
  vObj = position;
  vNormal = normalize(normalMatrix * normal);
  vFlow = normalMatrix * flow; // normalised per pixel (it can be very short where flows meet)
  vHair = hair;
  gl_Position = projectionMatrix * mv;
}`;

const fragmentShader = /* glsl */ `
${LIGHT_GLSL}
uniform int uMode;
uniform vec3 uRoot, uMid, uTip;
uniform float uSeed, uShine;
uniform vec4 uHairline; // front, temple and side heights and softness; softness 0 = no per-pixel hairline
uniform vec2 uAlphaCut;  // this pass draws only fragments with cut.x <= alpha < cut.y
varying vec3 vPos, vNormal, vFlow, vObj;
varying vec4 vHair;

// the hairline seen from its centre (as scalpMask in hair.js): surfaces built outwards from that centre
// (hood) get a hairline edge that is smooth at any mesh resolution, broken up a little like real hair
float hairlineMask(vec3 q) {
  vec3 c = q - vec3(0.0, 0.15, -0.6);
  float a = abs(atan(c.x, c.z));
  float el = atan(c.y, length(c.xz));
  float h = uHairline.x;
  h = mix(h, uHairline.y, smoothstep(0.0, 0.4, a));
  h = mix(h, uHairline.y - 0.3, smoothstep(0.4, 0.78, a));
  h = mix(h, uHairline.z - 0.3, smoothstep(0.78, 0.98, a));
  h = mix(h, uHairline.z, smoothstep(0.98, 1.12, a));
  h = mix(h, -0.25, smoothstep(1.45, 1.62, a));
  h = mix(h, -0.6, smoothstep(1.62, 2.0, a));
  h = mix(h, -0.95, smoothstep(2.0, 2.6, a));
  float wisps = vnoise(vec3(a * 90.0, el * 6.0, uSeed)) - 0.5;
  return smoothstep(-uHairline.w, uHairline.w, el - h - 0.02 + 0.035 * wisps);
}

void main() {
  vec3 v = normalize(-vPos);
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  // guard every normalisation: a zero-length flow or tangent would give NaN, which shows as bright
  // speckles through the semi-transparent layers in front of it
  vec3 F = dot(vFlow, vFlow) > 1e-10 ? normalize(vFlow) : vec3(0.0, -1.0, 0.0);
  vec3 tf = F - n * dot(F, n);
  if (dot(tf, tf) < 1e-6) tf = cross(n, abs(n.x) < 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0));
  vec3 T = normalize(tf);
  vec3 B = cross(n, T);
  vec3 p = vObj;
  float alpha = vHair.y;
  if (uHairline.w > 0.0) alpha *= hairlineMask(vObj);
  float shade = vHair.w;
  float t = vHair.x;
  vec3 base = mix(uRoot, uMid, smoothstep(0.0, 0.35, t));
  base = mix(base, uTip, smoothstep(0.45, 1.0, t));
  float spec = uShine;
  float bump = 0.0;
  float along = dot(p, F);
  vec3 perp = p - F * along;

  if (uMode <= 1) {
    // strands: noise stretched along the flow, grouped into soft clumps
    float clump = fbm(perp * 22.0 + vec3(along * 0.6) + uSeed);
    float s = fbm(perp * 140.0 + vec3(along * 3.0) + uSeed) * 0.65 + 0.35 * vnoise(perp * 420.0 + along * 6.0);
    base *= (0.72 + 0.4 * clump) * (0.82 + 0.28 * s);
    bump = 0.6 * clump + 0.4 * s;
    if (uMode == 1) base *= 0.93 + 0.12 * sin(along * 40.0 + fbm(perp * 8.0) * 6.0);
  } else if (uMode == 2) {
    // curls: ringlets as twisted clumps
    float c = worley(p * 26.0, uSeed);
    float twist = sin(along * 90.0 + atan(dot(perp, B), dot(perp, n)) * 3.0 + c * 12.0);
    base *= 0.55 + 0.35 * smoothstep(0.05, 0.6, c) + 0.2 * twist;
    bump = c + 0.2 * twist; spec *= 0.6;
  } else if (uMode == 3 || uMode == 4) {
    // braids / locs: tubes with an angle coordinate in hair.z
    float ang = vHair.z;
    if (uMode == 3) {
      float b = fract(t * 46.0 + (fract(ang / 6.2832) < 0.5 ? 0.0 : 0.5));
      float ridge = sin(3.14159 * b);
      base *= 0.45 + 0.75 * ridge;
      bump = ridge;
    } else {
      float r = fbm(vec3(t * 60.0, ang * 1.5, uSeed)) ;
      base *= 0.55 + 0.6 * r;
      bump = r; spec *= 0.4;
    }
  } else if (uMode == 5) {
    // cornrows: raised braided rows running front to back, with scalp showing between the rows
    float az = atan(vObj.x, vObj.z + 0.6);
    float row = az * 5.2 + 0.5;
    float f = fract(row);
    float ridge = smoothstep(0.08, 0.3, f) * (1.0 - smoothstep(0.7, 0.92, f));
    float el = atan(vObj.y - 0.15, length(vObj.xz + vec2(0.0, 0.6)));
    float weave = sin(3.14159 * fract(el * 16.0 + (f < 0.5 ? 0.0 : 0.5)));
    float roundness = sin(3.14159 * clamp((f - 0.08) / 0.84, 0.0, 1.0));
    base *= (0.4 + 0.7 * roundness) * (0.7 + 0.3 * weave);
    alpha *= ridge;
    bump = roundness * weave;
  }
  // soft, slightly broken silhouettes for curly hair
  if (uMode == 2) alpha *= smoothstep(0.05, 0.35, abs(dot(n, v)) + 0.25 * vnoise(p * 160.0));
  if (!gl_FrontFacing) shade *= 0.3;
  if (alpha < uAlphaCut.x || alpha >= uAlphaCut.y) discard;

  // normal from the pattern
  vec3 nb = normalize(n + B * (bump - 0.5) * 0.3);
  vec3 col = base * ambient(nb) * shade;
  for (int i = 0; i < 3; i++) {
    vec3 l = uLightDir[i];
    vec3 h = normalize(l + v);
    // Kajiya-Kay: diffuse and two shifted highlights along the strand direction; the second
    // highlight is tinted by the hair colour, the first is kept faint so dark hair stays dark
    float TL = dot(T, l);
    float diff = mix(max(dot(nb, l), 0.0), sqrt(max(1.0 - TL * TL, 0.0)), 0.35) * 0.9 + 0.1;
    vec3 T1 = normalize(T + nb * 0.1), T2 = normalize(T - nb * 0.1);
    float th1 = dot(T1, h), th2 = dot(T2, h);
    float lit = max(dot(nb, l) + 0.25, 0.0);
    float s = (pow(sqrt(max(1.0 - th1 * th1, 0.0)), 70.0) * 0.035) * lit;
    col += uLightCol[i] * pow(sqrt(max(1.0 - th2 * th2, 0.0)), 18.0) * 0.35 * lit * spec * min(base * 3.0, vec3(1.0)) * shade;
    col += uLightCol[i] * (base * diff + s * spec) * shade;
  }
  gl_FragColor = vec4(clamp(col, 0.0, 8.0), clamp(alpha, 0.0, 1.0));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createHairMaterial() {
  return new GL.ShaderMaterial({
    vertexShader, fragmentShader,
    side: GL.DoubleSide,
    transparent: true,
    alphaToCoverage: false,
    uniforms: {
      ...lightUniforms(),
      uMode: { value: 0 },
      uRoot: { value: new GL.Vector3() }, uMid: { value: new GL.Vector3() }, uTip: { value: new GL.Vector3() },
      uSeed: { value: 0 }, uShine: { value: 1 },
      uHairline: { value: new GL.Vector4(0, 0, 0, 0) },
      uAlphaCut: { value: new GL.Vector2(0.02, 2) },
    },
  });
}
