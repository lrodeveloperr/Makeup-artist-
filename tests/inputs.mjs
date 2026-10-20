// Every tool by every input: a finger (touch events), a mouse and a pen (mouse events of that pointer type), in the
// YouTube page with the SDK stand-in, on three faces. For each of the eight tools (brush, highlighter, pencil, liner,
// mascara, lipstick, gems, lenses): the tool's tip is drawn exactly at the working point (under a finger 48 px above
// it, a lens 85 % of that, and across by the tool's lean; under a mouse or pen at the pointer), the stroke (or the gem,
// or the lens) is stored, and the picture changes where the tool worked.
// Usage: node tools/build-game.mjs && node tests/inputs.mjs
import fs from 'node:fs';
import { chromium } from 'playwright';
import { serve } from '../tools/serve.mjs';
import * as G from '../src/game/game.js';

const fixture = fs.readFileSync(new URL('../tools/fake-ytgame.js', import.meta.url), 'utf8');
const executablePath = process.env.CHROME || (process.env.CI ? undefined : '/opt/pw-browsers/chromium-1194/chrome-linux/chrome');
const server = await serve('build', 8163);
const browser = await chromium.launch({ executablePath });
let bad = 0;
for (const input of ('finger,mouse,pen').split(',')) for (const seed of [3, 8, 17]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, ...(input === 'finger' && { hasTouch: true, isMobile: true }) });
  await ctx.route('https://www.youtube.com/game_api/v1', (r) => r.fulfill({ contentType: 'text/javascript', body: fixture }));
  await ctx.addInitScript((save) => { localStorage.setItem('fake-ytgame-save', save); }, G.serialise(G.newGame(seed)));
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:8163/game/index.html');
  await page.waitForFunction('window.game', null, { timeout: 120000 });
  await page.waitForFunction(() => document.getElementById('cover').hidden);
  const cdp = await ctx.newCDPSession(page);
  await page.evaluate((f) => { window.__finger = f; }, input === 'finger');
  // one pointer: down, move, up, at page pixels (a finger by touch events; a mouse or a pen by mouse events of that kind)
  const touch = async (type, pts) => {
    if (input === 'finger') return cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y]) => ({ x, y, id: 1, radiusX: 6, radiusY: 6, force: 1 })) });
    const kind = { touchStart: 'mousePressed', touchMove: 'mouseMoved', touchEnd: 'mouseReleased' }[type], [x, y] = pts[0] || touch.at;
    if (type === 'touchStart') await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, pointerType: input });
    touch.at = [x, y];
    return cdp.send('Input.dispatchMouseEvent', { type: kind, x, y, button: 'left', buttons: type === 'touchEnd' ? 0 : 1, clickCount: 1, pointerType: input, ...(input === 'pen' && { force: 0.5 }) });
  };
  // targets in face space, from the left eye's centre; dx: the stroke's sweep across (face-space dm)
  const T = { brush: [0.12, -0.36, 0.1, 0.06], glow: [0.15, -0.21, 0.1, 0.05], pencil: [0, 0.205, 0.15, 0.06], liner: [0, 0.05, 0.15, 0.06], mascara: [0, 0.045, 0.2, 0.06], lip: [-0.288, -0.615, 0.3, 0.05], gem: [0.12, -0.36, 0.1, 0], lens: [0, 0, 0.3, 0] };
  for (const [tool, [dx, dy, dz, sweep]] of Object.entries(T)) {
    await page.evaluate((t) => game.session.select(t), tool);
    const r0 = await page.evaluate(([dx, dy, dz, sweep, tool]) => {
      const v = game.view, P = v.makeup.picker, c = document.querySelector('#stage canvas').getBoundingClientRect(), L = v.eyes.meshes[0].position;
      const a = P.project([L[0] + dx - sweep / 2, L[1] + dy, L[2] + dz]), b = P.project([L[0] + dx + sweep / 2, L[1] + dy, L[2] + dz]);
      const up = window.__finger ? Math.min(48, c.height * 0.16) * (tool === 'lens' ? 0.85 : 1) : 0, across = up * game.lean();
      const gl = v.renderer.gl, n = 10, pr = v.renderer.pixelRatio, BH = gl.drawingBufferHeight, px = new Uint8Array((2 * n + 1) ** 2 * 4);
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      v.render(); gl.readPixels(Math.round(mid[0] * pr) - n, BH - Math.round(mid[1] * pr) - n, 2 * n + 1, 2 * n + 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      window.__before = px;
      const m = v.makeup.makeup;
      return { a: [c.left + a[0], c.top + a[1]], b: [c.left + b[0], c.top + b[1]], up, across, strokes: m.strokes.length, lenses: JSON.stringify(m.lenses), mid };
    }, [dx, dy, dz, sweep, tool]);
    const finger = (p) => [p[0] + r0.across, p[1] + r0.up];
    await touch('touchStart', [finger(r0.a)]);
    // where the tool's tip is drawn
    const drawn = await page.evaluate(() => { const h = document.getElementById('hand'), m = new DOMMatrix(getComputedStyle(h).transform), [tx, ty] = h.dataset.tip.split(',').map(Number); return [m.e + tx, m.f + ty, !h.hidden]; });
    const tipOk = drawn[2] && Math.hypot(drawn[0] - r0.a[0], drawn[1] - r0.a[1]) < 1.5;
    if (sweep) for (let k = 1; k <= 8; k++) await touch('touchMove', [finger([r0.a[0] + (r0.b[0] - r0.a[0]) * k / 8, r0.a[1] + (r0.b[1] - r0.a[1]) * k / 8])]);
    await touch('touchEnd', []);
    const r1 = await page.evaluate((mid) => {
      const v = game.view, gl = v.renderer.gl, n = 10, pr = v.renderer.pixelRatio, BH = gl.drawingBufferHeight, px = new Uint8Array((2 * n + 1) ** 2 * 4);
      v.render(); gl.readPixels(Math.round(mid[0] * pr) - n, BH - Math.round(mid[1] * pr) - n, 2 * n + 1, 2 * n + 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      let d = 0; for (let i = 0; i < px.length; i++) d = Math.max(d, Math.abs(px[i] - window.__before[i]));
      const m = v.makeup.makeup;
      return { strokes: m.strokes.length, lenses: JSON.stringify(m.lenses), d, last: m.strokes.at(-1)?.tool };
    }, r0.mid);
    const stored = tool === 'lens' ? r1.lenses !== r0.lenses : r1.strokes === r0.strokes + 1 && r1.last === tool;
    const ok = tipOk && stored && r1.d >= 6;
    if (!ok) bad++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${input.padEnd(6)} face ${seed} ${tool.padEnd(7)} tip drawn at the working point: ${tipOk} (${(drawn[0] - r0.a[0]).toFixed(1)}, ${(drawn[1] - r0.a[1]).toFixed(1)} px); ${input === 'finger' ? `finger ${r0.up.toFixed(0)} px below, ${r0.across.toFixed(0)} px across` : 'at the pointer'}; ${tool === 'lens' ? 'lens set' : 'stroke stored'}: ${stored}; picture changed by ${r1.d} where it worked`);
  }
  if (errors.length) { bad++; console.log('page errors', errors); }
  await ctx.close();
}
await browser.close(); server.close();
if (bad) { console.log(`FAIL: ${bad}`); process.exit(1); }
console.log('PASS: every tool works by finger, mouse and pen, its tip drawn where it works, on 3 faces');
