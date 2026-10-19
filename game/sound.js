// The finish chime (Haircut's reveal chime, synthesised: no audio files): a bright bell arpeggio with a little
// sparkle on top. Silent unless the host allows sound (contract §11: the host's audio setting rules every sound).
const sfx = { ctx: null, out: null };

function context() {
  if (!sfx.ctx) {
    const C = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!C) return null;
    sfx.ctx = new C();
    sfx.out = sfx.ctx.createGain();
    sfx.out.gain.value = 0.55;
    sfx.out.connect(sfx.ctx.destination);
  }
  if (sfx.ctx.state === 'suspended') sfx.ctx.resume().catch(() => {});
  return sfx.ctx;
}

// big: a finished look (the full arpeggio and sparkle); otherwise a short soft tone
export function chime(big = true) {
  const c = context();
  if (!c) return;
  const t0 = c.currentTime + 0.02;
  const notes = big ? [1046.5, 1318.5, 1568, 2093] : [1318.5];
  notes.forEach((f, i) => {
    const t = t0 + i * 0.075;
    for (const [mul, amp] of [[1, 0.16], [2.76, 0.045], [5.4, 0.015]]) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = f * mul;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(amp * (big ? 1 : 0.5), t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3 / mul + 0.25);
      o.connect(g).connect(sfx.out);
      o.start(t); o.stop(t + 1.6);
    }
  });
  if (!big) return;
  for (let k = 0; k < 6; k++) {
    const t = t0 + 0.28 + k * 0.06 + Math.random() * 0.03;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'triangle'; o.frequency.value = 3200 + Math.random() * 2600;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g).connect(sfx.out);
    o.start(t); o.stop(t + 0.15);
  }
}

// a host pause or muting stops what is playing
export function hush(on) {
  if (!sfx.ctx) return;
  if (on) sfx.ctx.suspend().catch(() => {}); else sfx.ctx.resume().catch(() => {});
}
