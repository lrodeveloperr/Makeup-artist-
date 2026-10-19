// The game's sounds, all synthesised (no audio files, no music): each makeup tool as it touches the face, taps,
// and the small sounds of the controls. ASMR in spirit: close, soft and true to the product:
//   soft brush    bristles sweeping powder over skin
//   highlighter   a lighter, airier fan brush with fine glints
//   pencil        the grainy scratch of a kohl tip
//   liquid liner  a smooth felt-tip glide, and a soft tick as the tip lifts
//   mascara       the wand's bristles flicking through lashes (only while it touches them)
//   lipstick      a creamy, waxy glide; gloss is wet and tacky
//   face gems     a click as the gem sets, then its ring: crystal, pearl or metal
//   lenses        a soft, wet plip
// A stroke's sound follows the hand: louder and brighter with speed, silent when the hand stops or leaves the face.
// Silent unless the host allows sound (contract §11: the host's audio setting rules every sound).
const sfx = { ctx: null, out: null, taps: null, on: false, white: null, pink: null };
let bus = null; // where the small helpers play: the master, or the taps' bus

// the master: a little headroom and a gentle compressor, so many small sounds never clip
function master(c) {
  const out = c.createGain(), comp = c.createDynamicsCompressor();
  out.gain.value = 0.6;
  comp.threshold.value = -18; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.15;
  out.connect(comp).connect(c.destination);
  // taps and the controls sit a little above the strokes
  sfx.taps = c.createGain(); sfx.taps.gain.value = 1.4; sfx.taps.connect(out);
  return out;
}

function context() {
  if (!sfx.ctx) {
    const C = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!C) return null;
    sfx.ctx = new C();
    sfx.out = master(sfx.ctx);
  }
  if (sfx.ctx.state === 'suspended') sfx.ctx.resume().catch(() => {});
  return sfx.ctx;
}
// how many sounds have played (for tests)
export const stats = { played: 0 };
const live = () => { const c = sfx.on ? context() : null; if (c) stats.played++; return c; };

// the host's audio setting (sounds are created only while it allows them)
export function setEnabled(on) { sfx.on = !!on; }
// for rendering the sounds offline (tests and listening samples): play into this context instead
export function useContext(c) { Object.assign(sfx, { ctx: c, out: master(c), on: true, white: null, pink: null }); }

// two seconds of white and of pink noise, the raw material of every bristle, scratch and glide
function noise(c) {
  if (sfx.white?.sampleRate === c.sampleRate) return;
  const n = c.sampleRate * 2, w = c.createBuffer(1, n, c.sampleRate), p = c.createBuffer(1, n, c.sampleRate);
  const W = w.getChannelData(0), P = p.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) {
    const x = Math.random() * 2 - 1;
    W[i] = x;
    // Paul Kellet's pink filter
    b0 = 0.99886 * b0 + x * 0.0555179; b1 = 0.99332 * b1 + x * 0.0750759; b2 = 0.969 * b2 + x * 0.153852;
    b3 = 0.8665 * b3 + x * 0.3104856; b4 = 0.55 * b4 + x * 0.5329522; b5 = -0.7616 * b5 - x * 0.016898;
    P[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + x * 0.5362) * 0.11;
    b6 = x * 0.115926;
  }
  sfx.white = w; sfx.pink = p;
}

// a short burst of filtered noise: a click, a grain, a bristle, a tack
function grain(c, t, { f, q = 1.5, dur = 0.006, gain = 0.1, pink = false, type = 'bandpass' }) {
  noise(c);
  const s = c.createBufferSource(), bq = c.createBiquadFilter(), g = c.createGain();
  s.buffer = pink ? sfx.pink : sfx.white;
  bq.type = type; bq.frequency.value = f; bq.Q.value = q;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.0012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(bq).connect(g).connect(bus || sfx.out);
  s.start(t, Math.random() * 1.5);
  s.stop(t + dur + 0.01);
}
// a pure tone that rings and fades (glints, crystal, metal)
function ping(c, t, f, gain, decay, type = 'sine') {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  o.connect(g).connect(bus || sfx.out);
  o.start(t); o.stop(t + decay + 0.02);
}
// a tone that glides from one pitch to another (a plip, a thump, a pop)
function glide(c, t, f0, f1, gain, dur) {
  const o = c.createOscillator(), g = c.createGain();
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(bus || sfx.out);
  o.start(t); o.stop(t + dur + 0.02);
}
const between = ([a, b]) => a + Math.random() * (b - a);
const hold = (p, t) => (p.cancelAndHoldAtTime ? p.cancelAndHoldAtTime(t) : p.cancelScheduledValues(t));

