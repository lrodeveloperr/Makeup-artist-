// The game's sounds (owner decisions, 19 October 2026: satisfying ASMR sounds, no music). The makeup tools and the
// taps on the face are real CC0 recordings (see below and ASSETS.md):
//   soft brush    a makeup brush on skin
//   highlighter   a softer, airier brush pass
//   pencil        a soft pencil stroke
//   liquid liner  fine felt tips, softened
//   mascara       a mascara wand's bristles (only while it touches lashes)
//   lipstick      a creamy rub on skin; gloss: lip gloss being applied
//   face gems     a tap on glass (iridescent: a little brighter), a small hard click (pearl), a jewellery click (metal)
//   lenses        a single droplet
// A stroke's sound follows the hand: louder, quicker and brighter with speed, silent when the hand stops or leaves
// the face. The small sounds of the controls are synthesised (no music). Silent unless the host allows sound
// (contract §11: the host's audio setting rules every sound).
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
    decodeAll(sfx.ctx);
  }
  if (sfx.ctx.state === 'suspended') sfx.ctx.resume().catch(() => {});
  return sfx.ctx;
}
// for tests: how many sounds were asked for while sound was on, how many recordings are decoded, and how many
// strokes played their tool's recording
export const stats = { played: 0, loaded: 0, strokes: 0 };
const live = () => { const c = sfx.on ? context() : null; if (c) stats.played++; return c; };

// the host's audio setting (sounds are created only while it allows them)
export function setEnabled(on) {
  sfx.on = !!on;
  if (sfx.on) context(); // start now, so the recordings are decoded before the first stroke
}
// for rendering the sounds offline (tests and listening samples): play into this context instead
export function useContext(c) { Object.assign(sfx, { ctx: c, out: master(c), on: true, white: null, pink: null }); decodeAll(c); }

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
const hold = (p, t) => (p.cancelAndHoldAtTime ? p.cancelAndHoldAtTime(t) : p.cancelScheduledValues(t));

// ---- the tools' recordings ----
// Real CC0 recordings (Freesound; credited in ASSETS.md), cut by tools/make-sounds.py: a 2.5 s loop of each tool
// moving (with 0.15 s of the loop's own sound on both sides, so the loop is exact whatever an MP3 decoder adds at
// the start), and a one-shot for each kind of tap. The files load as the game starts; a sound whose file has not
// arrived yet stays silent.
const FILES = ['brush', 'glow', 'pencil', 'liner', 'mascara', 'lip', 'gloss', 'gem-glass', 'gem-pearl', 'gem-metal', 'lens'];
const LOOP = 2.5, PAD = 0.15;
const files = { base: '', bytes: null, ctx: null, buffers: new Map(), decoding: Promise.resolve() };
// fetch the recordings (base: where they are, relative to the page)
export function preload(base = '') {
  files.base = base;
  files.bytes = new Map(FILES.map((n) => [n, fetch(`${base}snd-${n}.mp3`).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null)]));
  files.ctx = null;
}
function decodeAll(c) {
  if (files.ctx === c) return files.decoding;
  if (!files.bytes) preload(files.base);
  files.ctx = c; files.buffers = new Map();
  files.decoding = Promise.all([...files.bytes].map(async ([n, p]) => {
    const bytes = await p;
    if (bytes) try { files.buffers.set(n, await c.decodeAudioData(bytes.slice(0))); } catch { /* an undecodable file stays silent */ }
    stats.loaded = files.buffers.size;
  }));
  return files.decoding;
}
// resolves once the recordings are decoded for the current context (for tests)
export const ready = () => (sfx.ctx ? decodeAll(sfx.ctx) : Promise.resolve());

// How each tool plays its recording: its level at full speed (quiet and close, well under the menu sounds), ref:
// the speed (decimetres a second) that reaches full level, lp: its brightness at full speed. Gloss has its own
// recording, played by the lip applicator for a gloss colour.
const TOOL = {
  brush: { gain: 0.14, ref: 1.6, lp: 11000 },
  glow: { gain: 0.11, ref: 1.3, lp: 12000 },
  pencil: { gain: 0.1, ref: 1, lp: 5000 },
  liner: { gain: 0.08, ref: 0.9, lp: 3500 },
  mascara: { gain: 0.1, ref: 1, lp: 12000 },
  lip: { gain: 0.12, ref: 1, lp: 8000 },
};

// A stroke's voice: stroke(tool, colour) at pointer-down, move() for every pointer sample, end() at pointer-up.
// Returns null when sound is off, the tool makes no stroke sound or its recording has not arrived.
export function stroke(tool, colour) {
  const c = live(), r = TOOL[tool], buffer = c && r && files.buffers.get(tool === 'lip' && colour?.gloss ? 'gloss' : tool);
  if (!buffer) return null;
  stats.strokes++;
  const t0 = c.currentTime;
  const src = c.createBufferSource(), lp = c.createBiquadFilter(), g = c.createGain();
  src.buffer = buffer; src.loop = true; src.loopStart = PAD; src.loopEnd = PAD + LOOP;
  lp.type = 'lowpass'; lp.frequency.value = r.lp; lp.Q.value = 0.5;
  g.gain.value = 0;
  src.connect(lp).connect(g).connect(sfx.out);
  src.start(t0, PAD + Math.random() * LOOP);
  let ended = false;
  return {
    // d: decimetres the hand moved over the face since the last sample; dt: seconds; contact: the tool is on the
    // skin (the mascara wand: on lashes); at: when (defaults to now)
    move(d, dt, contact, at = c.currentTime) {
      if (ended) return;
      const k = contact && dt > 0 ? Math.min(1.3, d / dt / r.ref) : 0;
      hold(g.gain, at);
      g.gain.setTargetAtTime(r.gain * Math.pow(k, 0.7), at, 0.03);
      g.gain.setTargetAtTime(0, at + 0.09, 0.04); // the hand stops: the sound fades with it
      if (k > 0) {
        // a quicker hand: the recording a touch faster and brighter, as friction is
        src.playbackRate.setTargetAtTime(0.92 + 0.16 * Math.min(k, 1), at, 0.06);
        lp.frequency.setTargetAtTime(r.lp * (0.6 + 0.4 * Math.min(k, 1)), at, 0.06);
      }
    },
    end(at = c.currentTime) {
      if (ended) return;
      ended = true;
      hold(g.gain, at);
      g.gain.setTargetAtTime(0, at, 0.03);
      src.stop(at + 0.3);
    },
  };
}

// A tap on the face: a gem setting on the skin (colour: the gem, with its look: glass, iridescent glass, pearl or
// metal), or a lens on an iris.
export function tap(kind, colour, at) {
  const c = live();
  if (!c) return;
  const look = colour?.look, name = kind === 'lens' ? 'lens' : look === 'pearl' ? 'gem-pearl' : look === 'metal' ? 'gem-metal' : 'gem-glass';
  const buffer = files.buffers.get(name);
  if (!buffer) return;
  const s = c.createBufferSource(), g = c.createGain();
  s.buffer = buffer;
  s.playbackRate.value = (look === 'iris' ? 1.18 : 1) * (0.96 + Math.random() * 0.08); // no two gems ring quite alike
  g.gain.value = kind === 'lens' ? 0.16 : 0.2;
  s.connect(g).connect(sfx.out);
  s.start(at ?? c.currentTime + 0.005);
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
