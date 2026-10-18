// Deterministic face generator: seed -> plain, serialisable face record. The record holds every resolved
// value, so a saved face renders identically even if these tables change in a later generator version.
import { createRng } from './rng.js';
import { PROFILES, BLENDS, ORIGIN_WEIGHTS, TRAITS } from './profiles.js';
import { HAIR_STYLES, PRESENTATIONS } from './hair-styles.js';
import { DYED, HAIR_COLOURS } from './colors.js';
import { DIM_IMPACT } from './dim-impact.js';

export const GENERATOR_VERSION = 2;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const r3 = (x) => Math.round(x * 1000) / 1000 || 0; // never -0, so records survive a JSON round trip

// ---- shape model ----
// Each dimension's spread is set by its visible effect: one standard deviation moves the face by about
// SPREAD[class] decimetres, whatever the MakeHuman target's own scale (DIM_IMPACT). Correlated FACTORS
// move related dimensions together (a wide face has a wider jaw and cheekbones too), and BASE gives every
// face the same young-adult starting point. Independent noise on ~90 sliders is what makes faces look
// unnatural, so it is kept small (RESIDUAL).
const SPREAD = { skull: 0.012, structure: 0.014, feature: 0.007, ear: 0.01 };
const CLASS = (id) => /^(head-|forehead|temples|neck-)/.test(id) ? 'skull'
  : /^(chin|jaw|prognathism|cheek|brow-proj|mouth-proj|nose-depth|nose-proj|face-fat|mouth-pos)/.test(id) ? 'structure'
  : /^ear-/.test(id) ? 'ear' : 'feature';
