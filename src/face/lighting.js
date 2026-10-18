// The fixed "makeup station" lighting shared by every face material: a large soft key light just above
// the camera (ring light / softbox), a cooler fill from the side, a warm rim from behind, and a
// sky/ground ambient term. Directions are in view space because the camera never moves.
import * as THREE from 'three';

const dir = (x, y, z) => new THREE.Vector3(x, y, z).normalize();
export const LIGHTS = {
  dir: [dir(-0.25, 0.45, 1), dir(0.9, 0.15, 0.5), dir(-0.4, 0.5, -0.9)],
  col: [new THREE.Vector3(1.45, 1.4, 1.34), new THREE.Vector3(0.3, 0.33, 0.4), new THREE.Vector3(0.55, 0.48, 0.42)],
  sky: new THREE.Vector3(0.3, 0.3, 0.33),
  ground: new THREE.Vector3(0.13, 0.11, 0.1),
};

export function lightUniforms() {
  return {
    uLightDir: { value: LIGHTS.dir },
    uLightCol: { value: LIGHTS.col },
    uSky: { value: LIGHTS.sky },
    uGround: { value: LIGHTS.ground },
  };
}

// GLSL helpers: GGX specular and light declarations (view space)
export const LIGHT_GLSL = /* glsl */ `
uniform vec3 uLightDir[3];
uniform vec3 uLightCol[3];
uniform vec3 uSky, uGround;
float D_GGX(float NoH, float a) { float a2 = a * a; float d = NoH * NoH * (a2 - 1.0) + 1.0; return a2 / (3.14159 * d * d); }
float V_Smith(float NoV, float NoL, float a) { float k = a * 0.5; return 0.25 / ((NoV * (1.0 - k) + k) * (NoL * (1.0 - k) + k)); }
float F_Schlick(float f0, float VoH) { return f0 + (1.0 - f0) * pow(1.0 - VoH, 5.0); }
vec3 ambient(vec3 n) { return mix(uGround, uSky, 0.5 + 0.5 * n.y); }
// hash-based value noise and fbm, used for pores, freckles and fibres
float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p); vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1,0,0)), u.x), mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), u.x), u.y),
             mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), u.x), mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), u.x), u.y), u.z);
}
float fbm(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
// distance to the nearest random feature point of a cell grid (Worley), for freckles and pores
float worley(vec3 p, float seed) {
  vec3 i = floor(p), f = fract(p); float d = 1e9;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
    vec3 g = vec3(x, y, z); vec3 c = i + g;
    vec3 o = vec3(hash13(c + seed), hash13(c + seed + 17.3), hash13(c + seed + 41.7));
    d = min(d, length(g + o - f));
  }
  return d;
}
`;
