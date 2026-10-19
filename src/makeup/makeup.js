// The makeup applied to one face: plain, serialisable, validated data (contract §2, §8, §9). Rendering (paint
// texture, lashes, irises) is derived from it, so a reload replays exactly the same look.
//
// state:  { version, strokes: [stroke, ...] (application order), lenses: { left, right } (lens colour id or null) }
// stroke: { tool, colour, segments: [[x0, y0, z0, x1, y1, z1, ...], ...] }
//   Points are integers: decimetres x Q in the reference-head frame (skin tools), or x Q in the face's screen
//   plane for the mascara wand (x, y pairs), spaced by the tool's step. A new segment starts where the pointer
//   re-entered the face.
// Functions never mutate their input; invalid input leaves the state unchanged. encodeMakeup/decodeMakeup give
// the compact saved form (docs/MAKEUP.md).
import { colourById, TOOL_IDS } from './palette.js';
import { SURFACE_TOOLS } from './tools.js';
import { IRIS } from '../face/colors.js';

export const MAKEUP_VERSION = 1;
export const Q = 1024; // integer steps per decimetre (0.1 mm, a fifth of a screen pixel at the game's framing)
// Bounds on stored work. docs/MAKEUP.md measures a maximum-work session (about 9,400 points, 40 KB saved) against
// the 64 KiB save target; `points` allows ten times that and keeps any save under the platform's recommended
// 500 KiB. Within the bounds a stroke is never dropped or simplified; past them new strokes are refused.
export const LIMITS = { strokes: 4000, points: 100000, pointsPerStroke: 16384, segments: 512, coord: 8 * Q };

export function createMakeup() {
  return { version: MAKEUP_VERSION, strokes: [], lenses: { left: null, right: null } };
}

const dims = (tool) => (tool === 'mascara' ? 2 : 3);
const strokePoints = (s) => s.segments.reduce((n, seg) => n + seg.length / dims(s.tool), 0);
// stored points in the whole state
export const pointCount = (m) => m.strokes.reduce((n, s) => n + strokePoints(s), 0);
export function validStroke(s) {
  if (!s || typeof s !== 'object' || !Array.isArray(s.segments)) return false;
  const colour = colourById(s.colour);
  if (!colour || colour.target !== s.tool || !(SURFACE_TOOLS.has(s.tool) || s.tool === 'mascara')) return false;
  if (!s.segments.length || s.segments.length > LIMITS.segments) return false;
  const k = dims(s.tool);
  let points = 0;
  for (const seg of s.segments) {
    if (!Array.isArray(seg) || !seg.length || seg.length % k) return false;
    points += seg.length / k;
    if (points > LIMITS.pointsPerStroke) return false;
    for (const v of seg) if (!Number.isSafeInteger(v) || Math.abs(v) > LIMITS.coord) return false;
  }
  return true;
}

// a copy of `m` with the stroke appended (or `m` itself if the stroke is invalid or the state is full)
export function addStroke(m, s) {
  if (!validStroke(s) || m.strokes.length >= LIMITS.strokes || pointCount(m) + strokePoints(s) > LIMITS.points) return m;
  const copy = { tool: s.tool, colour: s.colour, segments: s.segments.map((seg) => seg.slice()) };
  return { ...m, strokes: [...m.strokes, copy] };
}

// a copy of `m` with the lens on one eye ('left' or 'right') set to a lens colour id
export function setLens(m, eye, colour) {
  if ((eye !== 'left' && eye !== 'right') || colourById(colour)?.target !== 'lens' || m.lenses[eye] === colour) return m;
  return { ...m, lenses: { ...m.lenses, [eye]: colour } };
}

// Completion predicate (contract §3): a persistent makeup or iris difference from the clean start. A lens that
// shows exactly the natural iris colour is not a change.
export function isChanged(m, naturalIris) {
  if (m.strokes.length) return true;
  const natural = IRIS[naturalIris];
  return ['left', 'right'].some((eye) => {
    const lens = colourById(m.lenses[eye]);
    return lens && (!natural || lens.iris.some((hex, i) => hex !== natural[i]));
  });
}

