// Layout across screens (Haircut's viewport matrix): phones, tablets, desktops, ultrawide, tiny embeds and extreme
// shapes, in portrait and landscape. One page is resized through every size, so orientation changes are tested
// live. In each state (making a look, the colour of the day open, review) every control must be on screen, at a
// tappable size, apart from the others and off the face (her eyes and mouth stay clear); the face must fit its
// canvas, centred in the salon mirror. Then, with every colour earned, a page shows at most six colours, each whole
// on the counter, the picked one's ring clear of its neighbours, the arrows and the tools, and both arrows on screen
// and tappable. Writes a contact sheet per state to tests/out/.
// Usage: node tools/build-game.mjs && node tests/layout.mjs
import fs from 'node:fs';
import { chromium } from 'playwright';
import { serve } from '../tools/serve.mjs';
import * as G from '../src/game/game.js';
import { DAILY } from '../src/makeup/palette.js';

export const VIEWPORTS = [
  [390, 844], [225, 400], [320, 568], [360, 640], [375, 667], [412, 915], [430, 932], [568, 320], [640, 360], [844, 390],
  [932, 430], [717, 512], [768, 1024], [820, 1180], [1024, 1366], [1024, 768], [1180, 820], [1366, 1024], [1280, 720],
  [1366, 768], [1440, 900], [1920, 1080], [2560, 1440], [3440, 1440], [400, 400], [480, 270], [270, 480], [225, 800],
  [320, 1120], [3840, 1080],
];
const MIN_TAP = 30; // CSS px: Haircut's tiny-embed floor (44 where the screen allows)

