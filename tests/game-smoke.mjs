// Browser test of the game screen (build/game, the YouTube page) with the test stand-in for the YouTube SDK
// (tools/fake-ytgame.js, injected here by the test runner in place of https://www.youtube.com/game_api/v1).
// Covers: readiness signals, painting with the mouse, Done → review → before/after, Next, the interstitial on the
// second finished look, the colour of the day (refused, then earned and kept), Redo for a video, a host pause,
// reload restoring everything, a missing SDK and a protected save showing Retry, and the dev page without ads.
// Usage: node tools/build-game.mjs && node tests/game-smoke.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { serve } from '../tools/serve.mjs';

const SDK_URL = 'https://www.youtube.com/game_api/v1';
const fixture = fs.readFileSync(new URL('../tools/fake-ytgame.js', import.meta.url), 'utf8');
const executablePath = process.env.CHROME || (process.env.CI ? undefined : '/opt/pw-browsers/chromium-1194/chrome-linux/chrome');
const server = await serve('build', 8160);
const browser = await chromium.launch({ executablePath });
const errors = [];
let n = 0;
const check = (name, fn) => fn().then(() => { n++; console.log('ok -', name); });

async function open({ sdk = 'fake', path = 'game/index.html', save } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 400, height: 780 } });
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
const making = (page) => page.evaluate(() => { for (let i = 0; i < 61; i++) game.session.tick(1000); }); // a minute of making
const idle = (page) => page.waitForFunction(() => !game.session.busy);

try {
  await check('the game plays: paint, review, Next, the interstitial on every second look, daily colour, Redo, reload', async () => {
    const { ctx, page } = await open();
    await ready(page);
    let s = await state(page);
    assert.deepEqual(s.sdk.slice(0, 3), ['firstFrameReady', 'loadData', 'gameReady'], 'readiness after the face is on screen');
    assert.equal(s.phase, 'create');
    assert.equal(await words(page), '', 'no words on the create screen');
    const nextSeed = s.next;
    // look 1: a stroke, Done, hold Before, Next (no ad yet)
    await stroke(page);
    await page.click('#done');
    s = await state(page);
    assert.deepEqual([s.phase, s.strokes, s.completions], ['review', 1, 1]);
    assert.equal(await words(page), '', 'no words in review');
    const bb = await page.locator('#before').boundingBox();
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.mouse.down();
    assert.equal(await page.evaluate(() => game.view.skin.uniforms.uPaintOn.value), 0, 'held: the clean face');
    await page.mouse.up();
    assert.equal(await page.evaluate(() => game.view.skin.uniforms.uPaintOn.value), 1, 'released: the finished look');
    await page.click('#next'); await idle(page);
    s = await state(page);
    assert.equal(s.seed, nextSeed, 'the previewed customer came next');
    assert.ok(!s.sdk.includes('interstitial'));
    // an untouched look: Done, Next, nothing counted
    await page.click('#done'); await page.click('#next'); await idle(page);
    assert.equal((await state(page)).completions, 1);
    // look 2 after a minute of making: one interstitial at Next
    await making(page); await stroke(page);
    await page.click('#done'); await page.click('#next'); await idle(page);
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
    await stroke(page); await page.click('#done');
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
    await page.click('#done');
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