// whole-state validation for restored data (unknown or malformed data is rejected, never repaired)
export function validMakeup(m) {
  if (!m || m.version !== MAKEUP_VERSION || !Array.isArray(m.strokes) || m.strokes.length > LIMITS.strokes) return false;
  if (!m.lenses || typeof m.lenses !== 'object') return false;
  for (const eye of ['left', 'right']) {
    const v = m.lenses[eye];
    if (v !== null && colourById(v)?.target !== 'lens') return false;
  }
  return m.strokes.every(validStroke) && pointCount(m) <= LIMITS.points;
}

export const toQ = (v) => Math.round(v * Q) || 0; // never -0, which a save would not keep
export const fromQ = (v) => v / Q;

// ---- saved form ----
// JSON: { "v": version, "l": [left lens, right lens], "s": ["<colour id>:<points>", ...] }. The tool is the
// colour's own tool. <points> is a run of zigzag varints written five bits per URL-safe base64 character
// (bit 5 = more): the segment count, then per segment its point count, the first point and the differences
// between successive points. Neighbouring points are a tool step apart, so a coordinate usually takes one
// character. Decoding validates everything and returns null for anything malformed.
const DIGITS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const VALUE = new Map([...DIGITS].map((c, i) => [c, i]));

function packStroke(s) {
  const k = dims(s.tool), out = [];
  const put = (n) => {
    let z = n < 0 ? -2 * n - 1 : 2 * n; // zigzag
    do { const d = z % 32; z = Math.floor(z / 32); out.push(DIGITS[d + (z > 0 ? 32 : 0)]); } while (z > 0);
  };
  put(s.segments.length);
  for (const seg of s.segments) {
    put(seg.length / k);
    seg.forEach((v, i) => put(i < k ? v : v - seg[i - k]));
  }
  return out.join('');
}

function unpackStroke(tool, text) {
  const k = dims(tool);
  let at = 0;
  const get = () => {
    let z = 0, scale = 1;
    for (;;) {
      const d = VALUE.get(text[at++]);
      if (d === undefined || scale > 2 ** 40) throw new Error('bad digit');
      z += (d % 32) * scale;
      if (d < 32) break;
      scale *= 32;
    }
    return z % 2 ? -(z + 1) / 2 : z / 2;
  };
  const segments = [], count = get();
  if (count < 1 || count > LIMITS.segments) throw new Error('bad segment count');
  let points = 0;
  for (let j = 0; j < count; j++) {
    const n = get();
    points += n;
    if (n < 1 || points > LIMITS.pointsPerStroke) throw new Error('bad point count');
    const seg = new Array(n * k);
    for (let i = 0; i < n * k; i++) seg[i] = i < k ? get() : seg[i - k] + get();
    segments.push(seg);
  }
  if (at !== text.length) throw new Error('trailing data');
  return { tool, colour: null, segments };
}

export function encodeMakeup(m) {
  return JSON.stringify({ v: m.version, l: [m.lenses.left, m.lenses.right], s: m.strokes.map((s) => `${s.colour}:${packStroke(s)}`) });
}

// the makeup state from its saved form, or null if it is not a valid save of this version
export function decodeMakeup(text) {
  try {
    const d = JSON.parse(text);
    if (!d || d.v !== MAKEUP_VERSION || !Array.isArray(d.l) || d.l.length !== 2 || !Array.isArray(d.s) || d.s.length > LIMITS.strokes) return null;
    const strokes = d.s.map((entry) => {
      const cut = typeof entry === 'string' ? entry.indexOf(':') : -1;
      const colour = colourById(entry.slice(0, cut));
      if (cut < 0 || !colour || !TOOL_IDS.includes(colour.target)) throw new Error('bad colour');
      return { ...unpackStroke(colour.target, entry.slice(cut + 1)), colour: colour.id };
    });
    const m = { version: MAKEUP_VERSION, strokes, lenses: { left: d.l[0], right: d.l[1] } };
    return validMakeup(m) ? m : null;
  } catch {
    return null;
  }
}
