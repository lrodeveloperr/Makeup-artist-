// Browser smoke test: renders queue faces in Chromium (WebGL2) and fails on shader/page errors or a
// blank canvas. With --gallery it also writes docs/face-gallery.jpg (24 faces from the queue).
// Usage: node tools/build-preview.mjs && node tests/render-smoke.mjs [--gallery]
import { chromium } from 'playwright';
import { serve } from '../tools/serve.mjs';

const gallery = process.argv.includes('--gallery');
const server = await serve('build/preview', 8132);
const executablePath = process.env.CHROME || (process.env.CI ? undefined : '/opt/pw-browsers/chromium-1194/chrome-linux/chrome');
const browser = await chromium.launch({ executablePath });
const errors = [];
try {
  const n = gallery ? 24 : 8, cols = gallery ? 6 : 4, w = 240, h = 320;
  const page = await browser.newPage({ viewport: { width: cols * w, height: Math.ceil(n / cols) * h } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' || /Shader Error|THREE\.WebGLProgram/.test(m.text())) errors.push(m.text()); });
  await page.goto(`http://localhost:8132/index.html?sheet&queue&seed=3&n=${n}&cols=${cols}&w=${w}&h=${h}`);
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
