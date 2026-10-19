// Browser test of the game screen (build/game, the YouTube page) with the test stand-in for the YouTube SDK
// (tools/fake-ytgame.js, injected here by the test runner in place of https://www.youtube.com/game_api/v1).
// Covers: readiness signals, many colours paging at the side and scrolling at the bottom, painting with the mouse, Done → review, Next, the interstitial on the
// second finished look, the colour of the day (refused, then earned and kept), Redo for a video, a host pause,
// reload restoring everything, a missing SDK and a protected save showing Retry, and the dev page without ads.
// Usage: node tools/build-game.mjs && node tests/game-smoke.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { serve } from '../tools/serve.mjs';
import * as G from '../src/game/game.js';
import { DAILY } from '../src/makeup/palette.js';

const SDK_URL = 'https://www.youtube.com/game_api/v1';
const fixture = fs.readFileSync(new URL('../tools/fake-ytgame.js', import.meta.url), 'utf8');
const executablePath = process.env.CHROME || (process.env.CI ? undefined : '/opt/pw-browsers/chromium-1194/chrome-linux/chrome');
const server = await serve('build', 8160);
const browser = await chromium.launch({ executablePath });
const errors = [];
let n = 0;
const check = (name, fn) => fn().then(() => { n++; console.log('ok -', name); });

async function open({ sdk = 'fake', path = 'game/index.html', save, phone = false, size = [400, 780] } = {}) {
  const ctx = await browser.newContext({ viewport: { width: size[0], height: size[1] }, ...(phone && { hasTouch: true, isMobile: true }) });
  if (sdk === 'fake') await ctx.route(SDK_URL, (r) => r.fulfill({ contentType: 'text/javascript', body: fixture }));
  else await ctx.route(SDK_URL, (r) => r.abort());
  await ctx.addInitScript((save) => {
    window.__fakeAds = { auto: true };
    if (save !== undefined && !sessionStorage.getItem('seeded')) { localStorage.setItem('fake-ytgame-save', save); sessionStorage.setItem('seeded', '1'); }
  }, save);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://localhost:8160/${path}`);
  return { ctx, page };
}
const ready = (page) => page.waitForFunction('window.game || !document.getElementById("error").hidden', null, { timeout: 120000 });
const state = (page) => page.evaluate(() => {
  const s = game.session.state;
  return { id: s.attempt.id, phase: s.attempt.phase, strokes: s.attempt.makeup.strokes.length, completions: s.completions, cadence: s.cadence, owned: s.owned, pick: s.pick, seed: s.face.seed, next: s.next.seed, selection: s.selection, sdk: (window.__adLog || []).filter((x) => x !== 'saveData') };
});
// a mouse stroke across the left cheek with the selected tool
async function stroke(page) {
  const box = await page.locator('#stage canvas').boundingBox();
  const [a, b] = await page.evaluate(() => { const v = game.view, L = v.eyes.meshes[0].position; return [[L[0] + 0.05, L[1] - 0.4, L[2]], [L[0] + 0.2, L[1] - 0.47, L[2]]].map((p) => v.makeup.picker.project(p)); });
  await page.mouse.move(box.x + a[0], box.y + a[1]); await page.mouse.down();
  await page.mouse.move(box.x + b[0], box.y + b[1], { steps: 8 }); await page.mouse.up();
}
// the screen is textless (owner, 19 October 2026): nothing visible but icons, pictures and numbers
const words = (page) => page.evaluate(() => document.body.innerText.replace(/[\d:\s]/g, ''));
// Done, then review (a finished look celebrates for a moment first)
const done = async (page) => { await page.click('#done'); await page.waitForFunction(() => game.session.state.attempt.phase === 'review'); };
const making = (page) => page.evaluate(() => { for (let i = 0; i < 61; i++) game.session.tick(1000); }); // a minute of making
const idle = (page) => page.waitForFunction(() => !game.session.busy);

