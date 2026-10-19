// Browser smoke test: renders faces in Chromium (WebGL2) and fails on shader/page errors or a blank canvas.
// With --gallery it renders one face of every heritage (each profile and each named blend, plus a second East
// Asian face to fill the grid) and writes docs/face-gallery.jpg, labelled with the heritage.
// Usage: node tools/build-preview.mjs && node tests/render-smoke.mjs [--gallery]
import { chromium } from 'playwright';
import { serve } from '../tools/serve.mjs';
import { generateFace } from '../src/face/generator.js';
import { PROFILES, BLENDS } from '../src/face/profiles.js';

// first seeds that give each single profile and each named blend
function heritageSeeds() {
  const want = [...Object.keys(PROFILES).map((id) => `single:${id}`), ...Object.keys(BLENDS).map((id) => `blend:${id}`), 'single:east-asian'];
  const seeds = [];
  for (let seed = 1, found = 0; found < want.length && seed < 100000; seed++) {
    const f = generateFace(seed);
    const key = f.origin.kind === 'blend' ? `blend:${f.origin.blend}` : `single:${f.origin.parts[0].id}`;
    const k = want.findIndex((w, i) => w === key && seeds[i] === undefined);
    if (k >= 0) { seeds[k] = seed; found++; }
  }
  if (seeds.length !== want.length || seeds.includes(undefined)) throw new Error('no seed for some heritages');
  return seeds;
}

const gallery = process.argv.includes('--gallery');
const server = await serve('build/preview', 8132);
const executablePath = process.env.CHROME || (process.env.CI ? undefined : '/opt/pw-browsers/chromium-1194/chrome-linux/chrome');
const browser = await chromium.launch({ executablePath });
const errors = [];
try {
  const seeds = gallery ? heritageSeeds() : null;
  const n = gallery ? seeds.length : 8, cols = gallery ? 6 : 4, w = 240, h = 320;
  const page = await browser.newPage({ viewport: { width: cols * w, height: Math.ceil(n / cols) * h } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' || /Shader Error|THREE\.WebGLProgram/.test(m.text())) errors.push(m.text()); });
  // time to the first rendered face in the normal (non-sheet) view, for the record
  const first = await browser.newPage({ viewport: { width: 400, height: 700 } });
  const t0 = Date.now();
  await first.goto('http://localhost:8132/index.html?seed=1');
  await first.waitForFunction('window.done === true', null, { timeout: 120000 });
  console.log(`first face on screen ${Date.now() - t0} ms after navigation (local server, ${process.env.CI ? 'CI' : 'software'} WebGL)`);
  await first.close();
  await page.goto(gallery
    ? `http://localhost:8132/index.html?sheet&seeds=${seeds.join(',')}&label=heritage&cols=${cols}&w=${w}&h=${h}`
    : `http://localhost:8132/index.html?sheet&queue&seed=3&n=${n}&cols=${cols}&w=${w}&h=${h}`);
  await page.waitForFunction('window.done === true', null, { timeout: 120000 });
  // every tile must contain more than the background colour
  const blank = await page.evaluate(() => [...document.images].filter((img) => {
    const c = document.createElement('canvas'); c.width = 48; c.height = 64;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0, 48, 64);
    const d = g.getImageData(0, 0, 48, 64).data;
    let min = 255, max = 0;
    for (let i = 0; i < d.length; i += 4) { min = Math.min(min, d[i + 1]); max = Math.max(max, d[i + 1]); }
    return max - min < 40;
  }).length);
  if (blank) errors.push(`${blank} blank tiles`);
  if (gallery) await page.screenshot({ path: 'docs/face-gallery.jpg', type: 'jpeg', quality: 82 });
  console.log(`${errors.length ? 'FAIL' : 'PASS'}: rendered ${n} faces`);
} finally {
  await browser.close();
  server.close();
}
if (errors.length) { console.log(errors.join('\n')); process.exit(1); }