const NO_VARIATION = new Set(['gender', 'youth', 'dimples', 'shape-oval', 'shape-round', 'shape-rect', 'shape-square', 'shape-triangle', 'shape-heart', 'shape-diamond']);
const sdOf = (id) => {
  if (NO_VARIATION.has(id)) return 0;
  const [p, m] = DIM_IMPACT[id];
  return clamp(SPREAD[CLASS(id)] / Math.max(p, m, 1e-3), 0.04, 0.35);
};
// young-adult starting point shared by every face (slider units)
const BASE = {
  'eye-open-1': 0.12, 'eye-open-2': 0.18, 'eye-open-3': 0.12, 'eye-size': 0.15, 'chin-height': -0.2, 'chin-bones': -0.2,
  'chin-width': -0.15, 'mouth-proj': -0.2, 'mouth-width': 0.15, 'cheek-volume': 0.15, 'nose-length': -0.1,
  'forehead-slope': -0.1, 'forehead-height': -0.1, temples: 0.35, 'eye-bags': -0.3, 'brow-proj': -0.1,
  'neck-length': 0.1, 'neck-width': -0.45, 'mouth-corners': 0.1, 'head-height': -0.15, 'head-width': 0.1,
  'shape-heart': 0.15, 'ear-flap': -0.4,
};
// correlated factors: loadings in standard deviations of each dimension
const FACTORS = [
  { 'head-width': 0.7, cheekbones: 0.4, 'chin-width': 0.5, 'neck-width': 0.3, 'mouth-width': 0.2 },          // face width
  { 'head-height': 0.6, 'chin-height': 0.5, 'nose-length': 0.4, 'forehead-height': 0.3, 'mouth-pos': -0.2 }, // face length
  { 'face-fat': 0.7, 'cheek-volume': 0.6, 'neck-width': 0.3, 'chin-bones': -0.3, 'cheek-inner': 0.3 },        // fullness
  { 'nose-proj': 0.5, 'nose-depth': 0.5, 'brow-proj': 0.5, 'eye-depth-1': 0.4, 'forehead-proj': 0.3 },       // profile depth
  { 'eye-size': 0.7, 'eye-open-1': 0.5, 'eye-open-2': 0.6, 'eye-open-3': 0.5 },                              // eye openness
  { 'upper-lip-volume': 0.7, 'lower-lip-volume': 0.7, 'mouth-width': 0.3, 'upper-lip-height': 0.4, 'lower-lip-height': 0.4 }, // lips
  { 'nose-width': 0.6, 'nostril-width': 0.5, 'nose-volume': 0.5, 'nose-tip-width': 0.4, 'nose-flare': 0.3 },  // nose size
  { 'chin-proj': 0.6, 'chin-width': 0.3, 'chin-bones': 0.5, 'jaw-drop': 0.3 },                               // jaw strength
  { 'eye-outer-corner': 0.6, 'lid-fold-angle': 0.4, 'brow-angle': 0.4 },                                     // eye tilt
];
const RESIDUAL = 0.45;
export const SHAPE_DIMS = [
  'gender', 'youth', 'shape-oval', 'shape-round', 'shape-rect', 'shape-square', 'shape-triangle', 'shape-heart', 'shape-diamond',
  'head-width', 'head-height', 'head-depth', 'face-fat', 'forehead-slope', 'forehead-height', 'temples', 'forehead-proj',
  'brow-height', 'brow-angle', 'brow-proj', 'eye-size', 'eye-spacing', 'eye-height', 'eye-open-1', 'eye-open-2', 'eye-open-3',
  'eye-depth-1', 'eye-depth-2', 'eye-inner-corner', 'eye-outer-corner', 'epicanthus', 'lid-fold', 'lid-fold-angle',
  'lid-fold-shape', 'eye-bags', 'eye-bag-height', 'nose-width', 'nose-length', 'nose-depth', 'nose-height', 'nose-proj',
  'nostril-width', 'nostril-angle', 'nose-tip-width', 'nose-tip-height', 'nose-base', 'nose-bridge-1', 'nose-bridge-2',
  'nose-bridge-3', 'nose-compress', 'nose-curve', 'nose-greek', 'nose-hump', 'nose-volume', 'nose-septum', 'nose-flare',
  'mouth-width', 'mouth-height', 'mouth-depth', 'mouth-pos', 'mouth-proj', 'upper-lip-volume', 'lower-lip-volume',
  'upper-lip-height', 'lower-lip-height', 'upper-lip-width', 'lower-lip-width', 'upper-lip-middle', 'lower-lip-middle',
  'upper-lip-ends', 'lower-lip-ends', 'cupids-bow', 'cupids-bow-width', 'philtrum', 'mouth-corners', 'dimples',
  'cheekbones', 'cheek-volume', 'cheek-inner', 'cheek-height', 'chin-width', 'chin-height', 'chin-proj', 'chin-bones',
  'jaw-drop', 'prognathism', 'chin-cleft', 'chin-pointed', 'neck-width', 'neck-length', 'ear-size', 'ear-lobe', 'ear-flap',
];
const FACE_SHAPES = ['shape-oval', 'shape-round', 'shape-rect', 'shape-square', 'shape-triangle', 'shape-heart', 'shape-diamond'];
const PRESENTATION_SHAPE = {
  feminine: { gender: [0, 0.12] },
  androgynous: { gender: [0.3, 0.55], 'brow-proj': 0.1 },
  masculine: { gender: [0.72, 1], 'brow-proj': 0.2, 'chin-width': 0.15, 'neck-width': 0.25 },
};

// head-covering colours (sRGB)
const WRAPS = ['#1d2b53', '#7e2553', '#008751', '#ab5236', '#5f574f', '#c2c3c7', '#ff77a8', '#ffa300', '#29adff', '#1a1a1a', '#f4f1ea', '#83769c', '#b8860b', '#2f4f4f'];

// origin: [{ id, weight }] summing to 1
function drawOrigin(rng) {
  const ids = Object.keys(PROFILES);
  const kind = rng.pick(ORIGIN_WEIGHTS);
  if (kind === 'single') return { kind, parts: [{ id: ids[rng.int(0, ids.length - 1)], weight: 1 }] };
  if (kind === 'blend') {
    const name = Object.keys(BLENDS)[rng.int(0, Object.keys(BLENDS).length - 1)];
    const ws = BLENDS[name].map((_, i) => (i === 0 ? 1 : 0.15) + rng.next());
    const total = ws.reduce((a, b) => a + b, 0);
    return { kind, blend: name, parts: BLENDS[name].map((id, i) => ({ id, weight: r3(ws[i] / total) })) };
  }
  const a = ids[rng.int(0, ids.length - 1)];
  let b = a;
  while (b === a) b = ids[rng.int(0, ids.length - 1)];
  const w = r3(rng.range(0.35, 0.65));
  return { kind, parts: [{ id: a, weight: w }, { id: b, weight: r3(1 - w) }] };
}
// pick a parent profile in proportion to its weight
const parent = (rng, parts) => PROFILES[rng.pick(Object.fromEntries(parts.map((p) => [p.id, p.weight])))];