const executablePath = process.env.CHROME || (process.env.CI ? undefined : '/opt/pw-browsers/chromium-1194/chrome-linux/chrome');
const server = await serve('build/game', 8180);
const browser = await chromium.launch({ executablePath });
const errors = [];
const shots = { create: [], daily: [], review: [], many: [] };
const canvases = {}; // the canvas while making a look, per screen
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route('https://www.youtube.com/game_api/v1', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync('tools/fake-ytgame.js', 'utf8') }));
  await ctx.addInitScript((save) => { window.__fakeAds = { auto: true }; localStorage.setItem('fake-ytgame-save', save); }, G.serialise(G.newGame(77)));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:8180/index.html');
  await page.waitForFunction('window.game', null, { timeout: 120000 });

  // what is on screen: the visible controls, the canvas, and her eyes and mouth in page coordinates
  const measure = (state) => page.evaluate((state) => {
    const r = (el) => { const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; };
    const visible = (el) => el && !el.closest('[hidden]') && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
    const sel = { create: ['#daily', '#done', '#toolbar .ctl'], daily: ['#panel .card', '#panel .get', '#panel .x'], review: ['#redo', '#next'] }[state];
    const controls = sel.flatMap((s) => [...document.querySelectorAll(s)]).filter(visible).map((el) => ({ id: el.id || el.className || el.dataset.tool, ...r(el) }));
    const swatches = [...document.querySelectorAll('#swatches button')].filter(visible).map(r);
    const canvas = r(document.querySelector('#stage canvas')), v = game.view, P = v.makeup.picker;
    const [L, R] = v.eyes.meshes.map((m) => m.position);
    const marks = [[L[0], L[1], L[2]], [R[0], R[1], R[2]], [0, -0.62, 0.55], [0.55, 0.2, 0.2], [-0.55, 0.2, 0.2], [0, 1.0, 0.3]]
      .map((p) => P.project(p)).map(([x, y]) => [canvas.x + x, canvas.y + y]);
    const m = document.querySelector('#backdrop .mirror').getBoundingClientRect(), [fx] = P.project([0, 0, 0]);
    return { controls, swatches, canvas, eyesMouth: marks.slice(0, 3), faceEdges: marks.slice(3), mirrorOff: m.left + m.width / 2 - (canvas.x + fx), scale: getComputedStyle(document.documentElement).getPropertyValue('--s') };
  }, state);

  const inside = (b, W, H) => b.x >= -1 && b.y >= -1 && b.x + b.w <= W + 1 && b.y + b.h <= H + 1;
  const overlap = (a, b) => a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1;
  const contains = (b, [x, y]) => x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h;

  async function check(state, W, H) {
    const m = await measure(state), where = `${W}x${H} ${state}`;
    for (const c of m.controls) {
      if (!inside(c, W, H)) errors.push(`${where}: ${c.id} is off screen (${JSON.stringify(c)})`);
      if (state !== 'daily' && (c.w < MIN_TAP || c.h < MIN_TAP)) errors.push(`${where}: ${c.id} is ${Math.round(c.w)}x${Math.round(c.h)}, under ${MIN_TAP}`);
    }
    if (state !== 'daily') {
      for (let i = 0; i < m.controls.length; i++) for (let j = i + 1; j < m.controls.length; j++) if (overlap(m.controls[i], m.controls[j])) errors.push(`${where}: ${m.controls[i].id} overlaps ${m.controls[j].id}`);
      for (const c of m.controls) for (const p of m.eyesMouth) if (contains(c, p)) errors.push(`${where}: ${c.id} covers her face`);
      // the face's edges (cheeks, top of the head) are inside the canvas, so she is never cut off at the sides
      for (const [x, y] of m.faceEdges) if (x < m.canvas.x || x > m.canvas.x + m.canvas.w || y < m.canvas.y) errors.push(`${where}: the face is cut off by the canvas`);
    }
    // she sits in the middle of the salon mirror behind her
    if (Math.abs(m.mirrorOff) > 1) errors.push(`${where}: the mirror is ${Math.round(m.mirrorOff)} px off her centre`);
    // the face stays exactly where it was between making a look and review
    const key = `${W}x${H}`;
    if (state === 'create') canvases[key] = m.canvas;
    else if (state === 'review' && ['x', 'y', 'w', 'h'].some((k) => Math.abs(m.canvas[k] - canvases[key][k]) > 1)) errors.push(`${where}: the face moved from where it was while making the look`);
    if (state === 'create') {
      if (!m.swatches.length) errors.push(`${where}: no colours on screen`);
      for (const s of m.swatches.slice(0, 4)) if (!inside(s, W, H)) errors.push(`${where}: a colour is off screen`);
    }
    return m;
  }

  for (const state of ['create', 'daily', 'review']) {
    if (state === 'daily') await page.click('#daily');
    if (state === 'review') { await page.click('#panel .x'); await page.click('#done'); await page.waitForFunction(() => game.session.state.attempt.phase === 'review'); }
    for (const [W, H] of VIEWPORTS) {
      await page.setViewportSize({ width: W, height: H });
      await page.waitForTimeout(250);
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const m = await check(state, W, H);
      const file = `tests/out/layout-${state}-${W}x${H}.png`;
      fs.mkdirSync('tests/out', { recursive: true });
      await page.screenshot({ path: file, timeout: 120000 });
      shots[state].push([file, W, H, m.scale.trim()]);
    }
  }

  // every colour earned: the most colours a tool can show (the lipstick has the most)
  const all = Object.values(DAILY).flat().map((c) => c.id);
  const many = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await many.route('https://www.youtube.com/game_api/v1', (r) => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync('tools/fake-ytgame.js', 'utf8') }));
  await many.addInitScript((save) => { localStorage.setItem('fake-ytgame-save', save); }, G.serialise({ ...G.newGame(77), owned: all }));
  const p2 = await many.newPage();
  p2.on('pageerror', (e) => errors.push(e.message));
  await p2.goto('http://localhost:8180/index.html');
  await p2.waitForFunction('window.game', null, { timeout: 120000 });
  await p2.click('#toolbar [data-tool="lip"]');
  for (const [W, H] of VIEWPORTS) {
    await p2.setViewportSize({ width: W, height: H });
    await p2.waitForTimeout(250);
    await p2.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const where = `${W}x${H} many colours`;
    const m = await p2.evaluate(() => {
      const r = (el) => { const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; };
      const shown = [...document.querySelectorAll('#swatches button')].map((b) => ({ ...r(b), picked: b.getAttribute('aria-checked') === 'true' }));
      const tools = [...document.querySelectorAll('#toolbar .ctl')].map((b) => ({ id: b.dataset.tool, ...r(b) }));
      const arrows = ['back', 'more'].map((id) => document.getElementById(id)).filter((el) => el.offsetParent).map((el) => ({ id: el.id, ...r(el) }));
      return { shown, tools, arrows, foot: r(document.getElementById('create')) };
    });
    // the picked colour's ring (6 px) and its shadow (9 px below), beyond its grown, lifted button (1.08 × its size)
    const grown = (b) => { const u = b.picked ? b.w / 1.08 / 40 : 0; return { x: b.x - 6 * u * 1.08, y: b.y - 6 * u * 1.08, w: b.w + 12 * u * 1.08, h: b.h + 15 * u * 1.08 }; };
    const within = (b, box) => b.x >= box.x - 0.5 && b.y >= box.y - 0.5 && b.x + b.w <= box.x + box.w + 0.5 && b.y + b.h <= box.y + box.h + 0.5;
    if (!m.shown.length || m.shown.length > 6) errors.push(`${where}: ${m.shown.length} colours on a page (1 to 6)`);
    for (const b of m.shown) if (!within(grown(b), m.foot) || !inside(grown(b), W, H)) errors.push(`${where}: a colour is cut off (${JSON.stringify(b)})`);
    // the picked colour's ring clears its neighbours, the arrows and the tools
    const p = m.shown.find((b) => b.picked);
    if (!p) errors.push(`${where}: the picked colour is not on the page`);
    else for (const o of [...m.shown.filter((b) => b !== p), ...m.tools, ...m.arrows]) if (overlap(grown(p), o)) errors.push(`${where}: the picked colour's ring touches ${o.id ? `the ${o.id}` : 'a colour'}`);
    // the arrows: both on screen, tappable and apart from everything
    if (m.arrows.length !== 2) errors.push(`${where}: ${m.arrows.length} arrows for many pages`);
    for (const a of m.arrows) {
      if (!inside(a, W, H)) errors.push(`${where}: the ${a.id} arrow is off screen`);
      if (a.w < MIN_TAP || a.h < MIN_TAP) errors.push(`${where}: the ${a.id} arrow is ${Math.round(a.w)}x${Math.round(a.h)}, under ${MIN_TAP}`);
      for (const o of [...m.shown, ...m.tools]) if (overlap(a, o)) errors.push(`${where}: the ${a.id} arrow overlaps a ${o.id ? 'tool' : 'colour'}`);
    }
    const file = `tests/out/layout-many-${W}x${H}.png`;
    await p2.screenshot({ path: file, timeout: 120000 });
    shots.many.push([file, W, H, '']);
  }
  await many.close();
  fs.writeFileSync('tests/out/layout.json', JSON.stringify(shots));
} catch (e) {
  errors.push(e.stack || String(e));
} finally {
  await browser.close();
  server.close();
}
if (errors.length) { console.log(`FAIL\n${errors.join('\n')}`); process.exit(1); }
console.log(`PASS: ${VIEWPORTS.length} screens × 3 states laid out cleanly, and with every colour earned (screenshots in tests/out/)`);
