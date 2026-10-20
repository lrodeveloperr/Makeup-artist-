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
// for tests: how many sounds were asked for while sound was on, how many recordings are decoded (and how many
// units each tool's has), and how many strokes played their tool's recording
export const stats = { played: 0, loaded: 0, units: {}, strokes: 0 };
const live = () => { const c = sfx.on ? context() : null; if (c) stats.played++; return c; };

// the host's audio setting (sounds are created only while it allows them)
export function setEnabled(on) {
  sfx.on = !!on;
  if (sfx.on) context(); // start now, so the recordings are decoded before the first stroke
}
// for tests: log when each stroke unit starts ([tool, time, legato]) into this array, or stop logging (null)
export function logUnits(list) { sfx.log = list; }
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
// paper: filtered noise whose pitch sweeps up as it rustles
function rustle(c, t, f0, f1, dur, gain) {
  noise(c);
  const s = c.createBufferSource(), bq = c.createBiquadFilter(), g = c.createGain();
  s.buffer = sfx.white; bq.type = 'bandpass'; bq.Q.value = 0.9;
  bq.frequency.setValueAtTime(f0, t); bq.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(bq).connect(g).connect(bus || sfx.out);
  s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.02);
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
// Real CC0 recordings (Freesound; credited in ASSETS.md), cut by tools/make-sounds.py into each tool's units, its
// single movements (one brush swish, one lipstick rub, one gloss swipe, one burst of mascara bristles, one pencil
// stroke), saved with silence between them; and a one-shot for each kind of tap. The files load as the game starts;
// a sound whose file has not arrived yet stays silent.
const FILES = ['brush', 'glow', 'pencil', 'liner', 'mascara', 'lip', 'gloss', 'gem-glass', 'gem-pearl', 'gem-metal', 'lens'];
const files = { base: '', bytes: null, ctx: null, buffers: new Map(), units: new Map(), decoding: Promise.resolve() };
// fetch the recordings (base: where they are, relative to the page)
export function preload(base = '') {
  files.base = base;
  files.bytes = new Map(FILES.map((n) => [n, fetch(`${base}snd-${n}.mp3`).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null)]));
  files.ctx = null;
}
function decodeAll(c) {
  if (files.ctx === c) return files.decoding;
  if (!files.bytes) preload(files.base);
  files.ctx = c; files.buffers = new Map(); files.units = new Map();
  files.decoding = Promise.all([...files.bytes].map(async ([n, p]) => {
    const bytes = await p;
    if (bytes) try { const b = await c.decodeAudioData(bytes.slice(0)); files.buffers.set(n, b); files.units.set(n, findUnits(b)); stats.units[n] = files.units.get(n).length; } catch { /* an undecodable file stays silent */ }
    stats.loaded = files.buffers.size;
  }));
  return files.decoding;
}
// a tool's units in its decoded sound: [start, end] in seconds, found by the silence between them (so they are exact
// whatever silence the decoder adds at the start)
function findUnits(b) {
  const d = b.getChannelData(0), step = Math.round(b.sampleRate * 0.005), out = [];
  let start = -1, quiet = 0;
  for (let i = 0; i < d.length; i += step) {
    let m = 0;
    for (let j = i; j < Math.min(i + step, d.length); j++) m = Math.max(m, Math.abs(d[j]));
    if (m > 0.003) { if (start < 0) start = i; quiet = 0; }
    else if (start >= 0 && ++quiet * 0.005 >= 0.09) { out.push([start / b.sampleRate, (i - (quiet - 1) * step) / b.sampleRate]); start = -1; }
  }
  if (start >= 0) out.push([start / b.sampleRate, d.length / b.sampleRate]);
  return out.filter(([a, e]) => e - a > 0.05);
}
// resolves once the recordings are decoded for the current context (for tests)
export const ready = () => (sfx.ctx ? decodeAll(sfx.ctx) : Promise.resolve());

// How each tool plays its units: its level at full speed (quiet and close, well under the menu sounds), ref: the
// speed (decimetres a second) that reaches full level, lp: its brightness at full speed. Gloss has its own units,
// played by the lip applicator for a gloss colour.
const TOOL = {
  brush: { gain: 0.14, ref: 1.6, lp: 11000 },
  glow: { gain: 0.11, ref: 1.3, lp: 12000 },
  pencil: { gain: 0.1, ref: 1, lp: 5000 },
  liner: { gain: 0.08, ref: 0.9, lp: 3500 },
  mascara: { gain: 0.1, ref: 1, lp: 12000 },
  lip: { gain: 0.12, ref: 1, lp: 8000 },
  gloss: { gain: 0.12, ref: 1, lp: 9000 },
};
const TURN_PX = 3; // pixels of travel that set a sweep's direction
const BACK_PX = 2; // pixels moved back against it that make a turn
const LEGATO = 0.3; // how much of a unit's start a legato unit leaves out (its attack)
// pixels a new movement (a stroke's start, a turn back) must really travel before its sound starts: a finger slipping
// back as it lifts, or a touch that barely moves, makes no sound (owner, 19 October 2026: the process only)
const MOVE_PX = 4;

