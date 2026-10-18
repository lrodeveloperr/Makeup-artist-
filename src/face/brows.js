// Natural eyebrows: individual hairs rooted on the skin in a brow shape defined in reference-head
// coordinates, so they sit correctly on every morphed face and move with the brow-shape dimensions.
import * as THREE from 'three';
import { createRng } from './rng.js';
import { evalPoint } from './surface.js';
import { HAIR_COLOURS } from './colors.js';
import { buildStrandGeometry, createStrandMaterial } from './strands.js';

// peak position along the brow, peak height (dm), tail height relative to the peak, rise/fall exponents
export const BROW_SHAPES = {
  straight: { pu: 0.7, ph: 0.028, tail: 0.3, k1: 1, k2: 1 },
  'soft-arch': { pu: 0.64, ph: 0.06, tail: 0.15, k1: 1, k2: 1.2 },
  'high-arch': { pu: 0.62, ph: 0.09, tail: -0.15, k1: 1, k2: 1.4 },
  rounded: { pu: 0.5, ph: 0.065, tail: -0.05, k1: 0.7, k2: 2 },
  angled: { pu: 0.66, ph: 0.075, tail: -0.1, k1: 1.25, k2: 1 },
};
const START_X = 0.115, END_X = 0.49, BASE_Y = 0.17;

function centreline(shape, u) {
  const s = BROW_SHAPES[shape] || BROW_SHAPES['soft-arch'];
  const a = u < s.pu ? Math.sin((Math.PI / 2) * (u / s.pu)) ** s.k1 : 1 - (1 - s.tail) * ((u - s.pu) / (1 - s.pu)) ** s.k2;
  return BASE_Y + s.ph * a;
}
function thickness(T, u) {
  let h = T * (0.06 * (1 - u) + 0.03 * u);
  if (u > 0.72) h *= 1 - 0.65 * ((u - 0.72) / 0.28);
  if (u < 0.06) h *= 0.75 + 0.25 * (u / 0.06);
  return h;
}

export class Brows {
  constructor() {
    this.material = createStrandMaterial({ opacity: 1 });
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.material);
    this.mesh.renderOrder = 2;
  }

  // brows: face.brows; hg: HeadGeometry (current morph); sampler: SurfaceSampler
  build(brows, hg, sampler) {
    const rng = createRng(brows.seed);
    const base = HAIR_COLOURS[brows.colour] || HAIR_COLOURS['dark-brown'];
    const tone = base.map((c) => c * brows.shade);
    const count = Math.round(420 * brows.density * Math.sqrt(brows.thickness));
    const strands = [];
    const P = hg.subPos, N = hg.subNrm, root = [0, 0, 0], nrm = [0, 0, 0];
    for (const side of [1, -1]) {
      const r = rng.fork(side > 0 ? 1 : 2);
      for (let i = 0; i < count; i++) {
        const u = Math.min(r.next() ** 0.85, 0.999);
        const v = r.next() - 0.5;
        const xRef = START_X + u * (END_X * brows.length - START_X);
        const yRef = centreline(brows.shape, u) + v * thickness(brows.thickness, u) + r.gauss(0.002);
        const hit = sampler.locate(side * xRef, yRef);
        if (!hit) continue;
        evalPoint(hit, P, root);
        evalPoint(hit, N, nrm);
        const nl = Math.hypot(...nrm); nrm[0] /= nl; nrm[1] /= nl; nrm[2] /= nl;
        // growth direction: upward at the head, then outward and converging, then down at the tail
        let ang = u < 0.16 ? 78 - 40 * (u / 0.16) : u > 0.8 ? -12 + 20 * (1 - (u - 0.8) / 0.2) * (v < 0 ? 1 : 0.4) : (v < 0 ? 32 : 8) + 10 * (0.5 - u);
        ang += r.gauss(7);
        const rad = (ang * Math.PI) / 180;
        let d = [side * Math.cos(rad), Math.sin(rad), 0];
        const dn = d[0] * nrm[0] + d[1] * nrm[1] + d[2] * nrm[2];
        d = [d[0] - dn * nrm[0], d[1] - dn * nrm[1], d[2] - dn * nrm[2]];
        const dl = Math.hypot(...d); d = d.map((x) => x / dl);
        const L = (u < 0.16 ? 0.04 : u > 0.8 ? 0.05 : 0.06) * (0.8 + 0.4 * r.next());
        const pts = [];
        for (let k = 0; k <= 4; k++) {
          const t = k / 4;
          const lift = 0.003 + 0.006 * t * (1 - t) + 0.002 * t;
          pts.push([root[0] + d[0] * L * t + nrm[0] * lift, root[1] + d[1] * L * t + nrm[1] * lift, root[2] + d[2] * L * t + nrm[2] * lift]);
        }
        const shade = 0.8 + 0.4 * r.next();
        strands.push({ points: pts, widths: [0.0022, 0.002, 0.0016, 0.0011, 0.0005], up: nrm.slice(), color: tone.map((c) => c * shade) });
      }
    }
    buildStrandGeometry(strands, this.mesh.geometry);
    this.strandCount = strands.length;
  }
}
