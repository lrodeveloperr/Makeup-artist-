// Small deterministic PRNG (mulberry32 with a murmur3-finalised seed), as used by Haircut's customer
// generator, so a saved seed always rebuilds the same face.
export function createRng(seed) {
  let a = seed >>> 0;
  a = Math.imul(a ^ (a >>> 16), 0x85ebca6b);
  a = Math.imul(a ^ (a >>> 13), 0xc2b2ae35);
  a = (a ^ (a >>> 16)) >>> 0 || 1;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng = {
    next,
    range: (lo, hi) => lo + (hi - lo) * next(),
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    chance: (p) => next() < p,
    // approximately normal (Irwin-Hall, four uniforms)
    gauss: (sd = 1) => (next() + next() + next() + next() - 2) * 1.732 * sd,
    // weighted pick from { key: weight }
    pick(weights) {
      const entries = Object.entries(weights).filter(([, w]) => w > 0);
      let total = 0;
      for (const [, w] of entries) total += w;
      let x = next() * total;
      for (const [k, w] of entries) if ((x -= w) < 0) return k;
      return entries[entries.length - 1][0];
    },
    // derived independent stream (so adding a trait later does not reshuffle the others)
    fork: (salt) => createRng((seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0),
  };
  return rng;
}
