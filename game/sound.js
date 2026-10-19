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
const hold = (p, t) => (p.cancelAndHoldAtTime ? p.cancelAndHoldAtTime(t) : p.cancelScheduledValues(t));

// ---- the tools' textures ----
// Each tool's sound is a texture built sample by sample, the way the real thing makes its sound: a brush is
// thousands of tiny bristle-tip contacts over a soft body of air; kohl is an irregular grain; a felt tip is a
// smooth, almost silent glide; a mascara wand's rows of bristles comb through lashes; lipstick drags over skin in
// tiny stick-slip catches (gloss: wet and tacky). 2.5 s of each is built when the tool is first used and loops
// under the stroke; it plays faster, brighter and louder as the hand speeds up, as friction does.
function dsp(sr, seconds) {
  const fade = Math.round(sr * 0.05), n = Math.round(sr * seconds) + fade;
  const rnd = Math.random, gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
  const k = (fc) => 1 - Math.exp((-2 * Math.PI * fc) / sr);
  const f = {
    n, sr,
    noise: (gain = 1) => Float32Array.from({ length: n }, () => (rnd() * 2 - 1) * gain),
    // a Poisson stream of impulses, `rate` a second, sizes from amp(), random signs
    impulses(rate, amp) {
      const x = new Float32Array(n);
      for (let t = -Math.log(1 - rnd()) / rate * sr; t < n; t += -Math.log(1 - rnd()) / rate * sr) x[t | 0] += amp() * (rnd() < 0.5 ? -1 : 1);
      return x;
    },
    // a jittered pulse train (stick-slip): about `hz` a second, wandering in pitch
    pulses(hz, jitter, amp) {
      const x = new Float32Array(n);
      let p = hz;
      for (let t = 0; t < n; t += sr / p) { x[t | 0] += amp(); p = Math.max(hz * 0.5, Math.min(hz * 1.6, p * (1 + gauss() * jitter))); }
      return x;
    },
    lowpass(x, fc, poles = 1) { const a = k(fc); for (let j = 0; j < poles; j++) { let y = 0; for (let i = 0; i < n; i++) x[i] = y += a * (x[i] - y); } return x; },
    highpass(x, fc) { const a = k(fc); let y = 0; for (let i = 0; i < n; i++) { y += a * (x[i] - y); x[i] -= y; } return x; },
    // a resonance (RBJ band-pass, constant peak gain): rings each impulse at f
    resonate(x, fr, q) {
      const w = (2 * Math.PI * fr) / sr, al = Math.sin(w) / (2 * q), a0 = 1 + al;
      const b0 = al / a0, a1 = (-2 * Math.cos(w)) / a0, a2 = (1 - al) / a0;
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      for (let i = 0; i < n; i++) { const y = b0 * x[i] - b0 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = y; x[i] = y; }
      return x;
    },
    // a slow, uneven swell (the pressure and angle of a real hand), `hz` a second, `depth` of the level
    swell(x, hz, depth) {
      let ph = rnd() * 6.283, r = 0;
      for (let i = 0; i < n; i++) { ph += (2 * Math.PI * hz) / sr; r += (gauss() * 0.02 - r * 0.0005); x[i] *= 1 - depth * (0.5 + 0.5 * Math.sin(ph + r)); }
      return x;
    },
    mix: (...parts) => { const x = new Float32Array(n); for (const [p, g] of parts) for (let i = 0; i < n; i++) x[i] += p[i] * g; return x; },
    // loop seamlessly (the tail fades into the head), set the average level (RMS 0.25, so every build of a random
    // texture is as loud as the last) and round off the rare big clicks
    finish(x) {
      const m = n - fade, y = x.slice(0, m);
      for (let i = 0; i < fade; i++) { const t = i / fade; y[i] = y[i] * t + x[m + i] * (1 - t); }
      let e = 0; for (const v of y) e += v * v;
      const g = 0.25 / (Math.sqrt(e / m) || 1);
      for (let i = 0; i < m; i++) y[i] = Math.tanh(y[i] * g);
      return y;
    },
  };
  return f;
}
const logn = (s) => () => Math.exp(s * Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random()));
const TEXTURE = {
  // a soft powder brush: a body of air, and a dense rustle of bristle tips
  brush(d) {
    const body = d.lowpass(d.noise(), 700, 2);
    const tips = d.lowpass(d.resonate(d.impulses(2200, logn(0.6)), 2300, 0.8), 4500);
    return d.swell(d.mix([body, 1.6], [tips, 0.9]), 1.7, 0.35);
  },
  // a fan brush: fewer, finer, higher tips and less body; airy
  glow(d) {
    const body = d.lowpass(d.noise(), 1200, 2);
    const tips = d.lowpass(d.resonate(d.impulses(1200, logn(0.7)), 4200, 1.1), 7000);
    return d.swell(d.mix([body, 0.6], [tips, 1]), 2.2, 0.3);
  },
  // kohl on soft skin: an irregular grain, muted
  pencil(d) {
    const grain = d.resonate(d.impulses(420, logn(0.9)), 2100, 2.2);
    const fine = d.resonate(d.impulses(1600, logn(0.5)), 3600, 1.4);
    const body = d.lowpass(d.noise(), 600, 2);
    return d.swell(d.lowpass(d.mix([grain, 1], [fine, 0.35], [body, 0.5]), 4200), 3, 0.25);
  },
  // a felt tip: smooth and almost silent, a breath of the tip on skin
  liner(d) {
    const body = d.lowpass(d.noise(), 1000, 2);
    const tip = d.resonate(d.noise(), 4200, 2.5);
    return d.swell(d.mix([body, 1], [tip, 0.05]), 1.2, 0.15);
  },
  // a mascara wand: its rows of bristles comb through lashes in a quick flutter
  mascara(d) {
    const rows = d.resonate(d.pulses(38, 0.15, () => 0.6 + Math.random() * 0.4), 3000, 1.2);
    const flicks = d.resonate(d.impulses(700, logn(0.8)), 3400, 2);
    const body = d.lowpass(d.noise(), 900, 2);
    return d.lowpass(d.mix([rows, 0.7], [flicks, 1], [body, 0.25]), 6000);
  },
  // lipstick: waxy stick-slip catches as it drags, over a soft body
  lip(d) {
    const catches = d.resonate(d.pulses(95, 0.06, () => 0.5 + Math.random() * 0.5), 720, 4);
    const body = d.lowpass(d.noise(), 800, 2);
    return d.swell(d.lowpass(d.mix([catches, 1], [body, 0.9]), 2200, 2), 2.5, 0.3);
  },
  // gloss: a smoother, wetter drag with sticky little pops as the wand lifts off the gloss
  gloss(d) {
    const tacks = d.lowpass(d.resonate(d.impulses(16, logn(0.5)), 380, 5), 1500);
    const drag = d.resonate(d.pulses(70, 0.08, () => 0.3 + Math.random() * 0.3), 600, 3);
    const body = d.lowpass(d.noise(), 1100, 2);
    return d.swell(d.mix([tacks, 1.4], [drag, 0.6], [body, 0.8]), 2, 0.25);
  },
};
const textures = new Map();
function texture(c, kind) {
  const key = `${kind}@${c.sampleRate}`;
  if (!textures.has(key)) {
    const d = dsp(c.sampleRate, 2.5), data = d.finish(TEXTURE[kind](d)), b = c.createBuffer(1, data.length, c.sampleRate);
    b.getChannelData(0).set(data);
    textures.set(key, b);
  }
  return textures.get(key);
}