// How each tool sounds on the face. bed: the continuous texture (filtered noise: band centre f, width q, top lp,
// level at full speed); ref: the speed (decimetres a second) that reaches full level; grains: discrete bristle or
// graphite ticks, one every `every` decimetres of travel; glints: the highlighter's sparkle; lift: the tick as the
// liner's tip leaves the skin.
const TOOL = {
  brush: { bed: { pink: true, f: 2400, q: 0.5, lp: 6500, gain: 0.64 }, ref: 1.6 },
  glow: { bed: { pink: true, f: 4200, q: 0.7, lp: 9500, gain: 0.48 }, ref: 1.3, glints: 0.06 },
  pencil: { bed: { f: 3600, q: 1.1, lp: 8000, gain: 0.14 }, ref: 1, grains: { every: 0.004, f: [2800, 5200], q: 2.5, dur: 0.004, gain: [0.08, 0.22] } },
  liner: { bed: { f: 1600, q: 1.6, lp: 3800, gain: 0.32 }, ref: 0.9, lift: { f: 2600, q: 2, dur: 0.012, gain: 0.14 } },
  mascara: { bed: { f: 3000, q: 0.7, lp: 7000, gain: 0.13 }, ref: 1, grains: { every: 0.0025, f: [2200, 4200], q: 2, dur: 0.0035, gain: [0.08, 0.24] } },
  lip: { bed: { pink: true, f: 850, q: 0.8, lp: 2400, gain: 0.68 }, ref: 1 },
};

// A stroke's voice: stroke(tool, colour) at pointer-down, move() for every pointer sample, end() at pointer-up.
// Returns null when sound is off or the tool makes no stroke sound.
export function stroke(tool, colour) {
  const c = live(), r = TOOL[tool];
  if (!c || !r) return null;
  noise(c);
  const t0 = c.currentTime;
  const src = c.createBufferSource(), bp = c.createBiquadFilter(), lp = c.createBiquadFilter(), g = c.createGain();
  src.buffer = r.bed.pink ? sfx.pink : sfx.white; src.loop = true;
  bp.type = 'bandpass'; bp.frequency.value = r.bed.f; bp.Q.value = r.bed.q;
  lp.type = 'lowpass'; lp.frequency.value = r.bed.lp;
  g.gain.value = 0;
  src.connect(bp).connect(lp).connect(g).connect(bus || sfx.out);
  src.start(t0, Math.random() * 1.5);
  const wet = (colour?.gloss || 0) > 0;
  let travel = 0, sparkle = 0, tack = 0, next = 0, touched = false, ended = false;
  return {
    // d: decimetres the hand moved over the face since the last sample; dt: seconds; contact: the tool is on the
    // skin (the mascara wand: on lashes); at: when (defaults to now)
    move(d, dt, contact, at = c.currentTime) {
      if (ended) return;
      const k = contact && dt > 0 ? Math.min(1.4, d / dt / r.ref) : 0;
      hold(g.gain, at);
      g.gain.setTargetAtTime(r.bed.gain * Math.pow(k, 0.6), at, 0.025);
      g.gain.setTargetAtTime(0, at + 0.09, 0.04); // the hand stops: the sound fades with it
      bp.frequency.setTargetAtTime(r.bed.f * (0.8 + 0.3 * Math.min(k, 1)), at, 0.05);
      if (!contact || !(d > 0)) return;
      touched = true;
      // grains: as many as the travel calls for, but never closer than 6 ms (they blur into the bed beyond that)
      if (r.grains) {
        travel += d;
        while (travel >= r.grains.every) {
          travel -= r.grains.every;
          const when = Math.max(at, next);
          if (when > at + dt + 0.01) { travel = 0; break; }
          grain(c, when, { f: between(r.grains.f), q: r.grains.q, dur: r.grains.dur, gain: between(r.grains.gain) });
          next = when + 0.006;
        }
      }
      if (r.glints && (sparkle += d) >= r.glints) {
        sparkle = 0;
        ping(c, at + Math.random() * 0.02, 4500 + Math.random() * 3500, 0.03 + Math.random() * 0.04, 0.07);
      }
      // lipstick drags and skips a little; gloss is wet and tacky
      if (tool === 'lip' && (tack += d) >= (wet ? 0.025 : 0.06)) {
        tack = 0;
        grain(c, at, wet ? { f: 700, q: 0.9, dur: 0.02, gain: 0.24, type: 'lowpass', pink: true } : { f: 1100, q: 1.2, dur: 0.01, gain: 0.1, pink: true });
      }
    },
    end(at = c.currentTime) {
      if (ended) return;
      ended = true;
      hold(g.gain, at);
      g.gain.setTargetAtTime(0, at, 0.03);
      src.stop(at + 0.3);
      if (r.lift && touched) grain(c, at, r.lift);
    },
  };
}

