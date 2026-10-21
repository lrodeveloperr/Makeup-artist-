// Browser test of the GamePush build (build/gamepush-test: the GamePush page with tools/fake-gamepush.js in place of
// the SDK). The game and its rules are the YouTube build's (tests/game-smoke.mjs covers them in depth); this checks the
// GamePush host: readiness (gameStart, gameplayStart), saves through the player's 'save' field, the interstitial at Next
// on every second finished look, both rewarded videos (refused and earned), the SDK's pause and mute, gameplayStop
// while paused, and reload restoring the look.
// Usage: node tools/build-gamepush.mjs --test-only && node tests/gamepush-smoke.mjs
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { serve } from '../tools/serve.mjs';

const executablePath = process.env.CHROME || (process.env.CI ? undefined : '/opt/pw-browsers/chromium-1194/chrome-linux/chrome');
const server = await serve('build', 8171);
const browser = await chromium.launch({ executablePath });
const errors = [];
let n = 0;
const check = (name, fn) => fn().then(() => { n++; console.log('ok -', name); });

const ctx = await browser.newContext({ viewport: { width: 400, height: 780 } });
await ctx.addInitScript(() => { window.__fakeAds = {}; });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(e.message));
const ready = () => page.waitForFunction('window.game || !document.getElementById("error").hidden', null, { timeout: 120000 });
const log = () => page.evaluate(() => window.__gpLog.filter((x) => !/^(get|set):/.test(x)));
const state = () => page.evaluate(() => { const s = game.session.state; return { id: s.attempt.id, phase: s.attempt.phase, strokes: s.attempt.makeup.strokes.length, completions: s.completions, owned: s.owned, seed: s.face.seed }; });
async function stroke() {
  const box = await page.locator('#stage canvas').boundingBox();
  const [a, b] = await page.evaluate(() => { const v = game.view, L = v.eyes.meshes[0].position; return [[L[0] + 0.05, L[1] - 0.4, L[2]], [L[0] + 0.2, L[1] - 0.47, L[2]]].map((p) => v.makeup.picker.project(p)); });
  await page.mouse.move(box.x + a[0], box.y + a[1]); await page.mouse.down();
  await page.mouse.move(box.x + b[0], box.y + b[1], { steps: 8 }); await page.mouse.up();
}
const done = async () => { await page.click('#done'); await page.waitForFunction(() => game.session.state.attempt.phase === 'review'); };
const idle = () => page.waitForFunction(() => !game.session.busy);
const making = () => page.evaluate(() => { for (let i = 0; i < 61; i++) game.session.tick(1000); });

try {
  await page.goto('http://localhost:8171/gamepush-test/index.html');
  await ready(page);
  assert.ok(await page.evaluate(() => document.getElementById('error').hidden), 'no error screen');

  await check('starts on the GamePush host: saved at once, gameStart then gameplayStart once the face is up', async () => {
    assert.equal(await page.evaluate(() => game.host.environment), 'gamepush');
    const l = await log();
    assert.ok(l.indexOf('gameStart') >= 0 && l.indexOf('gameplayStart') > l.indexOf('gameStart'), l.join(','));
    await page.waitForFunction(() => window.__gpLog.includes('sync'));
    assert.ok(await page.evaluate(() => (localStorage.getItem('fake-gamepush-save') || '').includes('"game"')), 'the first state is in the save field');
  });

  await check('the interstitial plays at Next after the second finished look, with gameplay stopped around it', async () => {
    await stroke(); await done(); await page.click('#next'); await idle();
    assert.ok(!(await log()).includes('fullscreen'), 'no ad after the first look');
    await making(); await stroke(); await done(); await page.click('#next'); await idle();
    const l = await log();
    assert.equal(l.filter((x) => x === 'fullscreen').length, 1);
    const at = l.indexOf('fullscreen');
    assert.ok(l.slice(0, at).includes('gameplayStop') && l.slice(at).includes('gameplayStart'), 'gameplay stops for the ad and starts again');
    assert.equal((await state()).completions, 2);
  });

  await check('the daily colour: a refused video grants nothing, an earned one keeps the colour', async () => {
    await page.click('#daily');
    await page.evaluate(() => { window.__fakeAds.rewarded = false; });
    await page.click('#panel .get'); await idle();
    assert.deepEqual((await state()).owned, []);
    await page.evaluate(() => { window.__fakeAds.rewarded = true; });
    await page.click('#panel .get'); await idle();
    assert.equal((await state()).owned.length, 1);
    await page.waitForSelector('#panel .get.owned', { timeout: 5000 });
    await page.click('#panel .get');
  });

  await check('Redo for a video gives the same face back, clean', async () => {
    await stroke(); await done();
    const before = await state();
    await page.click('#redo'); await idle();
    const s = await state();
    assert.deepEqual([s.seed, s.id, s.phase, s.strokes], [before.seed, before.id + 1, 'create', 0]);
  });

  await check('the SDK\'s pause freezes the game and stops gameplay; mute silences it', async () => {
    await page.evaluate(() => window.__gp.__pause());
    assert.ok(await page.evaluate(() => document.getElementById('app').inert));
    assert.equal((await log()).at(-1), 'gameplayStop');
    await page.evaluate(() => window.__gp.__resume());
    assert.ok(!(await page.evaluate(() => document.getElementById('app').inert)));
    await page.evaluate(() => window.__gp.__mute(true));
    assert.equal(await page.evaluate(() => game.host.state().audio), false);
    await page.evaluate(() => window.__gp.__mute(false));
    assert.equal(await page.evaluate(() => game.host.state().audio), true);
  });

  await check('a portal without rewarded videos hides Redo and the daily gift, and Next still works', async () => {
    await page.evaluate(() => { window.__fakeAds.noRewarded = true; });
    await stroke(); await done();
    assert.ok(await page.isHidden('#redo'), 'Redo hidden');
    await page.click('#next'); await idle();
    assert.equal((await state()).phase, 'create');
    await page.evaluate(() => { window.__fakeAds.noRewarded = false; });
  });

  await check('reload restores the look from the save field', async () => {
    await stroke();
    await page.evaluate(() => game.session.flush());
    const before = await state();
    await page.reload(); await ready(page);
    const after = await state();
    assert.deepEqual([after.seed, after.id, after.strokes, after.owned], [before.seed, before.id, before.strokes, before.owned]);
  });

  assert.deepEqual(errors, [], 'no page errors');
  console.log(`\n${n} GamePush checks passed`);
} finally {
  await browser.close();
  server.close();
}
