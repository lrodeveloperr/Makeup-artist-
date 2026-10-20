// Fixed tool behaviour (contract §2: no size, opacity, intensity or pressure settings; repeated passes and the
// player's path decide the result). Distances are decimetres in the reference-head frame (the face is about
// 1.3 dm wide), so a tool covers the same part of every face at any screen size.
//   radius   dab radius
//   edge     where the falloff begins (0: a soft Gaussian brush; nearer 1: a crisper edge)
//   spacing  distance between dabs along the path, as a fraction of the radius
//   pass     opacity one pass leaves along the middle of its path; passes build up towards the full colour
//   step     spacing of the stored path points (the path between them is straight); live painting and replay
//            both work from the stored points, so this sets the save size, not the look
//   taper    the liquid liner's line thins to a point over `start` at the beginning of a segment and over `end`
//            at its end, down to `min` of the radius (see TaperWalker)
// The mascara wand coats the lashes it touches (reach: half-width of the wand in the face's screen plane);
// each stroke that touches a lash adds one coat: colour moves `coat` of the way to the mascara, and the lash
// grows by `length` and thickens by `width` (factors of its natural size) up to the caps.
export const TOOLS = {
  brush: { radius: 0.09, edge: 0, spacing: 0.2, pass: 0.3, step: 0.02 },
  // highlighter: a smaller soft brush for the high points (cheekbones, nose, brow bone, cupid's bow)
  glow: { radius: 0.055, edge: 0, spacing: 0.2, pass: 0.35, step: 0.015 },
  pencil: { radius: 0.011, edge: 0.7, spacing: 0.3, pass: 0.85, step: 0.007 },
  // liquid liner: a fine, crisp, opaque line that tapers at both ends (wings and flicks)
  liner: { radius: 0.012, edge: 0.88, spacing: 0.15, pass: 0.95, step: 0.006, taper: { start: 0.02, end: 0.07, min: 0.3 } },
  lip: { radius: 0.03, edge: 0.5, spacing: 0.25, pass: 0.55, step: 0.008 },
  // (owner, 20 October 2026: a coat must show at a glance: the wand is as wide as its brush, and one coat takes the
  // lashes most of the way to the mascara's colour, a sixth longer and half again as thick; a second coat adds more)
  mascara: { reach: 0.032, coat: 0.8, length: 0.16, lengthMax: 1.5, width: 0.55, widthMax: 2.4, step: 0.01 },
};
// tools that paint the skin (the mascara wand works on lashes; face gems are placed one at a time)
export const SURFACE_TOOLS = new Set(['brush', 'glow', 'pencil', 'liner', 'lip']);

const smooth = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
// dab coverage at distance d (in radii) from its centre; the paint shader uses the same function
export function falloff(edge, d) {
  if (d >= 1) return 0;
  return edge > 0 ? 1 - smooth(edge, 1, d) : Math.exp(-4 * d * d) * (1 - smooth(0.85, 1, d));
}
export const FALLOFF_GLSL = /* glsl */ `
float dabFalloff(float edge, float d) {
  if (d >= 1.0) return 0.0;
  return edge > 0.0 ? 1.0 - smoothstep(edge, 1.0, d) : exp(-4.0 * d * d) * (1.0 - smoothstep(0.85, 1.0, d));
}`;

// Per-dab opacity so that one straight pass leaves `pass` along its middle: dabs every `spacing` radii add
// coverage 1 - prod(1 - rate * falloff(k * spacing)).
const rates = new Map();
export function dabRate(tool, sheer = 1) {
  if (!rates.has(tool)) {
    const t = TOOLS[tool];
    let sum = 0;
    for (let k = -Math.ceil(1 / t.spacing); k <= Math.ceil(1 / t.spacing); k++) sum += falloff(t.edge, Math.abs(k * t.spacing));
    rates.set(tool, 1 - (1 - t.pass) ** (1 / sum));
  }
  return rates.get(tool) * sheer;
}

// Places dabs at a fixed spacing along the path as points arrive. Live painting and replay from the saved
// stroke feed it the same points, so both place exactly the same dabs. lift() ends a segment (the pointer left
// the face); the next point starts a new one with a dab of its own.
export class DabWalker {
  constructor(tool) { this.step = TOOLS[tool].radius * TOOLS[tool].spacing; this.last = null; this.since = 0; }
  // p: [x, y, z]; returns the dabs placed by reaching it
  add(p) {
    const out = [];
    if (!this.last) { out.push(p.slice()); this.last = p.slice(); this.since = 0; return out; }
    const a = this.last, d = Math.hypot(p[0] - a[0], p[1] - a[1], p[2] - a[2]);
    let s = this.step - this.since;
    while (s <= d) {
      const t = s / d;
      out.push([a[0] + (p[0] - a[0]) * t, a[1] + (p[1] - a[1]) * t, a[2] + (p[2] - a[2]) * t]);
      s += this.step;
    }
    this.since = d - (s - this.step);
    this.last = p.slice();
    return out;
  }
  // ends the segment; returns the dabs still to draw (none: every dab is drawn as it is placed)
  lift() { this.last = null; return []; }
}

// The liner's walker: the same dabs, each with a size (dab[3], a factor of the radius) that thins the line to a
// point at both ends of a segment. The start is known at once; the end is not, so the dabs within `end` of the
// pen wait (a few pixels behind it) until the line goes on, or until the pen lifts and they are drawn thinning
// to the tip. Live painting and replay feed it the same points, so both draw the same dabs.
const ease = (t) => { t = Math.min(Math.max(t, 0), 1); return t * (2 - t); };
export class TaperWalker {
  constructor(tool) {
    const t = TOOLS[tool];
    this.walker = new DabWalker(tool); this.taper = t.taper; this.step = t.radius * t.spacing;
    this.keep = Math.ceil(t.taper.end / this.step); this.n = 0; this.held = [];
  }
  size(d, length) { return this.taper.min + (1 - this.taper.min) * ease(d / length); }
  add(p) {
    for (const q of this.walker.add(p)) { q[3] = this.size(this.n++ * this.step, this.taper.start); this.held.push(q); }
    return this.held.length > this.keep ? this.held.splice(0, this.held.length - this.keep) : [];
  }
  lift() {
    const out = this.held, k = out.length;
    out.forEach((q, i) => { q[3] = Math.min(q[3], this.size((k - 1 - i) * this.step, this.taper.end)); });
    this.held = []; this.n = 0; this.walker.lift();
    return out;
  }
}
export const walkerFor = (tool) => (TOOLS[tool].taper ? new TaperWalker(tool) : new DabWalker(tool));