// How each tool plays its texture: its level at full speed (the tools are quiet and close, well under the menu
// sounds), ref: the speed (decimetres a second) that reaches full level, lp: its brightness at full speed;
// glints: the highlighter's faint sparkle; lift: the soft tick as the liner's tip leaves the skin.
const TOOL = {
  brush: { gain: 0.05, ref: 1.6, lp: 5000 },
  glow: { gain: 0.045, ref: 1.3, lp: 8000, glints: 0.07 },
  pencil: { gain: 0.04, ref: 1, lp: 4500 },
  liner: { gain: 0.032, ref: 0.9, lp: 3000, lift: { f: 2600, q: 2, dur: 0.01, gain: 0.025 } },
  mascara: { gain: 0.04, ref: 1, lp: 6500 },
  lip: { gain: 0.04, ref: 1, lp: 2400 },
};

// A stroke's voice: stroke(tool, colour) at pointer-down, move() for every pointer sample, end() at pointer-up.
// Returns null when sound is off or the tool makes no stroke sound.
export function stroke(tool, colour) {
  const c = live(), r = TOOL[tool];
  if (!c || !r) return null;
  const t0 = c.currentTime, buffer = texture(c, tool === 'lip' && colour?.gloss ? 'gloss' : tool);
  const src = c.createBufferSource(), lp = c.createBiquadFilter(), g = c.createGain();
  src.buffer = buffer; src.loop = true;
  lp.type = 'lowpass'; lp.frequency.value = r.lp; lp.Q.value = 0.5;
  g.gain.value = 0;
  src.connect(lp).connect(g).connect(sfx.out);
  src.start(t0, Math.random() * (buffer.duration - 0.1));
  let sparkle = 0, touched = false, ended = false;
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
        src.playbackRate.setTargetAtTime(0.8 + 0.35 * Math.min(k, 1), at, 0.06);
        lp.frequency.setTargetAtTime(r.lp * (0.55 + 0.45 * Math.min(k, 1)), at, 0.06);
      }
      if (!contact || !(d > 0)) return;
      touched = true;
      if (r.glints && (sparkle += d) >= r.glints) {
        sparkle = 0;
        ping(c, at + Math.random() * 0.02, 5000 + Math.random() * 3500, 0.006 + Math.random() * 0.008, 0.06);
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
  if (c) tapSound(c, kind, colour, at);
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
