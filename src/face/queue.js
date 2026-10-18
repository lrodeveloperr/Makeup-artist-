// Variety director for the customer queue: picks the next face so that consecutive faces look clearly
// different (ancestry, skin tone, hairstyle, hair colour...). Deterministic from the saved state, so the
// previewed next face never changes after a reload. Never stalls: after a few candidates it takes the
// most different one it has seen.
import { generateFace, signature, GENERATOR_VERSION } from './generator.js';

export const RECENT = 4;
const CANDIDATES = 8;
// weights of each signature field when comparing with the previous face (index 0) and older ones
const FIELD_WEIGHT = [3, 1, 3, 1, 0.5, 2, 0.5]; // origin, presentation, style, hair colour, iris, tone bin, brow shape

const mixSeed = (cursor, k) => {
  let x = (Math.imul(cursor + 1, 0x9e3779b1) ^ Math.imul(k + 1, 0x85ebca6b)) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x2c1b3c6d) >>> 0;
  return (x ^ (x >>> 13)) >>> 0;
};

function similarity(sig, recent) {
  const a = sig.split('|');
  let score = 0;
  recent.forEach((r, age) => {
    const b = r.split('|');
    const ageWeight = age === 0 ? 1 : 0.35;
    for (let i = 0; i < a.length; i++) if (a[i] === b[i]) score += FIELD_WEIGHT[i] * ageWeight;
    if (r === sig) score += 100; // never repeat a whole face if any alternative exists
  });
  return score;
}

// state: { version, cursor, recent: [signature, ...] (most recent first) }
export function createQueueState(seed = 1) {
  return { version: GENERATOR_VERSION, cursor: seed >>> 0, recent: [] };
}

export function nextFace(state) {
  let best = null;
  for (let k = 0; k < CANDIDATES; k++) {
    const face = generateFace(mixSeed(state.cursor, k));
    const sig = signature(face);
    const score = similarity(sig, state.recent);
    if (!best || score < best.score) best = { face, sig, score };
    if (score <= 2) break; // different enough
  }
  return {
    face: best.face,
    state: { version: state.version, cursor: (state.cursor + 1) >>> 0, recent: [best.sig, ...state.recent].slice(0, RECENT) },
  };
}
