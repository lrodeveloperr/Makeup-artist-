// Deterministic face generator: seed -> plain, serialisable face record. The record holds every resolved
// value, so a saved face renders identically even if these tables change in a later generator version.
import { createRng } from './rng.js';
import { PROFILES, BLENDS, ORIGIN_WEIGHTS, TRAITS, BASE_HEADS, STYLES, PROFILE_SHAPE_SCALE, FULL_STRENGTH, LASHES, BROWS } from './profiles.js';
import { HAIR_STYLES } from './hair-styles.js';
import { BLONDE } from './colors.js';
import { chooseOutfit } from './outfit.js';
import { DIM_IMPACT } from './dim-impact.js';

export const GENERATOR_VERSION = 6;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const r3 = (x) => Math.round(x * 1000) / 1000 || 0; // never -0, so records survive a JSON round trip

// ---- shape model ----
// Each dimension's spread is set by its visible effect: one standard deviation moves the face by about
// SPREAD[class] decimetres, whatever the MakeHuman target's own scale (DIM_IMPACT). Correlated FACTORS
// move related dimensions together (a wide face has a wider jaw and cheekbones too), and BASE gives every
// face the same young-adult starting point. Independent noise on ~90 sliders is what makes faces look
// unnatural, so it is kept small (RESIDUAL).
const SPREAD = { skull: 0.009, structure: 0.011, feature: 0.006, ear: 0.008 };
const CLASS = (id) => /^(head-|forehead|temples|neck-)/.test(id) ? 'skull'
  : /^(chin|jaw|prognathism|cheek|brow-proj|mouth-proj|nose-depth|nose-proj|face-fat|mouth-pos)/.test(id) ? 'structure'
  : /^ear-/.test(id) ? 'ear' : 'feature';