// A stroke's voice: stroke(tool, colour) at pointer-down, move() for every pointer sample, end() at pointer-up.
// The sound keeps time with the hand, not with the recording: every sweep plays one of the tool's units, a fresh one
// whenever the hand turns back (brushing back and forth: swish, swish) or moves on after a pause. The voice learns
// how long the hand's sweeps take and picks a unit of about that length, played a touch faster or slower to fit, so
// one sweep sounds as one movement; only a sweep longer than any unit runs on into a second, overlapping the end of
// the first. A quicker hand plays it louder and brighter; when the hand stops or leaves the face, it fades.
// Returns null when sound is off, the tool makes no stroke sound or its recording has not arrived.
export function stroke(tool, colour) {
  const c = live(), name = tool === 'lip' && colour?.gloss ? 'gloss' : tool, r = TOOL[name];
  const buffer = c && r && files.buffers.get(name), units = files.units.get(name);
  if (!buffer || !units?.length) return null;
  stats.strokes++;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = r.lp; lp.Q.value = 0.5;
  lp.connect(sfx.out);
  let cur = null, last = -1, dir = null, ax = 0, ay = 0, back = 0, ended = false;
  // the hand's own clock (seconds, from its samples' times, so a busy frame never looks like a pause), its sweeps
  // (learnt as it goes), and when this sweep began on it
  let hand = 0, moved = -1, sweep = 0.35, began = -1, waiting = false;
  // how far the hand's sweeps reach (pixels, learnt as it goes) and how far this one has come: with the time it has
  // taken, when it will turn
  let span = 0, travel = 0;
  const level = (k) => r.gain * Math.pow(k, 0.7);
  const fade = (u, at, tau = 0.03) => {
    if (!u) return;
    hold(u.g.gain, at); u.g.gain.setTargetAtTime(0, at, tau);
    try { u.s.stop(at + tau * 8); } catch { /* already stopped */ }
  };
  // one movement: a unit about as long as the hand's sweeps (one of the three closest, never the same one twice
  // running), played a touch faster or slower to fit, faded in from where the last one is fading out. A sweep that
  // runs on past its unit carries on legato: the next unit joins in past its attack and the two cross-fade, so it
  // sounds as the same movement going on, not a new one
  const play = (at, k, want = sweep, legato = false) => {
    fade(cur, at, legato ? 0.06 : 0.03);
    const skip = legato ? LEGATO : 0;
    const fit = units.map((u, i) => [Math.abs(Math.log(((u[1] - u[0]) * (1 - skip)) / (want * 1.15))), i]).sort((p, q) => p[0] - q[0]).slice(0, Math.min(3, units.length));
    let i = fit[Math.floor(Math.random() * fit.length)][1];
    if (units.length > 1 && i === last) i = fit.find(([, j]) => j !== last)?.[1] ?? i;
    last = i;
    // fitted to run a little past the sweep, so the turn, not the unit's end, starts the next movement
    const [u0, e] = units[i], a = u0 + skip * (e - u0), rate = Math.min(1.2, Math.max(0.85, (e - a) / (want * 1.15)));
    sfx.log?.push([tool, at, legato]);
    const s = c.createBufferSource(), g = c.createGain();
    s.buffer = buffer; s.playbackRate.value = rate;
    g.gain.setValueAtTime(0, at); g.gain.setTargetAtTime(level(k), at, legato ? 0.05 : 0.012);
    s.connect(g).connect(lp);
    s.start(at, a, e - a + 0.01);
    s.stop(at + (e - a) / rate + 0.05);
    cur = { s, g, start: at, end: at + (e - a) / rate, legato };
  };
  return {
    // d: decimetres the hand moved over the face since the last sample; dt: seconds; contact: the tool is on the
    // skin (the mascara wand: on lashes); dx, dy: the move on screen (pixels), for the sweep's direction; at: when
    move(d, dt, contact, dx = 0, dy = 0, at = c.currentTime) {
      if (ended) return;
      hand += Math.max(dt, 0);
      const k = contact && dt > 0 ? Math.min(1.3, d / dt / r.ref) : 0;
      if (k <= 0.02) return; // still or off the face: the scheduled fade runs on
      // after a pause the sweep's direction is learnt afresh
      const paused = moved < 0 || hand - moved > 0.12;
      moved = hand;
      if (paused) { dir = null; ax = ay = back = travel = 0; }
      // the sweep's direction, from a few pixels of travel; a turn as soon as the hand has moved a little back
      // against it
      let turned = false;
      ax += dx; ay += dy;
      if (!dir) {
        const len = Math.hypot(ax, ay);
        if (len >= TURN_PX) { dir = [ax / len, ay / len]; ax = ay = 0; travel = len; }
      } else {
        const along = dx * dir[0] + dy * dir[1];
        back = along < 0 ? back - along : 0;
        if (back >= BACK_PX) {
          const len = Math.hypot(ax, ay) || 1;
          if (travel > 0) span = span ? 0.6 * span + 0.4 * travel : travel;
          turned = true; dir = [ax / len, ay / len]; back = 0; travel = len;
        }
        if (along >= 0) { ax = ay = 0; travel += along; }
      }
      // learn the sweep's length from the hand turning back
      if (turned && began >= 0) sweep = Math.min(1.2, Math.max(0.12, 0.6 * sweep + 0.4 * (hand - began)));
      if (turned || paused) { began = hand; waiting = true; }
      // the new movement has really begun
      const starts = waiting && !!dir && travel >= MOVE_PX;
      if (starts) waiting = false;
      // when this sweep will turn: from how far the hand's sweeps reach and how quickly this one is going (or, until
      // it has swept once, from how long its sweeps take); one that has gone past it is a longer stroke, expected to
      // run on half as long again
      const gone = hand - began, pace = travel > 0 && gone > 0.03 ? gone / travel : 0;
      const ahead = span && pace ? (span - travel) * pace : sweep - gone, left = ahead > 0 ? ahead : 0.5 * gone;
      // a new movement: the first, after a pause, on turning back, or as a sweep runs on past its unit (near the
      // unit's end, or past it), fitted to the rest of the sweep; never just before the hand turns, as the turn
      // brings the next movement
      const runsOn = cur && !waiting && !starts && left > 0.15 && (at >= cur.end - 0.03 || (at >= cur.start + 0.85 * (cur.end - cur.start) && gone >= 0.8 * sweep));
      // a unit that has only just begun is the new movement (but a turn always brings its own)
      const fresh = cur && at - cur.start < 0.06 && !(starts && cur.legato);
      if ((starts || runsOn) && !fresh) play(at, k, runsOn ? left : sweep, runsOn);
      else if (cur) { hold(cur.g.gain, at); cur.g.gain.setTargetAtTime(level(k), at, 0.03); }
      lp.frequency.setTargetAtTime(r.lp * (0.6 + 0.4 * Math.min(k, 1)), at, 0.06);
      // the hand stops: the sound fades with it
      cur?.g.gain.setTargetAtTime(0, at + 0.09, 0.04);
    },
    end(at = c.currentTime) {
      if (ended) return;
      ended = true;
      fade(cur, at, 0.06); // a gentle release, never a cut
      cur = null;
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

// The controls: picking up a tool, tapping a colour, turning the colours' page, the daily card opening, its clock
// ticking, the gift opening, the next customer sitting down, a refusal.
export function ui(kind, at) {
  const c = live();
  if (!c) return;
  bus = sfx.taps;
  try { uiSound(c, kind, at); } finally { bus = null; }
}
function uiSound(c, kind, at) {
  const t = at ?? c.currentTime + 0.005;
  if (kind === 'tool') { grain(c, t, { f: 1900, q: 1.2, dur: 0.016, gain: 0.2 }); glide(c, t, 170, 95, 0.12, 0.05); }
  else if (kind === 'page') grain(c, t, { f: 2200, q: 1.5, dur: 0.012, gain: 0.1 }); // the colours' page turning
  // the gift's clock: a soft tick, then a lower tock
  else if (kind === 'tick' || kind === 'tock') { const tock = kind === 'tock'; grain(c, t, { f: tock ? 1900 : 2600, q: 6, dur: 0.035, gain: 0.05 }); ping(c, t, tock ? 1150 : 1500, 0.02, 0.04, 'triangle'); }
  else if (kind === 'unwrap') {
    // the gift opening: a rustle of paper, a pop as the lid comes off, then a sparkling chime that settles on a
    // warm chord
    rustle(c, t, 900, 4200, 0.32, 0.12); rustle(c, t + 0.12, 2400, 5200, 0.22, 0.07);
    glide(c, t + 0.42, 200, 70, 0.2, 0.16); grain(c, t + 0.42, { f: 1100, q: 0.7, dur: 0.05, gain: 0.1 });
    [1046.5, 1318.5, 1568, 2093, 2637, 3136].forEach((f, k) => { ping(c, t + 0.5 + k * 0.055, f, 0.055, 0.55); ping(c, t + 0.5 + k * 0.055, f * 2.76, 0.012, 0.25); });
    [523.25, 659.25, 783.99, 1046.5].forEach((f) => { ping(c, t + 0.86, f, 0.035, 1.6); ping(c, t + 0.86, f * 2, 0.009, 1.0); });
    for (let k = 0; k < 10; k++) ping(c, t + 0.6 + Math.random() * 0.8, 3000 + Math.random() * 3000, 0.025, 0.12);
  }
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
