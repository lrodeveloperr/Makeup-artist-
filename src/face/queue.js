// Variety director for the customer queue: rotates through every heritage (see ROTATION) and, within the
// heritage that is due, picks the face that looks most different from the last few (ancestry, skin tone,
// hairstyle, parting, hair colour, outfit colour...). Deterministic from the saved state, so the previewed next
// face never changes after a reload. Never stalls: after a few candidates it takes the most different one.
import { generateFace, signature, GENERATOR_VERSION } from './generator.js';
import { PROFILES } from './profiles.js';
import { createRng } from './rng.js';

export const RECENT = 4;
const CANDIDATES = 8;
// weights of each signature field when comparing with the previous face (index 0) and older ones
const FIELD_WEIGHT = [3, 1, 3, 1, 0.5, 2, 0.5, 1, 2]; // origin, presentation, style, hair colour, iris, tone bin, brow shape, parting, outfit colour

// Heritage rotation: each run of ROTATION faces meets every one of the 15 heritages once, plus five mixed-
// heritage faces, in a shuffled order, so no heritage goes unseen for long.
const HERITAGES = [...Object.keys(PROFILES), 'blend', 'blend', 'blend', 'blend', 'blend'];
export const ROTATION = HERITAGES.length;
export const heritageOf = (face) => (face.origin.kind === 'blend' ? 'blend' : face.origin.parts[0].id);
function shuffled(seed, avoidFirst) {
  const rng = createRng(seed ^ 0x51ed), bag = HERITAGES.slice();
  for (let i = bag.length - 1; i > 0; i--) { const j = rng.int(0, i); [bag[i], bag[j]] = [bag[j], bag[i]]; }
  if (bag[0] === avoidFirst) bag.push(bag.shift()); // never the same heritage twice across a refill
  return bag;
}

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

// state: { version, cursor, recent: [signature, ...] (most recent first), bag: [heritages still due this rotation] }
export function createQueueState(seed = 1) {
  return { version: GENERATOR_VERSION, cursor: seed >>> 0, recent: [], bag: shuffled(seed >>> 0) };
}

export function nextFace(state) {
  const bag = state.bag?.length ? state.bag : shuffled(state.cursor, state.last);
  const want = bag[0];
  let best = null, found = 0;
  // candidates of the heritage that is due (a few hundred seeds at most; generating a record is cheap)
  for (let k = 0; found < CANDIDATES && k < 5000; k++) {
    const face = generateFace(mixSeed(state.cursor, k));
    if (heritageOf(face) !== want) continue;
    found++;
    const sig = signature(face);
    const score = similarity(sig, state.recent);
    if (!best || score < best.score) best = { face, sig, score };
    if (score <= 2) break; // different enough
  }
  if (!best) { const face = generateFace(mixSeed(state.cursor, 0)); best = { face, sig: signature(face) }; }
  return {
    face: best.face,
    state: {
      version: state.version, cursor: (state.cursor + 1) >>> 0, recent: [best.sig, ...state.recent].slice(0, RECENT),
      bag: bag.slice(1), last: want,
    },
  };
}