try {
  await check('the game plays: paint, review, Next, the interstitial on every second look, daily colour, Redo, reload', async () => {
    const { ctx, page } = await open();
    await ready(page);
    let s = await state(page);
    assert.deepEqual(s.sdk.slice(0, 3), ['firstFrameReady', 'loadData', 'gameReady'], 'readiness after the face is on screen');
    assert.equal(s.phase, 'create');
    // the loading screen's compact filled to the end, and the cover clears off the game
    assert.equal(await page.getAttribute('#cover .blush', 'aria-valuenow'), '100');
    await page.waitForFunction(() => document.getElementById('cover').hidden);
    assert.equal(await words(page), '', 'no words on the create screen');
    const nextSeed = s.next;
    // look 1: a stroke (it plays the brush's recording), Done, Next (no ad yet)
    await page.waitForFunction(() => game.sounds.loaded === 11, null, { timeout: 30000 }); // the tools' CC0 recordings
    await stroke(page);
    assert.ok(await page.evaluate(() => game.sounds.strokes) > 0, 'the stroke played its recording');
    await done(page);
    s = await state(page);
    assert.deepEqual([s.phase, s.strokes, s.completions], ['review', 1, 1]);
    assert.equal(await words(page), '', 'no words in review');
    await page.click('#next'); await idle(page);
    s = await state(page);
    assert.equal(s.seed, nextSeed, 'the previewed customer came next');
    assert.ok(!s.sdk.includes('interstitial'));
    // an untouched look: Done, Next, nothing counted
    await done(page); await page.click('#next'); await idle(page);
    assert.equal((await state(page)).completions, 1);
    // the host turns sound off: nothing plays, not even a tool's click; back on, it sounds again
    await page.evaluate(() => ytgame.__audio(false));
    const heard = await page.evaluate(() => game.sounds.played);
    await page.click('#toolbar [data-tool="pencil"]'); await page.click('#toolbar [data-tool="brush"]');
    assert.equal(await page.evaluate(() => game.sounds.played), heard, 'silent while the host has sound off');
    await page.evaluate(() => ytgame.__audio(true));
    await page.click('#toolbar [data-tool="pencil"]'); await page.click('#toolbar [data-tool="brush"]');
    assert.ok(await page.evaluate(() => game.sounds.played) > heard, 'sound is back');
    // look 2 after a minute of making: one interstitial at Next
    await making(page); await stroke(page);
    await done(page); await page.click('#next'); await idle(page);
    s = await state(page);
    assert.equal(s.sdk.filter((x) => x === 'interstitial').length, 1);
    assert.equal(s.cadence.qualified, 0);
    // the colour of the day: refused video, nothing; earned video, kept and selected
    assert.ok(await page.isVisible('#daily .dot'), 'the dot shows while today\'s colour waits');
    await page.click('#daily');
    assert.equal(await words(page), '', 'no words in the colour of the day');
    await page.evaluate(() => { window.__fakeAds.rewarded = false; });
    await page.click('#panel .get'); await idle(page);
    assert.deepEqual((await state(page)).owned, []);
    await page.evaluate(() => { window.__fakeAds.rewarded = true; });
    await page.click('#panel .get'); await idle(page);
    s = await state(page);
    const colour = s.pick.colour, tool = await page.evaluate((id) => document.querySelector('#toolbar [aria-pressed="true"]').dataset.tool, colour);
    assert.deepEqual(s.owned, [colour]);
    assert.equal(s.selection.colour[s.selection.tool], colour);
    assert.equal(await words(page), '', 'no words once the colour is earned');
    await page.click('#panel .get'); // the tick: use it now
    assert.ok(await page.isHidden('#panel'));
    assert.equal(await page.getAttribute('#swatches button:first-child', 'aria-checked'), 'true', 'the new colour leads its row, selected');
    assert.equal(tool, s.selection.tool);
    assert.ok(await page.isHidden('#daily .dot'));
    // Redo for a video: the same face, clean, a new attempt; the rewarded video stands in for the next break
    await stroke(page); await done(page);
    const face = (await state(page)).seed, attempt = (await state(page)).id;
    await page.click('#redo'); await idle(page);
    s = await state(page);
    assert.deepEqual([s.seed, s.id, s.phase, s.strokes], [face, attempt + 1, 'create', 0]);
    assert.ok(s.cadence.rewardCredit);
    // a host pause freezes the screen; resume gives it back
    await page.evaluate(() => ytgame.__pause());
    assert.ok(await page.evaluate(() => document.getElementById('app').inert));
    await page.evaluate(() => ytgame.__resume());
    assert.ok(!(await page.evaluate(() => document.getElementById('app').inert)));
    // reload: everything comes back
    await page.evaluate(() => game.session.flush());
    const saved = await state(page);
    await page.reload(); await ready(page);
    const back = await state(page);
    for (const k of ['id', 'phase', 'seed', 'next', 'completions', 'owned', 'selection']) assert.deepEqual(back[k], saved[k], k);
    await ctx.close();
  });

  await check('every colour of the day earned: the daily button goes away (on earning the last, once its card closes)', async () => {
    const all = Object.values(DAILY).flat().map((c) => c.id), base = G.newGame(21);
    // one colour left to earn
    let { ctx, page } = await open({ save: G.serialise({ ...base, owned: all.slice(0, -1) }) });
    await ready(page);
    assert.ok(await page.isVisible('#daily'), 'a colour is left: the button shows');
    await page.click('#daily');
    await page.click('#panel .get'); // the test SDK completes the video
    await page.waitForFunction((n) => game.session.state.owned.length === n, all.length);
    assert.ok(await page.isVisible('#panel .get.owned'), 'the card shows the tick');
    await page.click('#panel .get'); // "use it now" closes the card
    assert.ok(await page.isHidden('#daily'), 'the last colour earned: no daily button');
    await ctx.close();
    // a save that already has every colour: no daily button from the start
    ({ ctx, page } = await open({ save: G.serialise({ ...base, owned: all }) }));
    await ready(page);
    assert.ok(await page.isHidden('#daily'));
    assert.ok(await page.isVisible('#done'));
    await ctx.close();
  });

  await check('the tool in hand: under a finger at its tip above it, gone when it lifts; under a mouse in place of the cursor, at the pointer', async () => {
    const { ctx, page } = await open({ phone: true });
    await ready(page);
    await page.waitForFunction(() => document.getElementById('cover').hidden);
    const cdp = await ctx.newCDPSession(page);
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y]) => ({ x, y, id: 1, radiusX: 6, radiusY: 6, force: 1 })) });
    const [x, y, tip] = await page.evaluate(() => {
      const v = game.view, c = document.querySelector('#stage canvas').getBoundingClientRect(), L = v.eyes.meshes[0].position, [px, py] = v.makeup.picker.project([L[0] + 0.08, L[1] - 0.42, L[2]]);
      return [c.left + px, c.top + py, Math.min(72, c.height * 0.12)];
    });
    assert.ok(await page.isHidden('#hand'));
    await touch('touchStart', [[x, y + tip]]);
    for (let k = 1; k <= 6; k++) await touch('touchMove', [[x + k * 4, y + tip]]);
    // where the tool's tip is drawn on screen
    const drawnTip = () => page.evaluate(() => {
      const h = document.getElementById('hand'), m = new DOMMatrix(getComputedStyle(h).transform), [tx, ty] = h.dataset.tip.split(',').map(Number);
      return { shown: !h.hidden, x: m.e + tx, y: m.f + ty, cursor: document.querySelector('#stage canvas').style.cursor };
    });
    let at = await drawnTip();
    assert.ok(at.shown, 'the brush shows while the finger is down');
    assert.ok(Math.abs(at.x - (x + 24)) < 1.5 && Math.abs(at.y - y) < 1.5, `its tip is at the working point, above the finger (${at.x}, ${at.y})`);
    await touch('touchEnd', []);
    assert.ok(await page.isHidden('#hand'), 'gone when the finger lifts');
    assert.equal((await state(page)).strokes, 1, 'it painted');
    // a mouse holds the tool in place of the cursor, its tip at the pointer, before and while it paints
    await page.mouse.move(x, y + 30);
    at = await drawnTip();
    assert.ok(at.shown && Math.abs(at.x - x) < 1.5 && Math.abs(at.y - (y + 30)) < 1.5 && at.cursor === 'none', `hovering: the tool's tip at the pointer, no cursor (${JSON.stringify(at)})`);
    await page.mouse.down(); await page.mouse.move(x + 20, y + 30, { steps: 4 });
    at = await drawnTip();
    assert.ok(at.shown && Math.abs(at.x - (x + 20)) < 1.5 && Math.abs(at.y - (y + 30)) < 1.5, 'painting: the tip follows the pointer');
    await page.mouse.up();
    assert.equal((await state(page)).strokes, 2, 'the mouse painted at the pointer');
    await page.mouse.move(2, 2); // off the face: the tool goes, the cursor comes back
    at = await drawnTip();
    assert.ok(!at.shown && at.cursor === '');
    await ctx.close();
  });

  await check('many colours: at the side whole pages turn (arrows, wheel, drag, swipe), none cut off; at the bottom the row scrolls (wheel, drag)', async () => {
    const all = Object.values(DAILY).flat().map((c) => c.id), save = G.serialise({ ...G.newGame(21), owned: all });
    // the tray: which colours show, where, and whether each is whole inside the counter (with the picked one's ring)
    const tray = (page) => page.evaluate(() => {
      const foot = document.getElementById('create').getBoundingClientRect(), sw = document.getElementById('swatches');
      const shown = [...sw.children].map((b, i) => [b, i]).filter(([b]) => !b.hidden);
      const whole = shown.every(([b]) => {
        const r = b.getBoundingClientRect(), ring = b.getAttribute('aria-checked') === 'true' ? 8 * r.width / 47 : 0;
        return r.left - ring >= foot.left && r.right + ring <= foot.right && r.top - ring >= foot.top && r.bottom + ring <= foot.bottom && r.bottom <= innerHeight && r.right <= innerWidth;
      });
      return { first: shown[0][1], count: shown.length, total: sw.children.length, whole, scroll: sw.scrollLeft, fe: sw.style.getPropertyValue('--fe'), more: document.getElementById('more').disabled, prev: document.getElementById('prev').disabled, pick: game.session.state.selection.colour.lip };
    });
    // a full-screen computer: the column at the side
    let { ctx, page } = await open({ save, size: [1920, 1080] });
    await ready(page);
    await page.click('#toolbar [data-tool="lip"]');
    let t = await tray(page);
    assert.ok(t.whole, 'every colour on the page is whole');
    assert.ok(!(await page.isHidden('#more')), 'arrows when there are more pages');
    const per = t.first % t.count === 0 && t.count % 3 === 0 && t.first + t.count < t.total ? t.count : null;
    while (!(await page.isDisabled('#prev'))) await page.click('#prev');
    t = await tray(page);
    assert.equal(t.first, 0); assert.ok(t.prev, 'the first page');
    const size = t.count;
    assert.ok(size % 3 === 0 && size >= 18, `whole rows of three on a page (${size})`);
    if (per) assert.equal(size, per);
    await page.click('#more');
    t = await tray(page);
    assert.equal(t.first, size, 'the arrow turns one page'); assert.ok(t.whole);
    const box = await page.locator('#swatches').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(50);
    await page.mouse.wheel(0, 120); // the same flick: still one page
    t = await tray(page);
    assert.equal(t.first, 2 * size, 'a wheel flick turns one page');
    await page.waitForTimeout(400);
    // a drag down turns back a page, and picks no colour
    const pick = t.pick;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 120, { steps: 6 }); await page.mouse.up();
    t = await tray(page);
    assert.equal(t.first, size, 'a drag turns a page'); assert.equal(t.pick, pick, 'a drag picks no colour');
    while (!(await page.isDisabled('#more'))) await page.click('#more');
    t = await tray(page);
    assert.ok(t.more && t.whole && t.first + t.count === t.total, 'the last page');
    await ctx.close();
    // a phone on its side: a finger swipes the pages
    ({ ctx, page } = await open({ save, size: [844, 390], phone: true }));
    await ready(page);
    await page.tap('#toolbar [data-tool="lip"]');
    while (!(await page.isDisabled('#prev'))) await page.tap('#prev');
    t = await tray(page);
    assert.ok(t.whole, 'whole colours on a phone on its side');
    const before = t.first, b2 = await page.locator('#swatches').boundingBox(), cdp = await ctx.newCDPSession(page);
    const at = (y) => [{ x: b2.x + b2.width / 2, y }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(b2.y + b2.height * 0.7) });
    for (let k = 1; k <= 6; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(b2.y + b2.height * (0.7 - 0.08 * k)) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    t = await tray(page);
    assert.notEqual(t.first, before, 'a swipe up turns the page');
    await ctx.close();
    // a desktop window in portrait: the row at the bottom scrolls with the wheel and a drag
    ({ ctx, page } = await open({ save, size: [600, 1000] }));
    await ready(page);
    await page.click('#toolbar [data-tool="lip"]');
    await page.evaluate(() => { document.getElementById('swatches').scrollLeft = 0; });
    await page.waitForTimeout(50);
    t = await tray(page);
    assert.ok(!(await page.isVisible('#more')), 'no arrows at the bottom');
    assert.equal(t.count, t.total, 'every colour in the row');
    assert.equal(t.fe, '18px', 'the row fades where more colours wait');
    const b3 = await page.locator('#swatches').boundingBox();
    await page.mouse.move(b3.x + b3.width / 2, b3.y + b3.height / 2);
    await page.mouse.wheel(0, 200);
    await page.waitForFunction(() => document.getElementById('swatches').scrollLeft > 100, null, { timeout: 3000 }).catch(() => {});
    const { scroll: wheeled, pick: picked } = await tray(page);
    assert.ok(wheeled > 100, `the wheel scrolls the row (${wheeled})`);
    await page.mouse.move(b3.x + b3.width * 0.8, b3.y + b3.height / 2); await page.mouse.down();
    await page.mouse.move(b3.x + b3.width * 0.3, b3.y + b3.height / 2, { steps: 8 }); await page.mouse.up();
    t = await tray(page);
    assert.ok(t.scroll > wheeled + 150, `a drag scrolls the row (${wheeled} → ${t.scroll})`);
    assert.equal(t.pick, picked, 'a drag picks no colour');
    await ctx.close();
  });

  await check('a missing SDK and a save from elsewhere stop at Retry, leaving the save untouched', async () => {
    let { ctx, page } = await open({ sdk: 'none' });
    await ready(page);
    assert.ok(await page.isVisible('#retry'));
    assert.equal(await page.textContent('#error-code'), 'SDK_MISSING');
    await ctx.close();
    const foreign = JSON.stringify({ version: 1, slots: { 'skin-fade-studio-meta-v1': { v: 1 } } });
    ({ ctx, page } = await open({ save: foreign }));
    await ready(page);
    assert.equal(await page.textContent('#error-code'), 'SAVE-OTHER-GAME');
    assert.equal(await page.evaluate(() => localStorage.getItem('fake-ytgame-save')), foreign);
    await ctx.close();
  });

  await check('the dev page has no ads: no daily colour, no Redo, local saves', async () => {
    const { ctx, page } = await open({ sdk: 'none', path: 'game-dev/index.html' });
    await ready(page);
    assert.ok(await page.isHidden('#daily'));
    await done(page);
    assert.ok(await page.isHidden('#redo'));
    assert.ok(await page.isVisible('#next'));
    await page.evaluate(() => game.session.flush());
    assert.ok(JSON.parse(await page.evaluate(() => localStorage.getItem('worksbien-makeup-dev-v1'))).state);
    await ctx.close();
  });
} catch (e) {
  errors.push(e.stack || String(e));
} finally {
  await browser.close();
  server.close();
}
if (errors.length) { console.log('FAIL\n' + errors.join('\n')); process.exit(1); }
console.log(`PASS: ${n} game checks in the browser`);
