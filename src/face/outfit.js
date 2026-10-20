// Outfits: every customer wears a blouse or a dress in colours that flatter her complexion. The outfit is part
// of the look the player works with (a coral blouse invites a coral lip), so its colours are chosen by skin depth
// and undertone, kept clearly different from the skin itself, and combined only with colours that belong together.
import { hexToLinear, skinAlbedo } from './colors.js';

// Garment colours (sRGB)
export const GARMENT_COLOURS = {
  white: '#f7f5f0', ivory: '#f3ead8', cream: '#efe2c4', blush: '#f2c4c9', 'powder-blue': '#b7d3ea', mint: '#a8e0c5',
  lavender: '#b7a3dc', lilac: '#c9a3d9', peach: '#f6b49a', 'sky-blue': '#7ec4ea', lemon: '#f5e163',
  'golden-yellow': '#f2c230', gold: '#d4a72c', mustard: '#d0a024', orange: '#ee7b22', coral: '#f07e6e',
  tomato: '#e0533d', red: '#c8202f', 'warm-pink': '#f08aa0', rose: '#d9798f', 'hot-pink': '#e83e8c', fuchsia: '#c2187a',
  raspberry: '#b0245a', berry: '#8e2350', burgundy: '#6e1b2f', rust: '#b5532a', terracotta: '#c46a4a', camel: '#c19a6b',
  'leaf-green': '#4fae4c', lime: '#a4cf3a', sage: '#9cae8e', olive: '#6f7536', emerald: '#0f8a5f', teal: '#12707a',
  turquoise: '#26b8b0', cornflower: '#6a8ee6', 'royal-blue': '#2d55c8', cobalt: '#1f4fb5', 'grey-blue': '#6d7f99',
  navy: '#1f2a4d', violet: '#7d4fc4', 'royal-purple': '#5b2a9a', plum: '#6b2f62', charcoal: '#3b3d45', black: '#1c1b1f',
};

// Colours that flatter each complexion. Fair skin is split by undertone; deep skin wears saturated, bright and light
// colours and never black or very dark shades, which would sit too close to the skin.
export const PALETTES = {
  'fair-cool': ['navy', 'royal-blue', 'cornflower', 'powder-blue', 'emerald', 'mint', 'teal', 'berry', 'raspberry', 'rose',
    'blush', 'lavender', 'lilac', 'plum', 'violet', 'grey-blue', 'charcoal', 'black', 'white', 'red', 'fuchsia'],
  'fair-warm': ['coral', 'peach', 'tomato', 'warm-pink', 'turquoise', 'leaf-green', 'sage', 'olive', 'camel', 'ivory', 'cream',
    'golden-yellow', 'cornflower', 'navy', 'rust', 'teal', 'emerald', 'mint', 'red'],
  medium: ['terracotta', 'rust', 'mustard', 'teal', 'turquoise', 'burgundy', 'cream', 'white', 'ivory', 'cobalt', 'emerald',
    'coral', 'plum', 'olive', 'royal-purple', 'red', 'navy', 'black', 'hot-pink', 'fuchsia', 'golden-yellow', 'lavender'],
  deep: ['white', 'ivory', 'cream', 'gold', 'mustard', 'golden-yellow', 'lemon', 'orange', 'tomato', 'red', 'fuchsia',
    'hot-pink', 'coral', 'cobalt', 'royal-blue', 'sky-blue', 'turquoise', 'emerald', 'lime', 'leaf-green', 'lavender',
    'lilac', 'violet', 'royal-purple', 'mint', 'blush', 'peach'],
};
// colours that make an undertone look sallow or flushed
const AVOID = { olive: ['olive', 'sage', 'camel', 'mustard'], pink: ['orange', 'rust', 'camel'], red: ['orange', 'rust', 'tomato'] };
// partners that go with anything (used for trims, stripes, dots and gingham)
const NEUTRALS = new Set(['white', 'ivory', 'cream', 'navy', 'black', 'charcoal']);

// necklines by garment (shapes in garment.js)
export const NECKLINES = {
  blouse: { boat: 3, scoop: 3, 'v-neck': 3, ruffle: 2, 'off-shoulder': 2 },
  dress: { straps: 3, sweetheart: 3, 'off-shoulder': 2, square: 2, 'v-neck': 1 },
};
export const PATTERNS = { solid: 4, 'two-tone': 2, stripes: 2, dots: 2, floral: 3, gingham: 1, geometric: 1.5 };

