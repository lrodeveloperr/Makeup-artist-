// The game's sounds, rendered offline in Chromium (tests/sound.html):
// - every tool's CC0 recording loads and splits into several units (single movements)
// - the sound keeps time with the hand: brushing back and forth, a fresh unit begins within 60 ms of every turn
//   (either side: a sweep's unit may begin just before the hand turns),
//   and units never stutter (two starting within 0.1 s of each other inside a sweep)
// - it is silent while the hand rests, and the tools stay quiet (peaks under the controls')
// - every tap and control sounds
// Writes tests/out/sounds/*.wav to listen to.
// Usage: node tools/build-game.mjs && node tests/sound.mjs
import fs from 'node:fs';
import { chromium } from 'playwright';
import { serve } from '../tools/serve.mjs';

const executablePath = process.env.CHROME || (process.env.CI ? undefined : '/opt/pw-browsers/chromium-1194/chrome-linux/chrome');
const server = await serve(process.cwd(), 8187);
const browser = await chromium.launch({ executablePath });
const errors = [];
const sr = 44100;
const TAKES = [['brush', 'brush', 'brush-rose'], ['highlighter', 'glow', 'glow-champagne'], ['pencil', 'pencil', 'pencil-black'], ['liner', 'liner', 'liner-black'],
  ['mascara', 'mascara', 'mascara-black'], ['lipstick', 'lip', 'lip-red'], ['lipgloss', 'lip', 'lip-red-gloss'], ['gems'], ['lens'], ['controls'], ['finish']];
const wav = (x) => {
  const b = Buffer.alloc(44 + x.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + x.length * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(x.length * 2, 40);
  x.forEach((v, i) => b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), 44 + i * 2));
  return b;
};
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:8187/tests/sound.html');
  await page.waitForFunction('window.ready');
  fs.mkdirSync('tests/out/sounds', { recursive: true });
  for (const [name, tool, colour] of TAKES) {
    const r = await page.evaluate(([n, t, c]) => window.render(n, t, c), [name, tool, colour]);
    const x = new Float32Array(Buffer.from(r.pcm, 'base64').buffer.slice(0));
    fs.writeFileSync(`tests/out/sounds/${name}.wav`, wav(x));
    const peak = x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    if (!(peak > 0.005)) errors.push(`${name}: silent`);
    if (!tool) { console.log(`${name.padEnd(12)} peak ${peak.toFixed(3)}`); continue; }
    const units = r.units[name === 'lipgloss' ? 'gloss' : tool];
    if (!(units >= 3)) errors.push(`${name}: only ${units} units in its recording`);
    if (peak > 0.12) errors.push(`${name}: peaks at ${peak.toFixed(3)}, louder than the controls`);
    // no two movements start within 60 ms of each other (a sound cut off as soon as it begins)
    for (let j = 1; j < r.attacks.length; j++) if (r.attacks[j] - r.attacks[j - 1] < 0.06) errors.push(`${name}: two units at ${r.attacks[j - 1].toFixed(2)} and ${r.attacks[j].toFixed(2)} s`);
    // a fresh movement (a unit with its attack) within 60 ms of every turn of the hand, and none inside a sweep: a
    // sweep that outlasts its unit carries on legato; inside a sweep, units never stutter
    for (const t of r.turns) if (!r.attacks.some((s) => Math.abs(s - t) <= 0.06)) errors.push(`${name}: no fresh movement within 60 ms of the turn at ${t.toFixed(2)} s`);
    for (const s of r.attacks) if (!r.turns.some((t) => Math.abs(s - t) <= 0.06)) errors.push(`${name}: a new movement at ${s.toFixed(2)} s, inside a sweep`);
    r.turns.forEach((t, i) => {
      const inside = r.starts.filter((s) => s >= t + 0.07 && s < (r.turns[i + 1] ?? Infinity));
      const all = r.starts.filter((s) => s >= t && s < (r.turns[i + 1] ?? Infinity));
      for (let j = 1; j < all.length; j++) if (all[j] - all[j - 1] < 0.1 && inside.includes(all[j])) errors.push(`${name}: units stutter at ${all[j].toFixed(2)} s`);
    });
    // silent while the hand rests (after the fade)
    const rest = x.slice(Math.round((r.pause[0] + 0.3) * sr), Math.round(r.pause[1] * sr));
    const restDb = 10 * Math.log10(rest.reduce((s, v) => s + v * v, 0) / rest.length + 1e-15);
    if (restDb > -70) errors.push(`${name}: not silent while the hand rests (${restDb.toFixed(0)} dB)`);
    if (process.env.STARTS) console.log(name, 'turns', r.turns.map((t) => t.toFixed(2)).join(' '), '\n  starts', r.starts.map((t) => t.toFixed(2)).join(' '));
    console.log(`${name.padEnd(12)} ${String(units).padStart(2)} units  ${r.starts.length} played for ${r.turns.length} sweeps  peak ${peak.toFixed(3)}  resting ${restDb.toFixed(0)} dB`);
  }
} catch (e) {
  errors.push(e.stack || String(e));
} finally {
  await browser.close();
  server.close();
}
if (errors.length) { console.log(`FAIL\n${errors.join('\n')}`); process.exit(1); }
console.log('PASS: the sounds keep time with the hand (samples in tests/out/sounds/)');
