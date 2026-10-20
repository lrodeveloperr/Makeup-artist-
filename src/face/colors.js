// Colour models for generated faces. All values are linear RGB (the renderer converts to sRGB).
const lerp = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export const hexToLinear = (hex) => [1, 3, 5].map((i) => srgbToLinear(parseInt(hex.slice(i, i + 2), 16) / 255));

// Skin albedo from very fair (0) to very deep (1). The ten anchors are the studio's Haircut tones, read
// as a continuous ramp so generated faces are not limited to ten steps.
const SKIN_RAMP = [
  [0.7, 0.425, 0.345], [0.66, 0.385, 0.3], [0.615, 0.37, 0.27], [0.56, 0.345, 0.235], [0.485, 0.298, 0.19],
  [0.4, 0.24, 0.15], [0.31, 0.182, 0.112], [0.225, 0.128, 0.082], [0.155, 0.088, 0.058], [0.105, 0.06, 0.042],
];
export const UNDERTONES = {
  pink: [1.03, 0.97, 1.0],
  neutral: [1, 1, 1],
  olive: [0.98, 1.02, 0.94],
  golden: [1.03, 1.0, 0.85],
  red: [1.04, 0.96, 0.95],
};
export function skinAlbedo(tone, undertone = 'neutral') {
  const x = Math.min(Math.max(tone, 0), 1) * (SKIN_RAMP.length - 1);
  const i = Math.min(Math.floor(x), SKIN_RAMP.length - 2);
  const c = mix3(SKIN_RAMP[i], SKIN_RAMP[i + 1], x - i);
  const u = UNDERTONES[undertone] || UNDERTONES.neutral;
  return [c[0] * u[0], c[1] * u[1], c[2] * u[2]];
}

// Natural (unpainted) lip colour: redder and a little darker than the skin on fair tones, browner and
// more muted on deep tones, where the inner lower lip is often lighter and pinker.
export function lipColours(skin, tone, rng) {
  const fair = 1 - tone;
  const outer = mix3(
    [skin[0] * 0.78, skin[1] * 0.52, skin[2] * 0.6],
    [skin[0] * 0.92, skin[1] * 0.78, skin[2] * 0.88],
    tone,
  ).map((c) => c * (0.92 + 0.12 * rng.next()));
  outer[0] *= 1 + 0.12 * fair * rng.next();
  const inner = mix3(outer, [0.3, 0.1, 0.11], 0.15 + 0.45 * tone * rng.next());
  return { outer, inner };
}

// Natural hair colours (linear albedo of the hair's mid-length), darkest to lightest. Which ones a face can have,
// and how often, is set per ancestry profile (`hair` in profiles.js).
export const HAIR_COLOURS = {
  'jet-black': [0.012, 0.011, 0.012],
  'soft-black': [0.02, 0.017, 0.016],
  'darkest-brown': [0.027, 0.019, 0.014],
  'dark-brown': [0.035, 0.024, 0.017],
  chestnut: [0.06, 0.03, 0.016],
  'medium-brown': [0.07, 0.045, 0.028],
  'ash-brown': [0.075, 0.058, 0.045],
  'light-brown': [0.14, 0.085, 0.045],
  'dark-blonde': [0.24, 0.14, 0.06],
  'ash-blonde': [0.32, 0.25, 0.15],
  'honey-blonde': [0.38, 0.22, 0.08],
  'golden-blonde': [0.42, 0.25, 0.09],
  'light-blonde': [0.62, 0.43, 0.2],
  'platinum-blonde': [0.74, 0.62, 0.44],
  'strawberry-blonde': [0.4, 0.2, 0.1],
  auburn: [0.13, 0.04, 0.018],
  copper: [0.3, 0.09, 0.03],
};
// fair shades that take lighter brows and brown lashes
export const BLONDE = new Set(['dark-blonde', 'ash-blonde', 'honey-blonde', 'golden-blonde', 'light-blonde', 'platinum-blonde', 'strawberry-blonde']);

// Iris colours: four stops from the pupil edge to the limbal ring (sRGB hex, as in Haircut)
export const IRIS = {
  'dark-brown': ['#5a3c22', '#3a2412', '#26170b', '#140c06'],
  brown: ['#8a6038', '#5a3a1e', '#3d2612', '#22150a'],
  'light-brown': ['#b38a5a', '#7d5631', '#5a3b1f', '#33200f'],
  amber: ['#c99a3c', '#a06d22', '#6e4614', '#3a240a'],
  hazel: ['#c9b27a', '#8d7a45', '#5f5a33', '#3a331c'],
  green: ['#b5c49a', '#6f8e55', '#4d6b3a', '#2c3f22'],
  grey: ['#c4cdd2', '#8b9aa3', '#5f6e78', '#36424a'],
  blue: ['#a8c4d6', '#5d90b3', '#34688d', '#1d3c55'],
};