// ---- colour maths ----
const srgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
// CIELAB (D65) from linear RGB: L is lightness 0..100; distances between colours match perceived difference
function lab([r, g, b]) {
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.9505), y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.089);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
function hueSat([r, g, b]) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d < 1e-6) return [0, 0];
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  const l = (max + min) / 2;
  return [h * 60, d / (1 - Math.abs(2 * l - 1))];
}
const hueDist = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
const linToSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
export function colourInfo(name) {
  const hex = GARMENT_COLOURS[name];
  const [h, s] = hueSat(srgb(hex));
  const c = lab(hexToLinear(hex));
  return { name, hex, lab: c, L: c[0], h, s };
}
export function skinInfo(tone, undertone) {
  const lin = skinAlbedo(tone, undertone);
  const [h, s] = hueSat(lin.map(linToSrgb));
  const c = lab(lin);
  return { lab: c, L: c[0], h, s };
}
// "nude on nude": a colour so close to the skin (perceptual distance below 30) that the outfit melts into it
export const nearSkin = (c, skin) => Math.hypot(c.lab[0] - skin.lab[0], c.lab[1] - skin.lab[1], c.lab[2] - skin.lab[2]) < 30;
// Very dark colours (black, navy, charcoal, burgundy, plum: lightness below 31) are never worn on deeper skin.
export const DEEP = 0.55;
export const tooDark = (c, tone) => tone >= DEEP - 0.1 && c.L < 31;

export function complexion(tone, undertone) {
  if (tone >= DEEP) return 'deep';
  if (tone >= 0.3) return 'medium';
  return undertone === 'golden' || undertone === 'olive' ? 'fair-warm' : 'fair-cool';
}

// How a pattern's second colour relates to the main one. Stripes, checks and trims stay with neutrals or
// neighbouring hues; complementary accents are kept for small motifs (flowers, prints).
const RELATIONS = {
  'two-tone': { neutral: 5, analogous: 3, complement: 1 },
  stripes: { neutral: 6, analogous: 2, complement: 1 },
  dots: { neutral: 5, analogous: 2, complement: 2 },
  gingham: { neutral: 7, analogous: 2 },
  floral: { neutral: 2, analogous: 3, complement: 3 },
  geometric: { neutral: 2, analogous: 3, complement: 3 },
};
// too loud to wear as the main colour; fine as an accent
const ACCENT_ONLY = new Set(['lime', 'lemon']);
// two equally vivid mid-tone colours fight each other (lime with red)
const clash = (a, b) => a.s > 0.6 && b.s > 0.6 && Math.abs(a.L - b.L) < 30 && hueDist(a.h, b.h) > 90;

// a colour from the pool that goes with `base`, with enough lightness difference for a pattern to read
function partner(rng, base, pool, relations, minContrast, taken) {
  const rel = rng.pick(relations);
  const cands = pool.filter((c) => !taken.includes(c.name) && Math.abs(c.L - base.L) >= minContrast && !clash(c, base));
  const fit = cands.filter((c) => (rel === 'neutral' ? NEUTRALS.has(c.name)
    : rel === 'analogous' ? c.s > 0.25 && hueDist(c.h, base.h) >= 25 && hueDist(c.h, base.h) <= 75
      : c.s > 0.25 && hueDist(c.h, base.h) >= 140));
  const list = fit.length ? fit : cands;
  return list.length ? list[rng.int(0, list.length - 1)] : colourInfo('white');
}

// rng: a forked generator stream; tone / undertone: the face's skin
export function chooseOutfit(rng, tone, undertone) {
  const skin = skinInfo(tone, undertone);
  const avoid = AVOID[undertone] || [];
  const pool = PALETTES[complexion(tone, undertone)].filter((n) => !avoid.includes(n)).map(colourInfo)
    .filter((c) => !nearSkin(c, skin) && !tooDark(c, tone));
  const mains = pool.filter((c) => !ACCENT_ONLY.has(c.name));
  const kind = rng.pick({ blouse: 1, dress: 1 });
  const neckline = rng.pick(NECKLINES[kind]);
  const pattern = rng.pick(PATTERNS);
  const base = mains[rng.int(0, mains.length - 1)];
  const picks = [base];
  const taken = () => picks.map((c) => c.name);
  if (pattern !== 'solid') picks.push(partner(rng, base, pool, RELATIONS[pattern], pattern === 'two-tone' ? 15 : 25, taken()));
  // flower centres and leaves, or the print's third colour
  if (pattern === 'floral' || pattern === 'geometric') picks.push(partner(rng, base, pool, { analogous: 1, complement: 1, neutral: 1 }, 15, taken()));
  // plain dresses and blouses are sometimes satin; prints are cotton
  const fabric = (pattern === 'solid' || pattern === 'two-tone') && rng.chance(kind === 'dress' ? 0.45 : 0.25) ? 'satin' : 'cotton';
  return { kind, neckline, pattern, fabric, names: picks.map((c) => c.name), colours: picks.map((c) => c.hex), seed: rng.int(0, 9999) };
}