export function generateFace(seed) {
  seed >>>= 0;
  const root = createRng(seed);
  const origin = drawOrigin(root.fork(1));
  const parts = origin.parts;
  const presentation = root.fork(2).pick(TRAITS.presentation);

  // ---- shape ----
  const sr = root.fork(3);
  const z = FACTORS.map(() => sr.gauss(1));
  const shape = {};
  for (const id of SHAPE_DIMS) {
    let mean = BASE[id] || 0;
    for (const p of parts) mean += p.weight * (PROFILES[p.id].shape[id] || 0);
    const pres = PRESENTATION_SHAPE[presentation][id];
    if (typeof pres === 'number') mean += pres;
    const sd = sdOf(id);
    let dev = RESIDUAL * sr.gauss(1);
    FACTORS.forEach((f, k) => { if (f[id]) dev += f[id] * z[k]; });
    shape[id] = sd ? clamp(mean + sd * dev, -0.85, 0.85) : clamp(mean, -0.85, 0.85);
  }
  const g = PRESENTATION_SHAPE[presentation].gender;
  shape.gender = sr.range(g[0], g[1]);
  shape.youth = sr.range(0.15, 0.55); // young adults only
  shape.dimples = sr.chance(0.15) ? sr.range(0.4, 0.8) : 0;
  const fs = FACE_SHAPES[sr.int(0, FACE_SHAPES.length - 1)];
  shape[fs] = sr.range(0.15, 0.45);
  if (sr.chance(0.5)) shape[FACE_SHAPES[sr.int(0, FACE_SHAPES.length - 1)]] += sr.range(0.1, 0.2);
  for (const k of Object.keys(shape)) shape[k] = r3(shape[k]);

  // ---- skin ----
  const kr = root.fork(4);
  const albinism = kr.chance(TRAITS.albinism);
  let tone = 0;
  for (const p of parts) {
    const [lo, hi] = PROFILES[p.id].tone;
    tone += p.weight * (lo + (hi - lo) * (kr.next() + kr.next()) / 2);
  }
  tone = clamp(tone + kr.gauss(0.03), 0, 1);
  const undertone = kr.pick(parent(kr, parts).undertone);

  // ---- hair (natural texture and colour first, then a style that suits the texture) ----
  const hr = root.fork(5);
  const texture = hr.pick(parent(hr, parts).texture);
  let natural = albinism ? 'pale-blonde' : hr.pick(parent(hr, parts).hair);
  const presIndex = PRESENTATIONS.indexOf(presentation);
  const styleWeights = Object.fromEntries(Object.entries(HAIR_STYLES)
    .filter(([, s]) => s.textures.includes(texture)).map(([id, s]) => [id, s.w[presIndex]]));
  const style = hr.pick(styleWeights);
  const dyed = !albinism && hr.chance(TRAITS.dyedHair) ? DYED[hr.int(0, DYED.length - 1)] : null;
  const highlights = !dyed && hr.chance(TRAITS.highlights)
    ? Object.keys(HAIR_COLOURS).filter((c) => !DYED.includes(c))[hr.int(4, 8)] : null;
  const covered = HAIR_STYLES[style].length === 'covered';
  const hair = {
    style, texture, natural, colour: dyed || natural, highlights,
    part: hr.pick({ middle: 4, left: 3, right: 3, none: 2 }),
    volume: r3(hr.range(0.8, 1.2)),
    length: r3(hr.range(0.85, 1.15)),
    hairline: { front: r3(hr.range(0.6, 0.68)), temple: r3(hr.range(0.36, 0.46)), side: r3(hr.range(-0.02, 0.08)) },
    wrap: covered ? { colour: WRAPS[hr.int(0, WRAPS.length - 1)], pattern: hr.pick({ plain: 5, print: 3, stripe: 2 }), seed: hr.int(0, 9999) } : null,
    seed: hr.int(0, 99999),
  };

  // ---- skin details ----
  const redHair = ['copper', 'auburn', 'strawberry-blonde'].includes(natural);
  const fairness = albinism ? 1 : 1 - tone;
  const freckleChance = 0.05 + 0.5 * fairness ** 3 + (redHair ? 0.4 : 0) + (albinism ? 0.25 : 0);
  const freckled = kr.chance(Math.min(freckleChance, 0.9));
  const moleCount = +kr.pick({ 0: 50, 1: 30, 2: 15, 3: 5 });
  const moles = [];
  while (moles.length < moleCount) {
    const x = kr.range(-0.62, 0.62), y = kr.range(-1.15, 0.7);
    const nearEye = Math.abs(y) < 0.16 && Math.abs(x) > 0.08 && Math.abs(x) < 0.48;
    const onLips = y > -0.78 && y < -0.48 && Math.abs(x) < 0.26;
    if (nearEye || onLips) continue;
    moles.push({ at: [r3(x), r3(y), 1], radius: r3(kr.range(0.007, 0.016)) });
  }
  const skin = {
    tone: r3(albinism ? 0 : tone), undertone, albinism,
    flush: r3(kr.range(0.1, 0.5) * (1 - 0.6 * (albinism ? 0 : tone))),
    underEye: r3(kr.range(0.1, 0.45) + 0.3 * tone),
    oil: r3(kr.range(0.2, 0.8)),
    freckles: freckled
      ? { density: r3(kr.range(0.25, 0.9)), contrast: r3(kr.range(0.25, 0.6)), size: r3(kr.range(0.7, 1.3)), forehead: kr.chance(0.4) ? 1 : 0 }
      : { density: 0, contrast: 0, size: 1, forehead: 0 },
    moles,
    vitiligo: kr.chance(TRAITS.vitiligo) ? { amount: r3(kr.range(0.05, 0.35)), scale: r3(kr.range(2.5, 5)), seed: r3(kr.range(0, 50)) } : null,
  };

  // ---- eyes, brows, lashes ----
  const er = root.fork(6);
  const eyes = {
    iris: albinism ? er.pick({ 'pale-blue': 3, grey: 1 }) : er.pick(parent(er, parts).iris),
    irisSize: r3(er.range(0.41, 0.46)), pupil: r3(er.range(0.28, 0.37)), limbal: r3(er.range(0.08, 0.18)),
    seed: r3(er.range(0, 100)),
  };
  const br = root.fork(7);
  const masc = presentation === 'masculine';
  const brows = {
    shape: br.pick(masc ? { straight: 5, 'soft-arch': 3, angled: 1 } : { straight: 2, 'soft-arch': 4, 'high-arch': 2, rounded: 2, angled: 2 }),
    thickness: r3(masc ? br.range(0.95, 1.4) : br.range(0.6, 1.25)),
    density: r3(br.range(0.6, 1.0)),
    length: r3(br.range(0.9, 1.08)),
    colour: natural, shade: r3(['light-blonde', 'golden-blonde', 'pale-blonde', 'strawberry-blonde'].includes(natural) ? br.range(0.55, 0.85) : br.range(0.8, 1.0)),
    seed: br.int(0, 99999),
  };
  const lashes = {
    length: r3(br.range(0.8, 1.25)), density: r3(br.range(0.7, 1.1)), curl: r3(br.range(0.25, 0.8)),
    colour: albinism ? 'pale-blonde' : ['light-blonde', 'golden-blonde', 'strawberry-blonde', 'dark-blonde'].includes(natural) ? 'light-brown' : 'jet-black',
    seed: br.int(0, 99999),
  };

  return {
    version: GENERATOR_VERSION, seed,
    origin, presentation, age: Math.round(33 - 27 * shape.youth),
    shape, skin, eyes, brows, lashes, hair,
  };
}

// A short description used to keep consecutive faces visibly different (see queue.js).
export function signature(face) {
  const toneBin = Math.min(4, Math.floor(face.skin.tone * 5));
  const main = face.origin.parts.reduce((a, b) => (b.weight > a.weight ? b : a)).id;
  return [main, face.presentation, face.hair.style, face.hair.colour, face.eyes.iris, toneBin, face.brows.shape].join('|');
}
