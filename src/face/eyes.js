// Eyeballs placed in the head's eye sockets (from MakeHuman's eye helper geometry), with a procedural
// iris. Iris colours come from the face profile; contact lenses later override the same uniforms.
import * as GL from '../gl/mini.js';
import { LIGHT_GLSL, lightUniforms } from './lighting.js';
import { hexToLinear } from './colors.js';

const vertexShader = /* glsl */ `
varying vec3 vObj, vPos, vNormal;
void main() {
  vObj = normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vPos = mv.xyz;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
}`;

const fragmentShader = /* glsl */ `
${LIGHT_GLSL}
uniform vec3 uIris[4];
uniform float uSeed, uIrisSize, uPupil, uLimbal;
uniform vec3 uSclera;
varying vec3 vObj, vPos, vNormal;
void main() {
  vec3 p = vObj;                  // unit sphere, +z = gaze direction
  vec3 v = normalize(-vPos);
  vec3 n = normalize(vNormal);
  float rho = length(p.xy) / uIrisSize;   // 0 at the pupil centre, 1 at the iris edge
  float front = step(0.0, p.z);
  float ang = atan(p.y, p.x);
  // iris: radial fibres, a collarette ring, a few darker crypts, and a dark limbal ring at the edge
  float fib = fbm(vec3(ang * 14.0, rho * 2.5, uSeed)) * 0.55 + 0.45 * fbm(vec3(ang * 37.0, rho * 5.0, uSeed + 5.0));
  vec3 iris = rho < 0.5 ? mix(uIris[0], uIris[1], smoothstep(0.2, 0.5, rho))
            : rho < 0.8 ? mix(uIris[1], uIris[2], smoothstep(0.5, 0.8, rho)) : mix(uIris[2], uIris[3], smoothstep(0.8, 1.0, rho));
  iris *= 0.72 + 0.5 * fib;
  iris *= 1.0 + 0.12 * exp(-pow(abs(rho - 0.47) / 0.06, 2.0));
  float crypt = smoothstep(0.62, 0.72, fbm(vec3(ang * 6.0, rho * 8.0, uSeed + 9.0))) * smoothstep(0.45, 0.6, rho) * (1.0 - smoothstep(0.8, 0.9, rho));
  iris *= 1.0 - 0.3 * crypt;
  iris *= mix(1.0, 0.3, smoothstep(1.0 - uLimbal, 1.0, rho));
  float pupil = 1.0 - smoothstep(uPupil - 0.03, uPupil + 0.01, rho);
  iris = mix(iris, vec3(0.004), pupil);
  // sclera: warm off-white, a few faint vessels toward the corners, shaded where the lids and socket hide it
  float side = smoothstep(0.35, 0.9, abs(p.x));
  float vessel = smoothstep(0.62, 0.7, fbm(vec3(p.xy * 9.0, uSeed + 2.0))) * side;
  vec3 sclera = mix(uSclera, vec3(0.55, 0.18, 0.16), vessel * 0.35);
  float irisMask = front * (1.0 - smoothstep(0.97, 1.03, rho));
  vec3 albedo = mix(sclera, iris, irisMask);
  // shadow from the lids: the upper lid shades the top, the socket shades the edges
  float shade = (1.0 - 0.75 * smoothstep(-0.05, 0.55, p.y)) * (1.0 - 0.6 * smoothstep(0.55, 0.95, length(p.xy)));
  shade = mix(shade, 1.0, 0.15);
  // lighting: soft diffuse plus a sharp wet highlight from the cornea / tear film
  vec3 col = albedo * ambient(n) * shade;
  vec3 nc = normalize(n + (irisMask > 0.5 ? 0.25 * normalize(vNormal) : vec3(0.0)));
  for (int i = 0; i < 3; i++) {
    vec3 l = uLightDir[i];
    float nl = max(dot(n, l), 0.0);
    col += albedo * uLightCol[i] * nl * shade * 0.7;
    vec3 h = normalize(l + v);
    float s = D_GGX(max(dot(nc, h), 0.0), 0.06 * 0.06) * V_Smith(max(dot(nc, v), 1e-3), nl, 0.0036) * F_Schlick(0.04, max(dot(v, h), 0.0));
    col += uLightCol[i] * s * nl * mix(0.15, 1.0, shade);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Eyes {
  constructor() {
    this.material = new GL.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        ...lightUniforms(),
        uIris: { value: [0, 1, 2, 3].map(() => new GL.Vector3()) },
        uSeed: { value: 0 },
        uIrisSize: { value: 0.5 },
        uPupil: { value: 0.33 },
        uLimbal: { value: 0.12 },
        uSclera: { value: new GL.Vector3(0.78, 0.72, 0.66) },
      },
    });
    const geo = new GL.SphereGeometry(1, 48, 32);
    this.meshes = [new GL.Mesh(geo, this.material), new GL.Mesh(geo, this.material.clone())];
    this.group = new GL.Group();
    this.meshes.forEach((m) => this.group.add(m));
  }

  // irisL / irisR: arrays of four sRGB hex stops; independent per eye for contact lenses
  setIris(irisL, irisR, seed = 0) {
    [irisL, irisR].forEach((stops, k) => {
      const u = this.meshes[k].material.uniforms;
      stops.forEach((hex, i) => u.uIris.value[i].set(...hexToLinear(hex)));
      u.uSeed.value = seed + k * 3.7;
    });
  }

  setStyle({ irisSize = 0.5, pupil = 0.33, limbal = 0.12, sclera } = {}) {
    for (const m of this.meshes) {
      const u = m.material.uniforms;
      u.uIrisSize.value = irisSize; u.uPupil.value = pupil; u.uLimbal.value = limbal;
      if (sclera) u.uSclera.value.set(...sclera);
    }
  }

  // centre the eyeballs in the morphed sockets and aim them at a point (the camera)
  place(headGeometry, target) {
    ['helper-l-eye', 'helper-r-eye'].forEach((name, k) => {
      const s = headGeometry.helperSphere(name);
      const m = this.meshes[k];
      m.position.copy(s.center);
      m.scale.setScalar(s.radius * 0.995);
      m.lookAt(target);
    });
  }
}
