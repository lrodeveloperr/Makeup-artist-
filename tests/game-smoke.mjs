// Browser test of the game screen (build/game, the YouTube page) with the test stand-in for the YouTube SDK
// (tools/fake-ytgame.js, injected here by the test runner in place of https://www.youtube.com/game_api/v1).
// Covers: readiness signals, painting with the mouse, Done → review, Next, the interstitial on the
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

async function open({ sdk = 'fake', path = 'game/index.html', save, phone = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 400, height: 780 }, ...(phone && { hasTouch: true, isMobile: true }) });
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

  await check('on a phone the tool is held in hand: drawn at its working tip above the finger, gone when it lifts', async () => {
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
    const at = await page.evaluate(() => { const h = document.getElementById('hand'); return { shown: !h.hidden, m: new DOMMatrix(getComputedStyle(h).transform) }; });
    assert.ok(at.shown, 'the brush shows while the finger is down');
    assert.ok(Math.abs(at.m.e + 8 - (x + 24)) < 2 && Math.abs(at.m.f + 8 - y) < 2, `its tip is at the working point (${at.m.e + 8}, ${at.m.f + 8})`);
    await touch('touchEnd', []);
    assert.ok(await page.isHidden('#hand'), 'gone when the finger lifts');
    assert.equal((await state(page)).strokes, 1, 'it painted');
    // a mouse works right at the pointer, with no tool drawn
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 20, y, { steps: 4 });
    assert.ok(await page.isHidden('#hand'));
    await page.mouse.up();
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
