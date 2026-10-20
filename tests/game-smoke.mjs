// Browser test of the game screen (build/game, the YouTube page) with the test stand-in for the YouTube SDK
// (tools/fake-ytgame.js, injected here by the test runner in place of https://www.youtube.com/game_api/v1).
// Covers: readiness signals, many colours six to a page with arrows, painting with the mouse, Done → review, Next, the interstitial on the
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
    // review's buttons rise into place and rest exactly there (an animation of the same name elsewhere once sent them
    // flying up and spinning)
    // (in place: not moved or turned; Retry breathes, so a gentle scale is fine)
    const inPlace = (t) => t === 'none' || /^matrix\([\d.]+, 0, 0, [\d.]+, 0, 0\)$/.test(t);
    const settled = () => page.evaluate(() => new Promise((r) => setTimeout(() => r([...document.querySelectorAll('#review > *:not([hidden])')].map((el) => getComputedStyle(el).transform)), 900)));
    for (const t of await settled()) assert.ok(inPlace(t), `review's buttons at rest in place (${t})`);
    await page.click('#next'); await idle(page);
    s = await state(page);
    assert.equal(s.seed, nextSeed, 'the previewed customer came next');
    assert.ok(!s.sdk.includes('interstitial'));
    // an untouched look: Done, Next, nothing counted; its review buttons in place too
    await done(page);
    for (const t of await settled()) assert.ok(inPlace(t), `an untouched look's review buttons in place (${t})`);
    await page.click('#next'); await idle(page);
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
    // the gift opens: the clock stops, then the arrow takes the player back with the colour selected
    await page.waitForSelector('#panel .get.owned', { timeout: 5000 });
    const stopped = await page.textContent('#panel .time');
    await page.waitForTimeout(1300);
    assert.equal(await page.textContent('#panel .time'), stopped, 'the clock stops once the gift is opened');
    await page.click('#panel .get'); // continue
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
    await page.waitForSelector('#panel .get.owned', { timeout: 5000 }); // the box opens, then the arrow
    await page.click('#panel .get'); // continue closes the card
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
    // a point on her left cheek, one in the middle of her forehead, and her mouth (page pixels)
    const [x, y, tip, fx, fy, mx, my] = await page.evaluate(() => {
      const v = game.view, c = document.querySelector('#stage canvas').getBoundingClientRect(), L = v.eyes.meshes[0].position, P = v.makeup.picker;
      const [px, py] = P.project([L[0] + 0.12, L[1] - 0.36, L[2]]), [hx, hy] = P.project([0, L[1] + 0.45, L[2] + 0.2]), [ux, uy] = P.project([0, L[1] - 0.62, L[2] + 0.3]);
      return [c.left + px, c.top + py, Math.min(54, c.height * 0.16), c.left + hx, c.top + hy, c.left + ux, c.top + uy];
    });
    // the brush's zones at each stored point of a stroke (assisted touch, game/zones.js)
    const zones = (stroke) => page.evaluate((stroke) => {
      const out = new Set(), brows = game.view.profile.brows;
      for (const seg of stroke.segments) for (let i = 0; i < seg.length; i += 3) out.add(game.zoneAt(stroke.tool, { ref: [seg[i] / 1024, seg[i + 1] / 1024, seg[i + 2] / 1024] }, [1, 1, 0, 0, 0, 0, 0, 0], brows, game.mouth));
      return [...out];
    }, stroke);
    const last = () => page.evaluate(() => game.view.makeup.makeup.strokes.at(-1));
    assert.ok(await page.isHidden('#hand'));
    await touch('touchStart', [[x, y + tip]]);
    assert.ok(await page.evaluate(() => game.glow.mesh.visible), "the brush's zones light up while the finger is down");
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
    assert.ok(!(await page.evaluate(() => game.glow.mesh.visible)), 'and so is the light on the zones');
    assert.equal((await state(page)).strokes, 1, 'it painted');
    assert.deepEqual(await zones(await last()), ['cheekl'], 'on the cheek');
    // a slip: a stroke that starts on the cheek and runs on over her nose and mouth paints only the cheek
    await touch('touchStart', [[x, y + tip]]);
    for (let k = 1; k <= 16; k++) await touch('touchMove', [[x + ((mx - x) * k) / 16, y + tip + ((my - y) * k) / 16]]);
    await touch('touchEnd', []);
    assert.equal((await state(page)).strokes, 2);
    assert.deepEqual(await zones(await last()), ['cheekl'], 'the stroke stays in the zone it started in');
    // a touch that lifts without sliding leaves one dab, where the tip was
    await touch('touchStart', [[x + 10, y + tip]]);
    await touch('touchEnd', []);
    assert.equal((await state(page)).strokes, 3, 'a tap leaves a dab');
    assert.equal((await last()).segments.length, 1, 'one dab');
    // outside every zone of the brush (her forehead), a finger paints nothing
    await touch('touchStart', [[fx, fy + tip]]);
    for (let k = 1; k <= 6; k++) await touch('touchMove', [[fx + k * 4, fy + tip]]);
    await touch('touchEnd', []);
    assert.equal((await state(page)).strokes, 3, 'no paint outside the zones');
    // a mouse holds the tool in place of the cursor, its tip at the pointer, before and while it paints, and is free:
    // it paints her forehead
    await page.mouse.move(fx, fy);
    at = await drawnTip();
    assert.ok(at.shown && Math.abs(at.x - fx) < 1.5 && Math.abs(at.y - fy) < 1.5 && at.cursor === 'none', `hovering: the tool's tip at the pointer, no cursor (${JSON.stringify(at)})`);
    await page.mouse.down(); await page.mouse.move(fx + 20, fy, { steps: 4 });
    at = await drawnTip();
    assert.ok(at.shown && Math.abs(at.x - (fx + 20)) < 1.5 && Math.abs(at.y - fy) < 1.5, 'painting: the tip follows the pointer');
    assert.ok(!(await page.evaluate(() => game.glow.mesh.visible)), 'no zones under a mouse');
    await page.mouse.up();
    assert.equal((await state(page)).strokes, 4, 'the mouse painted at the pointer, outside the zones');
    await page.mouse.move(2, 2); // off the face: the tool goes, the cursor comes back
    at = await drawnTip();
    assert.ok(!at.shown && at.cursor === '');
    // a thumb (a wide contact) holds the tool higher than a forefinger, so the tool shows above it
    const thumb = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y]) => ({ x, y, id: 2, radiusX: 26, radiusY: 30, force: 1 })) });
    const high = await page.evaluate(() => Math.min(30 + 30, document.querySelector('#stage canvas').clientHeight * 0.16));
    await thumb('touchStart', [[x, y + 80]]);
    at = await drawnTip();
    assert.ok(at.shown && Math.abs(at.y - (y + 80 - high)) < 1.5 && high > tip, `a thumb holds it ${high} px up, a forefinger ${tip} px (${at.y})`);
    await thumb('touchEnd', []);
    await ctx.close();
  });

  await check('assisted touch: under a finger every tool paints in its own zones, a stroke stays in its zone, gems go on the face', async () => {
    for (const seed of [4, 9, 17]) {
      const { ctx, page } = await open({ phone: true, save: G.serialise(G.newGame(seed)) });
      await ready(page);
      await page.waitForFunction(() => document.getElementById('cover').hidden);
      const cdp = await ctx.newCDPSession(page);
      const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y]) => ({ x, y, id: 1, radiusX: 6, radiusY: 6, force: 1 })) });
      const tip = await page.evaluate(() => Math.min(54, document.querySelector('#stage canvas').clientHeight * 0.16));
      const count = () => page.evaluate(() => game.session.state.attempt.makeup.strokes.length);
      for (const tool of ['brush', 'glow', 'pencil', 'liner', 'lip']) {
        await page.evaluate((tool) => game.session.select(tool), tool);
        // a point well inside each of the tool's zones (page pixels), found from the head's vertices
        const spots = await page.evaluate((tool) => {
          const v = game.view, g = v.headGeometry.geometry, P = v.makeup.picker, c = document.querySelector('#stage canvas').getBoundingClientRect();
          const ref = g.attributes.ref.array, pos = g.attributes.position.array, A = g.attributes.regionA.array, B = g.attributes.regionB.array;
          const all = {};
          for (let i = 0; i < ref.length / 3; i++) {
            const reg = [...A.slice(i * 4, i * 4 + 4), ...B.slice(i * 4, i * 4 + 4)];
            const z = game.zoneAt(tool, { ref: [ref[i * 3], ref[i * 3 + 1], ref[i * 3 + 2]] }, reg, v.profile.brows, game.mouth);
            if (z) (all[z] ||= []).push(i);
          }
          const out = {};
          for (const [z, list] of Object.entries(all)) {
            const m = [0, 1, 2].map((a) => list.reduce((s, i) => s + ref[i * 3 + a], 0) / list.length);
            list.sort((i, j) => Math.hypot(ref[i * 3] - m[0], ref[i * 3 + 1] - m[1]) - Math.hypot(ref[j * 3] - m[0], ref[j * 3 + 1] - m[1]));
            for (const i of list.slice(0, 600)) {
              const [x, y] = P.project([pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]), hit = P.pick(x, y);
              if (hit?.kind === 'skin' && v.makeup.zones(tool, hit) === z) { out[z] = [c.left + x, c.top + y]; break; }
            }
          }
          return out;
        }, tool);
        const names = Object.keys(spots);
        assert.ok(names.length >= (tool === 'lip' ? 1 : 2), `${tool}: its zones are on the face (${names})`);
        for (const [zone, [x, y]] of Object.entries(spots)) {
          // a short stroke in the zone paints
          const before = await count();
          await touch('touchStart', [[x, y + tip]]);
          for (let k = 1; k <= 3; k++) await touch('touchMove', [[x + (k % 2 ? 2 : -2), y + tip + k]]);
          await touch('touchEnd', []);
          assert.equal(await count(), before + 1, `${tool} paints in ${zone} (seed ${seed})`);
          // a long slip from the zone across her whole face: the stroke's points stay in the zone it started in
          await page.evaluate(() => {
            const m = game.view.makeup, zones = m.zones;
            window.__zones = []; m.zones = (...a) => { const z = zones(...a); window.__zones.push(z); return z; }; window.__restore = () => { m.zones = zones; };
          });
          const box = await page.locator('#stage canvas').boundingBox(), to = [box.x + box.width - x + box.x, y + 120];
          await touch('touchStart', [[x, y + tip]]);
          for (let k = 1; k <= 30; k++) await touch('touchMove', [[x + ((to[0] - x) * k) / 30, y + tip + ((to[1] - y) * k) / 30]]);
          await touch('touchEnd', []);
          const seen = await page.evaluate(() => { window.__restore(); return window.__zones; });
          const stroke = await page.evaluate(() => game.session.state.attempt.makeup.strokes.at(-1));
          assert.equal(await count(), before + 2, `${tool}: the slip painted in ${zone}`);
          assert.equal(seen.find((z) => z !== null), zone, `${tool}: the slip started in ${zone}`);
          assert.ok(seen.some((z) => z === null) || new Set(seen.filter(Boolean)).size > 1, `${tool}: the slip left ${zone} (${[...new Set(seen)]})`);
          const points = stroke.segments.reduce((n, s) => n + s.length / 3, 0);
          assert.ok(points <= seen.filter((z) => z === zone).length + stroke.segments.length, `${tool}: only points in ${zone} were kept`);
        }
        // her forehead is in none of these tools' zones: nothing is painted there
        const [fx, fy] = await page.evaluate(() => {
          const v = game.view, c = document.querySelector('#stage canvas').getBoundingClientRect(), L = v.eyes.meshes[0].position, [x, y] = v.makeup.picker.project([0, L[1] + 0.45, L[2] + 0.2]);
          return [c.left + x, c.top + y];
        });
        const before = await count();
        await touch('touchStart', [[fx, fy + tip]]);
        for (let k = 1; k <= 6; k++) await touch('touchMove', [[fx + k * 5, fy + tip]]);
        await touch('touchEnd', []);
        assert.equal(await count(), before, `${tool}: nothing painted outside its zones`);
      }
      // gems: on her forehead or cheek, yes; on her lips, no
      await page.evaluate(() => game.session.select('gem'));
      const [[gx, gy], [lx, ly]] = await page.evaluate(() => {
        const v = game.view, c = document.querySelector('#stage canvas').getBoundingClientRect(), L = v.eyes.meshes[0].position, P = v.makeup.picker;
        return [[0, L[1] + 0.45, L[2] + 0.2], [0, L[1] - 0.66, L[2] + 0.3]].map((p) => { const [x, y] = P.project(p); return [c.left + x, c.top + y]; });
      });
      const before = await count();
      await touch('touchStart', [[lx, ly + tip]]); await touch('touchEnd', []);
      assert.equal(await count(), before, 'no gem on the lips');
      await touch('touchStart', [[gx, gy + tip]]); await touch('touchEnd', []);
      assert.equal(await count(), before + 1, 'a gem on the forehead');
      await ctx.close();
    }
  });

  await check('guided paint shows while the finger is still down, on a big screen (the redrawn patch covers where it went)', async () => {
    const { ctx, page } = await open({ phone: true, size: [1024, 1366] });
    await ready(page);
    await page.waitForFunction(() => document.getElementById('cover').hidden);
    const cdp = await ctx.newCDPSession(page);
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y]) => ({ x, y, id: 1, radiusX: 6, radiusY: 6, force: 1 })) });
    for (const tool of ['liner', 'pencil', 'glow']) {
      await page.evaluate((tool) => game.session.select(tool), tool);
      // 7 mm above her left upper lashes (the liner and pencil are guided down onto them), or just under her left
      // cheekbone (the highlighter is pulled up onto it)
      const [x0, x1, y, tip] = await page.evaluate((tool) => {
        const v = game.view, c = document.querySelector('#stage canvas').getBoundingClientRect(), L = v.eyes.meshes[0].position, P = v.makeup.picker;
        const dy = tool === 'glow' ? -0.3 : 0.11, a = P.project([L[0] - 0.06, L[1] + dy, L[2] + 0.15]), b = P.project([L[0] + 0.08, L[1] + dy, L[2] + 0.15]);
        return [c.left + a[0], c.left + b[0], c.top + a[1], Math.min(54, c.height * 0.16)];
      }, tool);
      await touch('touchStart', [[x0, y + tip]]);
      for (let k = 1; k <= 12; k++) await touch('touchMove', [[x0 + ((x1 - x0) * k) / 12, y + tip]]);
      // the picture on screen mid-stroke, against the whole face drawn again
      const diff = await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => {
        const v = game.view, gl = v.renderer.gl, w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, a = new Uint8Array(w * h * 4), b = new Uint8Array(w * h * 4);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, a);
        v.render();
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, b);
        let n = 0; for (let i = 0; i < a.length; i++) n += Math.abs(a[i] - b[i]) > 2;
        r([n, game.view.makeup.makeup.strokes.length]);
      }))));
      await touch('touchEnd', []);
      assert.ok(diff[0] < 60, `${tool}: what shows mid-stroke is the whole picture (${diff[0]} values differ)`);
      const painted = await page.evaluate(() => game.view.makeup.makeup.strokes.length);
      assert.equal(painted, diff[1] + 1, `${tool}: the stroke painted`);
    }
    await ctx.close();
  });

  await check('many colours: six to a page, newest first, never cut off; the arrows, a swipe, a drag and the wheel turn the page', async () => {
    const all = Object.values(DAILY).flat().map((c) => c.id), save = G.serialise({ ...G.newGame(21), owned: all });
    const newest = DAILY.lip.at(-1);
    // the page on show: its colours, and whether each is whole inside the counter (the picked one's ring included)
    const tray = (page) => page.evaluate(() => {
      const foot = document.getElementById('create').getBoundingClientRect(), sw = [...document.querySelectorAll('#swatches button')];
      const whole = sw.every((b) => {
        const r = b.getBoundingClientRect(), ring = b.getAttribute('aria-checked') === 'true' ? 9 * r.width / 43 : 0;
        return r.left - ring >= foot.left && r.right + ring <= foot.right && r.top - ring >= foot.top && r.bottom + ring <= foot.bottom;
      });
      return { names: sw.map((b) => b.getAttribute('aria-label')), whole, arrows: !!document.getElementById('more').offsetParent, pick: game.session.state.selection.colour.lip };
    });
    for (const [size, phone] of [[[1920, 1080], false], [[400, 780], false], [[844, 390], true]]) {
      const { ctx, page } = await open({ save, size, phone });
      await ready(page);
      const press = (sel) => page[phone ? 'tap' : 'click'](sel);
      const where = `${size.join('x')}: `;
      await press('#toolbar [data-tool="lip"]');
      let t = await tray(page);
      assert.ok(t.arrows, where + 'arrows for more than six');
      assert.equal(t.names.length, 6, where + 'six colours on a page');
      assert.ok(t.whole, where + 'every colour whole');
      const pick = t.pick, start = t.names[0];
      // back to the first page: the newest colour of the day first
      while (!(await page.isDisabled('#back'))) await press('#back');
      t = await tray(page);
      assert.ok(t.names[0].startsWith(newest.name), where + `the newest colour first (${t.names[0]})`);
      await press('#more');
      const second = (await tray(page)).names[0];
      assert.notEqual(second, t.names[0], where + 'the next arrow turns the page');
      // a swipe or a drag to the left on the colours turns to the next page, and picks no colour
      const b = await page.locator('#swatches').boundingBox(), y = b.y + b.height / 2;
      if (phone) {
        const cdp = await ctx.newCDPSession(page), at = (x) => [{ x, y }];
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(b.x + b.width * 0.8) });
        for (let k = 1; k <= 6; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(b.x + b.width * (0.8 - 0.1 * k)) });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else {
        await page.mouse.move(b.x + b.width * 0.8, y); await page.mouse.down();
        await page.mouse.move(b.x + b.width * 0.2, y, { steps: 6 }); await page.mouse.up();
      }
      t = await tray(page);
      assert.notEqual(t.names[0], second, where + 'a swipe turns the page');
      assert.equal(t.pick, pick, where + 'a swipe picks no colour');
      if (!phone) {
        await page.mouse.move(b.x + b.width / 2, y);
        await page.mouse.wheel(0, -120);
        await page.waitForTimeout(50);
        await page.mouse.wheel(0, -120); // the same flick: still one page
        await page.waitForFunction((n) => document.querySelector('#swatches button')?.getAttribute('aria-label') === n, second, { timeout: 3000 }).catch(() => {});
        assert.equal((await tray(page)).names[0], second, where + 'a wheel flick turns one page');
      }
      // the last page: the next arrow fades out
      while (!(await page.isDisabled('#more'))) await press('#more');
      t = await tray(page);
      assert.ok(t.whole && t.names.length >= 1 && t.names.length <= 6, where + 'the last page');
      // another tool, and back: the page with the picked colour
      await press('#toolbar [data-tool="brush"]');
      await press('#toolbar [data-tool="lip"]');
      assert.equal((await tray(page)).names[0], start, where + 'a tool opens on its picked colour');
      await ctx.close();
    }
    // with only the base colours: the brush's six on one page, no arrows; the lip's clear gloss on its first page
    const { ctx, page } = await open({ size: [1920, 1080] });
    await ready(page);
    await page.click('#toolbar [data-tool="brush"]');
    assert.ok(!(await tray(page)).arrows, 'no arrows for one page');
    await page.click('#toolbar [data-tool="lip"]');
    assert.ok((await page.locator('#swatches [aria-label="Clear gloss"]').count()) === 1, 'the clear gloss on the lip\'s first page');
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
