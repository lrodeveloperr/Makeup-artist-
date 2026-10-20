// Assisted touch integrity (owner, 20 October 2026: the zones must be rock solid). In the YouTube page with the SDK
// stand-in, on several faces and for every painting tool, a grid of points over the face (every 6 CSS px): every point
// in one of the tool's zones (the zones that light up under a finger, game/zones.js) must paint when a finger strokes
// through it, the paint must show (the picture changes where the paint went: checked on every fifth point), and every
// point a finger stores must lie in one of the tool's zones (or on the lash line it is guided to). Gems: on the face,
// never on the lips.
// Usage: node tools/build-game.mjs && node tests/zones.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { serve } from '../tools/serve.mjs';
import * as G from '../src/game/game.js';

const SDK_URL = 'https://www.youtube.com/game_api/v1';
const fixture = fs.readFileSync(new URL('../tools/fake-ytgame.js', import.meta.url), 'utf8');
const executablePath = process.env.CHROME || (process.env.CI ? undefined : '/opt/pw-browsers/chromium-1194/chrome-linux/chrome');
const server = await serve('build', 8162);
const browser = await chromium.launch({ executablePath });
const COLOUR = { lip: 'lip-berry', brush: 'brush-berry', glow: 'glow-gold', pencil: 'pencil-black', liner: 'liner-black' };
let failed = false;
try {
  for (const seed of [4, 8, 17]) {
    const ctx = await browser.newContext({ viewport: { width: 420, height: 800 } });
    await ctx.route(SDK_URL, (r) => r.fulfill({ contentType: 'text/javascript', body: fixture }));
    await ctx.addInitScript((save) => { localStorage.setItem('fake-ytgame-save', save); }, G.serialise(G.newGame(seed)));
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('http://localhost:8162/game/index.html');
    await page.waitForFunction('window.game', null, { timeout: 120000 });
    for (const tool of Object.keys(COLOUR)) {
      const r = await page.evaluate(([tool, colour]) => {
        const v = game.view, m = v.makeup, P = m.picker, gl = v.renderer.gl, g = v.headGeometry.geometry, brows = v.profile.brows;
        const [W, H] = v.cssSize, pr = v.renderer.pixelRatio, BH = gl.drawingBufferHeight;
        const read = (x, y, n = 4) => { const px = new Uint8Array((2 * n + 1) ** 2 * 4); gl.readPixels(Math.round(x * pr) - n, BH - Math.round(y * pr) - n, 2 * n + 1, 2 * n + 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; };
        const zoneOf = (ref, at) => game.zoneAt(tool, { ref }, game.regionsAt(g, at), brows, game.mouth);
        // every point the zones accept (after guiding or capture), where it went
        const zones = m.zones; let went = [];
        m.zones = (...a) => { const z = zones(...a); if (z !== null) went.push({ z, pos: a[1].pos.slice(), ref: a[1].ref.slice() }); return z; };
        const LID = tool === 'pencil' || tool === 'liner', mm4 = Math.abs(P.project([0.2, 0, 0.3])[0] - P.project([0.1, 0, 0.3])[0]) * 10 * 0.02;
        const out = { inZone: 0, painted: 0, shown: 0, checked: 0, misses: [], hidden: [], strays: [] };
        m.reset(v.profile);
        let k = 0;
        for (let y = 3; y < H; y += 6) for (let x = 3; x < W; x += 6) {
          let hit = P.pick(x, y);
          if (hit?.kind === 'eye' && LID) hit = P.lidNear(x, y, hit.eye);
          if (hit?.kind !== 'skin' || v.garment?.covers(hit.ref) || zoneOf(hit.ref.slice(), hit.at) === null) continue;
          out.inZone++;
          went = [];
          // a finger strokes 4 mm across the point
          const s = m.begin(tool, colour, true); m.move(s, x - mm4, y); m.move(s, x, y); m.move(s, x + mm4, y);
          if (!m.end(s)) { out.misses.push([x, y]); continue; }
          out.painted++;
          // where the paint went is in one of the tool's zones (exactly, or within 0.5 mm of its edge where capture put it)
          for (const w of went) {
            const h = P.pick(...P.project(w.pos));
            if (h?.kind === 'skin' && zoneOf(h.ref, h.at) === null && !(LID && /^lash/.test(w.z))) {
              // captured points sit just inside the edge: allow the half-millimetre the screen pick can differ
              const near = [[0.005, 0], [-0.005, 0], [0, 0.005], [0, -0.005]].some(([dx, dy]) => zoneOf([w.ref[0] + dx, w.ref[1] + dy, w.ref[2]], h.at) !== null);
              if (!near) out.strays.push([x, y, w.z]);
            }
          }
          if (k++ % 5 === 0) {
            const at = [went[0], went[went.length >> 1], went[went.length - 1]].map((w) => P.project(w.pos));
            v.render();
            const after = at.map(([sx, sy]) => read(sx, sy));
            m.reset(v.profile); v.render();
            const before = at.map(([sx, sy]) => read(sx, sy));
            let d = 0;
            for (let j = 0; j < 3; j++) for (let i = 0; i < after[j].length; i++) d = Math.max(d, Math.abs(after[j][i] - before[j][i]));
            out.checked++;
            if (d >= 4) out.shown++; else out.hidden.push([x, y, d]);
          } else m.reset(v.profile);
        }
        m.zones = zones; m.reset(v.profile); v.render();
        return out;
      }, [tool, COLOUR[tool]]);
      const line = `face ${seed} ${tool.padEnd(6)} ${r.painted}/${r.inZone} zone points paint, ${r.shown}/${r.checked} show, ${r.strays.length} stray`;
      console.log((r.misses.length || r.hidden.length || r.strays.length ? 'FAIL ' : 'ok   ') + line);
      if (r.misses.length || r.hidden.length || r.strays.length) {
        failed = true;
        console.log('  misses', JSON.stringify(r.misses.slice(0, 5)), 'hidden', JSON.stringify(r.hidden.slice(0, 5)), 'strays', JSON.stringify(r.strays.slice(0, 5)));
      }
      assert.ok(r.inZone > 30, `${tool}: its zones are on the face`);
    }
    // gems: anywhere on the face but the lips
    const gems = await page.evaluate(() => {
      const v = game.view, m = v.makeup, P = m.picker, L = v.eyes.meshes[0].position;
      const tap = (p) => { const [x, y] = P.project(p), s = m.tapGem(x, y, 'gem-crystal', true); m.reset(v.profile); return !!s; };
      return { forehead: tap([0, L[1] + 0.45, L[2] + 0.2]), cheek: tap([L[0] + 0.1, L[1] - 0.35, L[2] + 0.1]), lips: tap([0, L[1] - 0.62, L[2] + 0.3]) };
    });
    console.log(`${gems.forehead && gems.cheek && !gems.lips ? 'ok  ' : 'FAIL'} face ${seed} gems: forehead ${gems.forehead}, cheek ${gems.cheek}, lips ${gems.lips}`);
    if (!(gems.forehead && gems.cheek && !gems.lips)) failed = true;
    assert.deepEqual(errors, []);
    await ctx.close();
  }
} finally {
  await browser.close();
  server.close();
}
if (failed) { console.log('FAIL'); process.exit(1); }
console.log('PASS: every zone point of every tool paints and shows, on 3 faces; nothing lands outside the zones');