// A tap on the face: a gem setting on the skin (colour: the gem, with its look), or a lens on an iris.
export function tap(kind, colour, at) {
  const c = live();
  if (!c) return;
  bus = sfx.taps;
  try { tapSound(c, kind, colour, at); } finally { bus = null; }
}
function tapSound(c, kind, colour, at) {
  const t = at ?? c.currentTime + 0.005;
  if (kind === 'lens') {
    glide(c, t, 1150, 380, 0.13, 0.08);
    grain(c, t, { f: 1300, q: 1, dur: 0.012, gain: 0.05, type: 'lowpass' });
    return;
  }
  const look = colour?.look;
  grain(c, t, { f: look === 'pearl' ? 1500 : 2600, q: 1.6, dur: 0.014, gain: 0.22 });
  const r = t + 0.004;
  if (look === 'pearl') { ping(c, r, 2100, 0.03, 0.12); return; }
  if (look === 'metal') { for (const [f, a, d] of [[2960, 0.05, 0.55], [6120, 0.025, 0.35], [8350, 0.01, 0.2]]) ping(c, r, f, a, d); return; }
  // cut glass rings bright; iridescent glass adds a shimmer of glints
  for (const [f, a, d] of [[3520, 0.055, 0.4], [5274, 0.03, 0.3], [7040, 0.015, 0.22]]) ping(c, r, f * (0.98 + Math.random() * 0.04), a, d);
  if (look === 'iris') for (let k = 0; k < 3; k++) ping(c, r + 0.05 + k * 0.04, 6000 + Math.random() * 2500, 0.015, 0.08);
}

// The controls: picking up a tool, tapping a colour, the daily card opening, the next customer sitting down, a
// reward, a refusal.
export function ui(kind, at) {
  const c = live();
  if (!c) return;
  bus = sfx.taps;
  try { uiSound(c, kind, at); } finally { bus = null; }
}
function uiSound(c, kind, at) {
  const t = at ?? c.currentTime + 0.005;
  if (kind === 'tool') { grain(c, t, { f: 1900, q: 1.2, dur: 0.016, gain: 0.2 }); glide(c, t, 170, 95, 0.12, 0.05); }
  else if (kind === 'colour') { grain(c, t, { f: 2600, q: 2, dur: 0.009, gain: 0.12 }); ping(c, t, 1320, 0.025, 0.06); }
  else if (kind === 'panel') { glide(c, t, 320, 640, 0.07, 0.07); grain(c, t, { f: 1500, q: 1, dur: 0.01, gain: 0.08 }); }
  else if (kind === 'next') {
    // a soft whoosh as the next customer takes the chair
    noise(c);
    const s = c.createBufferSource(), bq = c.createBiquadFilter(), g = c.createGain();
    s.buffer = sfx.pink; bq.type = 'bandpass'; bq.Q.value = 1.2;
    bq.frequency.setValueAtTime(500, t); bq.frequency.exponentialRampToValueAtTime(2400, t + 0.38);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.16); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    s.connect(bq).connect(g).connect(bus || sfx.out);
    s.start(t, Math.random()); s.stop(t + 0.45);
  } else if (kind === 'reward') {
    // a rising sparkle
    for (let k = 0; k < 8; k++) ping(c, t + k * 0.045, 2000 * 1.16 ** k * (0.97 + Math.random() * 0.06), 0.03, 0.18);
    ping(c, t + 0.38, 1568, 0.06, 0.6); ping(c, t + 0.38, 2093, 0.04, 0.6);
  } else if (kind === 'nope') glide(c, t, 160, 115, 0.13, 0.1);
}

// The finish chime (Haircut's reveal chime): a bright bell arpeggio with a little sparkle on top for a finished
// look; a short soft tone for an untouched one.
export function chime(big = true, at) {
  const c = live();
  if (!c) return;
  const t0 = at ?? c.currentTime + 0.02;
  const notes = big ? [1046.5, 1318.5, 1568, 2093] : [1318.5];
  notes.forEach((f, i) => {
    const t = t0 + i * 0.075;
    for (const [mul, amp] of [[1, 0.16], [2.76, 0.045], [5.4, 0.015]]) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = f * mul;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(amp * (big ? 1 : 0.5), t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3 / mul + 0.25);
      o.connect(g).connect(bus || sfx.out);
      o.start(t); o.stop(t + 1.6);
    }
  });
  if (!big) return;
  for (let k = 0; k < 6; k++) {
    const t = t0 + 0.28 + k * 0.06 + Math.random() * 0.03;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'triangle'; o.frequency.value = 3200 + Math.random() * 2600;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g).connect(bus || sfx.out);
    o.start(t); o.stop(t + 0.15);
  }
}

// a host pause or muting stops what is playing
export function hush(on) {
  if (!sfx.ctx || !sfx.ctx.suspend) return;
  if (on) sfx.ctx.suspend().catch(() => {}); else sfx.ctx.resume().catch(() => {});
}