const NO_VARIATION = new Set(['gender', 'youth', 'dimples', 'shape-oval', 'shape-round', 'shape-rect', 'shape-square', 'shape-triangle', 'shape-heart', 'shape-diamond']);
const sdOf = (id) => {
  if (NO_VARIATION.has(id)) return 0;
  const [p, m] = DIM_IMPACT[id];
  return clamp(SPREAD[CLASS(id)] / Math.max(p, m, 1e-3), 0.04, 0.35);
};
// Feminine young-adult starting point shared by every face (slider units), on top of the sculpted
// female base heads: softer jaw and smaller chin, slimmer nose, fuller lips with a defined bow, almond eyes
// with a relaxed upper lid and a lifted outer corner, higher brows with a smooth brow ridge, smooth forehead, slim neck.
const BASE = {
  gender: -0.35, 'chin-width': -0.2, 'chin-bones': -0.25, 'chin-pointed': 0.15, 'chin-height': -0.05,
  'nose-width': -0.15, 'nostril-width': -0.1, 'nose-bridge-1': -0.15, 'nose-bridge-2': -0.15, 'nose-tip-height': 0.1,
  'nose-length': -0.1, 'upper-lip-volume': 0.15, 'lower-lip-volume': 0.1, 'cupids-bow': 0.2, 'mouth-proj': -0.15,
  'mouth-corners': 0.1, 'eye-size': 0.2, 'eye-open-1': -0.15, 'eye-open-2': -0.3, 'eye-open-3': -0.15, 'eye-outer-corner': 0.3,
  'eye-bags': -0.3, 'brow-height': 0.2, 'brow-proj': -0.3, 'forehead-proj': -0.15, 'forehead-slope': -0.15,
  'neck-width': -0.6, 'neck-length': 0.1, 'shape-oval': 0.25, 'head-height': 0.05, temples: 0.3, 'ear-flap': -0.4,
  'face-fat': -0.1,
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
const RESIDUAL = 0.35;
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

// origin: [{ id, weight }] summing to 1 (a single profile, or one of the named heritage blends)
function drawOrigin(rng) {
  const ids = Object.keys(PROFILES);
  const kind = rng.pick(ORIGIN_WEIGHTS);
  if (kind === 'single') return { kind, parts: [{ id: ids[rng.int(0, ids.length - 1)], weight: 1 }] };
  const name = Object.keys(BLENDS)[rng.int(0, Object.keys(BLENDS).length - 1)];
  const ws = BLENDS[name].map((_, i) => (i === 0 ? 1 : 0.15) + rng.next());
  const total = ws.reduce((a, b) => a + b, 0);
  return { kind, blend: name, parts: BLENDS[name].map((id, i) => ({ id, weight: r3(ws[i] / total) })) };
}
// one step lighter natural shade, for subtle highlights
const LIGHTER = {
  'jet-black': 'dark-brown', 'soft-black': 'dark-brown', 'darkest-brown': 'dark-brown', 'dark-brown': 'medium-brown',
  chestnut: 'light-brown', 'medium-brown': 'light-brown', 'ash-brown': 'light-brown', 'light-brown': 'dark-blonde',
  'dark-blonde': 'honey-blonde', 'ash-blonde': 'light-blonde', 'honey-blonde': 'golden-blonde', 'golden-blonde': 'light-blonde',
  'light-blonde': 'platinum-blonde', 'platinum-blonde': 'platinum-blonde',
  auburn: 'copper', copper: 'strawberry-blonde', 'strawberry-blonde': 'golden-blonde',
};
// pick a parent profile, favouring the larger part of a mixed heritage (weight squared), so colouring stays
// coherent with how the face looks
const parent = (rng, parts) => PROFILES[rng.pick(Object.fromEntries(parts.map((p) => [p.id, p.weight ** 2])))];

export function generateFace(seed) {
  seed >>>= 0;
  const root = createRng(seed);
  const origin = drawOrigin(root.fork(1));
  const parts = origin.parts;
  const presentation = 'feminine';

  // ---- shape: sculpted base heads mixed by ancestry, feminine baseline, tendencies, variation ----
  const sr = root.fork(3);
  const z = FACTORS.map(() => sr.gauss(1));
  const shape = {};
  for (const id of SHAPE_DIMS) {
    let mean = BASE[id] || 0;
    const scale = FULL_STRENGTH.has(id) ? 1 : PROFILE_SHAPE_SCALE;
    for (const p of parts) mean += p.weight * scale * (PROFILES[p.id].shape[id] || 0);
    const sd = sdOf(id);
    let dev = RESIDUAL * sr.gauss(1);
    FACTORS.forEach((f, k) => { if (f[id]) dev += f[id] * z[k]; });
    shape[id] = sd ? clamp(mean + sd * dev, -0.85, 0.85) : clamp(mean, -0.85, 0.85);
  }
  shape.gender = BASE.gender + sr.range(-0.1, 0.1);
  shape.youth = sr.range(0.15, 0.55); // young adults only
  shape.dimples = sr.chance(0.15) ? sr.range(0.4, 0.8) : 0;
  const fs = ['shape-oval', 'shape-heart', 'shape-round', 'shape-diamond'][sr.int(0, 3)];
  shape[fs] += sr.range(0.1, 0.3);
  for (const head of ['african', 'asian', 'caucasian']) {
    shape[`base-${head}`] = parts.reduce((a, p) => a + p.weight * (BASE_HEADS[p.id][head] || 0), 0);
  }
  for (const k of Object.keys(shape)) shape[k] = r3(shape[k]);

  // ---- skin ----
  const kr = root.fork(4);
  let tone = 0;
  for (const p of parts) {
    const [lo, hi] = PROFILES[p.id].tone;
    tone += p.weight * (lo + (hi - lo) * (kr.next() + kr.next()) / 2);
  }
  tone = clamp(tone + kr.gauss(0.03), 0, 1);
  const undertone = kr.pick(parent(kr, parts).undertone);

  // ---- hair: natural texture and colour from the ancestry, then a long style that fits it ----
  const hr = root.fork(5);
  const home = parent(hr, parts);
  const homeId = Object.keys(PROFILES).find((id) => PROFILES[id] === home);
  const texture = hr.pick(home.texture);
  const natural = hr.pick(home.hair);
  const styleWeights = Object.fromEntries(Object.entries(STYLES[homeId]).filter(([id]) => HAIR_STYLES[id].textures.includes(texture)));
  const style = hr.pick(Object.keys(styleWeights).length ? styleWeights : { 'curly-long': 1 });
  const highlights = hr.chance(TRAITS.highlights) ? LIGHTER[natural] : null;
  const hair = {
    style, texture, natural, colour: natural, highlights,
    part: hr.pick({ middle: 4, left: 3, right: 3, none: 1 }),
    volume: r3(hr.range(0.9, 1.2)),
    length: r3(hr.range(0.9, 1.15)),
    hairline: { front: r3(hr.range(0.6, 0.68)), temple: r3(hr.range(0.38, 0.46)), side: r3(hr.range(0, 0.08)) },
    seed: hr.int(0, 99999),
  };

  // ---- skin details ----
  const redHair = ['copper', 'auburn', 'strawberry-blonde'].includes(natural);
  const freckleChance = 0.04 + 0.45 * (1 - tone) ** 3 + (redHair ? 0.4 : 0);
  const freckled = kr.chance(Math.min(freckleChance, 0.85));
  const moleCount = +kr.pick({ 0: 55, 1: 32, 2: 13 });
  const moles = [];
  while (moles.length < moleCount) {
    const x = kr.range(-0.62, 0.62), y = kr.range(-1.15, 0.7);
    const nearEye = Math.abs(y) < 0.16 && Math.abs(x) > 0.08 && Math.abs(x) < 0.48;
    const onLips = y > -0.78 && y < -0.48 && Math.abs(x) < 0.26;
    if (nearEye || onLips) continue;
    moles.push({ at: [r3(x), r3(y), 1], radius: r3(kr.range(0.006, 0.012)) });
  }
  const skin = {
    tone: r3(tone), undertone,
    flush: r3(kr.range(0.25, 0.5) * (1 - 0.5 * tone)),
    underEye: r3(kr.range(0.05, 0.25) + 0.2 * tone),
    oil: r3(kr.range(0.15, 0.5)),
    freckles: freckled
      ? { density: r3(kr.range(0.25, 0.8)), contrast: r3(kr.range(0.2, 0.5)), size: r3(kr.range(0.7, 1.2)), forehead: kr.chance(0.3) ? 1 : 0 }
      : { density: 0, contrast: 0, size: 1, forehead: 0 },
    moles,
  };

  // ---- eyes, brows, lashes ----
  const er = root.fork(6);
  const eyes = {
    iris: er.pick(parent(er, parts).iris),
    irisSize: r3(er.range(0.41, 0.46)), pupil: r3(er.range(0.28, 0.36)), limbal: r3(er.range(0.1, 0.18)),
    seed: r3(er.range(0, 100)),
  };
  const br = root.fork(7);
  const eyeStyle = parent(br, parts); // natural brow shape and lash length and curl follow the ancestry
  const ls = eyeStyle.lashes || LASHES;
  const brows = {
    shape: br.pick(eyeStyle.brows || BROWS),
    thickness: r3(br.range(0.65, 1.0)),
    density: r3(br.range(0.75, 1.0)),
    length: r3(br.range(0.95, 1.08)),
    colour: natural, shade: r3(BLONDE.has(natural) && natural !== 'dark-blonde' ? br.range(0.55, 0.8) : br.range(0.8, 1.0)),
    seed: br.int(0, 99999),
  };
  const lashes = {
    length: r3(br.range(...ls.length)), density: r3(br.range(...ls.density)), curl: r3(br.range(...ls.curl)),
    colour: BLONDE.has(natural) ? 'light-brown' : 'jet-black',
    seed: br.int(0, 99999),
  };

  // ---- outfit: a blouse or dress in colours that flatter the complexion ----
  const outfit = chooseOutfit(root.fork(8), skin.tone, skin.undertone);

  return {
    version: GENERATOR_VERSION, seed,
    origin, presentation, age: Math.round(33 - 27 * shape.youth),
    shape, skin, eyes, brows, lashes, hair, outfit,
  };
}

// A short description used to keep consecutive faces visibly different (see queue.js).
export function signature(face) {
  const toneBin = Math.min(4, Math.floor(face.skin.tone * 5));
  const main = face.origin.parts.reduce((a, b) => (b.weight > a.weight ? b : a)).id;
  return [main, face.presentation, face.hair.style, face.hair.colour, face.eyes.iris, toneBin, face.brows.shape, face.hair.part, face.outfit.names[0]].join('|');
}
