// Browser smoke test: renders faces in Chromium (WebGL2) and fails on shader/page errors or a blank canvas, and
// applies every makeup tool to a face with scripted strokes, the mouse and touch (see paintCheck, nearCheck,
// lipOrderCheck, touchCheck).
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

// Makeup tools on a real face: every tool and a lens change the face where they were applied and nowhere else;
// a real mouse drag adds a stroke; the saved state rebuilds the same look; a reset gives back the clean face.
async function paintCheck(page, errors) {
  const r = await page.evaluate(() => {
    const v = window.view, a = v.makeup, P = a.picker, c = v.renderer.domElement;
    // the outfit never takes paint, and its anti-aliased neckline varies by a few pixels between frames in
    // software WebGL, so it is hidden while pixels are compared
    v.garment.mesh.visible = false;
    const shot = () => {
      v.render();
      const g = Object.assign(document.createElement('canvas'), { width: c.width, height: c.height }).getContext('2d');
      g.drawImage(c, 0, 0);
      return g.getImageData(0, 0, c.width, c.height).data;
    };
    // pixels that differ by more than `tol` in any channel, and the largest difference
    const diff = (x, y, tol = 2) => {
      let n = 0, max = 0;
      for (let i = 0; i < x.length; i += 4) {
        const d = Math.max(Math.abs(x[i] - y[i]), Math.abs(x[i + 1] - y[i + 1]), Math.abs(x[i + 2] - y[i + 2]));
        if (d > tol) n++;
        max = Math.max(max, d);
      }
      return { n, max };
    };
    const L = v.eyes.meshes[0].position, R = v.eyes.meshes[1].position, pr = (p) => P.project(p);
    const line = (p0, p1, k = 16) => Array.from({ length: k + 1 }, (_, i) => [p0[0] + ((p1[0] - p0[0]) * i) / k, p0[1] + ((p1[1] - p0[1]) * i) / k]);
    const stroke = (tool, colour, pts) => { const g = a.begin(tool, colour); for (const p of pts) a.move(g, p[0], p[1]); return !!a.end(g); };
    const clean = shot();
    const ok = [
      stroke('brush', 'brush-berry', line(pr([L[0] + 0.05, L[1] - 0.4, L[2]]), pr([L[0] + 0.2, L[1] - 0.48, L[2] - 0.05]))),
      stroke('brush', 'brush-gold', line(pr([R[0] - 0.12, R[1] + 0.09, R[2] + 0.12]), pr([R[0] + 0.13, R[1] + 0.1, R[2] + 0.1]))),
      stroke('pencil', 'pencil-black', line(pr([L[0] - 0.12, L[1] + 0.07, L[2] + 0.13]), pr([L[0] + 0.15, L[1] + 0.08, L[2] + 0.1]), 30)),
      stroke('lip', 'lip-red-gloss', line(pr([-0.15, -0.58, 0.5]), pr([0.15, -0.58, 0.5]), 30)),
      stroke('mascara', 'mascara-navy', line(pr([R[0] - 0.15, R[1] + 0.1, R[2] + 0.2]), pr([R[0] + 0.15, R[1] + 0.1, R[2] + 0.2]))),
      a.tapLens(...pr([L[0], L[1], L[2] + v.eyes.meshes[0].scale[0]]), 'lens-violet'),
      stroke('glow', 'glow-gold', line(pr([R[0] + 0.02, R[1] - 0.3, R[2] - 0.02]), pr([R[0] - 0.18, R[1] - 0.22, R[2] - 0.08]))),
      stroke('liner', 'liner-black', line(pr([L[0] - 0.1, L[1] + 0.02, L[2] + 0.14]), pr([L[0] + 0.18, L[1] + 0.1, L[2] + 0.08]), 30)),
      !!a.tapGem(...pr([R[0] - 0.05, R[1] - 0.45, R[2] - 0.05]), 'gem-crystal'),
    ];
    const live = shot();
    const saved = JSON.stringify(a.makeup);
    // nothing outside the face changes: the top corners are background
    const corner = (img) => { const out = []; for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) for (const X of [x, c.width - 1 - x]) out.push(...img.slice((y * c.width + X) * 4, (y * c.width + X) * 4 + 3)); return out; };
    const cornersSame = corner(clean).every((x, i) => x === corner(live)[i]);
    a.reset(window.face);
    const reset = shot();
    a.restore(JSON.parse(saved));
    const restored = shot();
    v.garment.mesh.visible = true;
    v.render();
    return { ok, strokes: a.makeup.strokes.length, painted: diff(clean, live), reset: diff(clean, reset), restored: diff(live, restored), cornersSame };
  });
  if (!r.ok.every(Boolean) || r.strokes !== 8) errors.push(`paint: a scripted tool did nothing (${JSON.stringify(r.ok)})`);
  if (r.painted.n < 1000) errors.push(`paint: only ${r.painted.n} pixels changed`);
  if (!r.cornersSame) errors.push('paint: pixels away from the face changed');
  if (r.reset.n) errors.push(`paint: reset left ${r.reset.n} pixels different from the clean face`);
  if (r.restored.n > 20 || r.restored.max > 12) errors.push(`paint: the restored look differs from the live one (${JSON.stringify(r.restored)})`);
  // the real input path: a mouse drag over the cheek with the selected tool adds one stroke
  const box = await page.locator('#stage canvas').boundingBox();
  const [p0, p1] = await page.evaluate(() => { const v = window.view, L = v.eyes.meshes[1].position; return [[L[0] - 0.05, L[1] - 0.42, L[2]], [L[0] - 0.2, L[1] - 0.45, L[2]]].map((p) => v.makeup.picker.project(p)); });
  await page.mouse.move(box.x + p0[0], box.y + p0[1]);
  await page.mouse.down();
  await page.mouse.move(box.x + p1[0], box.y + p1[1], { steps: 6 });
  await page.mouse.up();
  const after = await page.evaluate(() => window.view.makeup.makeup.strokes.map((s) => s.tool + '/' + s.colour).pop() + ' ' + window.view.makeup.makeup.strokes.length);
  if (after !== 'brush/brush-rose 9') errors.push(`paint: the mouse drag did not add a brush stroke (${after})`);
  console.log(`paint: ${r.painted.n} pixels painted by 7 strokes, a gem and a lens; restore differs in ${r.restored.n} pixels (max ${r.restored.max}); reset is clean: ${!r.reset.n}`);
}

// Paint draws only the head's triangles near each batch of dabs, clipped to their texels (PaintLayer's Reach): the
// same strokes with every surface tool, over the cheeks, nose, lips, brows, lids and across the face's seams, leave
// exactly the same paint as drawing the whole head into the whole textures.
async function nearCheck(page, errors) {
  const r = await page.evaluate(() => {
    const v = window.view, a = v.makeup, P = a.picker, E = v.eyes.meshes.map((m) => m.position), gl = v.renderer.gl, PL = a.paint;
    const read = (rt) => {
      const t = v.renderer.target(rt), px = rt.halfFloat ? new Float32Array(rt.width * rt.height * 4) : new Uint8Array(rt.width * rt.height * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
      gl.readPixels(0, 0, rt.width, rt.height, gl.RGBA, rt.halfFloat ? gl.FLOAT : gl.UNSIGNED_BYTE, px);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return px;
    };
    const paths = [
      ['brush', 'brush-rose', [E[0][0] - 0.1, E[0][1] - 0.4, E[0][2]], [E[1][0] + 0.1, E[1][1] - 0.4, E[1][2]]],
      ['glow', 'glow-champagne', [0, 0.5, 0.8], [0, -0.2, 0.95]],
      ['pencil', 'pencil-espresso', [E[0][0] - 0.15, E[0][1] + 0.2, E[0][2]], [E[0][0] + 0.15, E[0][1] + 0.22, E[0][2]]],
      ['liner', 'liner-black', [E[1][0] - 0.12, E[1][1] + 0.08, E[1][2] + 0.08], [E[1][0] + 0.18, E[1][1] + 0.14, E[1][2]]],
      ['lip', 'lip-rose', [-0.2, -0.58, 0.5], [0.2, -0.58, 0.5]],
      ['brush', 'brush-rose', [-1.2, -0.2, 0], [1.2, -0.3, 0]],
    ];
    const saved = JSON.stringify(a.makeup);
    const paint = () => {
      PL.clear();
      for (const [tool, colour, p0, p1] of paths) {
        const g = a.begin(tool, colour), [x0, y0] = P.project(p0), [x1, y1] = P.project(p1);
        for (let k = 0; k <= 80; k++) a.move(g, x0 + ((x1 - x0) * k) / 80, y0 + ((y1 - y0) * k) / 80 + 6 * Math.sin(k / 4));
        a.end(g);
      }
      return [read(PL.colour), read(PL.finish), read(PL.coat)];
    };
    const near = paint(), reach = PL.reach, rect = reach.rect.bind(reach);
    reach.rect = (...args) => { rect(...args); reach.near.set(reach.index); reach.count = reach.index.length; return [0, 0, PL.colour.width, PL.colour.height]; };
    const whole = paint();
    reach.rect = rect;
    a.restore(JSON.parse(saved));
    let painted = 0, differ = 0;
    for (let l = 0; l < 3; l++) for (let i = 0; i < near[l].length; i++) { if (whole[l][i]) painted++; if (near[l][i] !== whole[l][i]) differ++; }
    return { painted, differ };
  });
  if (r.painted < 10000) errors.push(`paint reach: only ${r.painted} values painted`);
  if (r.differ) errors.push(`paint reach: ${r.differ} paint values differ from drawing the whole head`);
  console.log(`paint reach: ${r.painted} paint values, ${r.differ} differ from drawing the whole head`);
}

// Lipstick and gloss mix the same whichever goes on first (owner, 19 October 2026): a gloss is a coat over the
// lipstick, so gloss then lipstick leaves exactly the paint, and the face, of lipstick then gloss (clear, tinted and
// glitter glosses).
async function lipOrderCheck(page, errors) {
  const r = await page.evaluate(() => {
    const v = window.view, a = v.makeup, P = a.picker, gl = v.renderer.gl, PL = a.paint, c = v.renderer.domElement;
    const read = (rt) => {
      const t = v.renderer.target(rt), px = rt.halfFloat ? new Float32Array(rt.width * rt.height * 4) : new Uint8Array(rt.width * rt.height * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
      gl.readPixels(0, 0, rt.width, rt.height, gl.RGBA, rt.halfFloat ? gl.FLOAT : gl.UNSIGNED_BYTE, px);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return px;
    };
    const shot = () => { v.render(); const g = Object.assign(document.createElement('canvas'), { width: c.width, height: c.height }).getContext('2d'); g.drawImage(c, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
    const saved = JSON.stringify(a.makeup);
    v.garment.mesh.visible = false; // its anti-aliased neckline varies between frames in software WebGL (paintCheck)
    // three strokes across the lips with each product
    const rows = [-0.56, -0.58, -0.6].map((y) => [P.project([-0.17, y, 0.5]), P.project([0.17, y, 0.5])]);
    const apply = (colour) => { for (const [[x0, y0], [x1, y1]] of rows) { const g = a.begin('lip', colour); for (let k = 0; k <= 40; k++) a.move(g, x0 + ((x1 - x0) * k) / 40, y0 + ((y1 - y0) * k) / 40); a.end(g); } };
    const look = (order) => { a.reset(window.face); order.forEach(apply); return { paint: [PL.colour, PL.coat, PL.finish].map(read), face: shot() }; };
    const out = [];
    for (const [lipstick, gloss] of [['lip-red', 'lip-clear-gloss'], ['lip-red', 'lip-pink-gloss'], ['lip-nude', 'lip-red-glitter']]) {
      const first = look([lipstick, gloss]), second = look([gloss, lipstick]), bare = look([lipstick]);
      let differ = 0, glossed = 0, pixels = 0;
      for (let l = 0; l < 3; l++) for (let i = 0; i < first.paint[l].length; i++) if (first.paint[l][i] !== second.paint[l][i]) differ++;
      let most = 0;
      for (let i = 0; i < first.face.length; i++) if (first.face[i] !== second.face[i]) { pixels++; most = Math.max(most, Math.abs(first.face[i] - second.face[i])); }
      for (let i = 3; i < first.paint[1].length; i += 4) if (first.paint[1][i] > 0.5) glossed++;
      // the gloss changes the face over the lipstick alone (its shine)
      let shows = 0;
      for (let i = 0; i < first.face.length; i += 4) if (Math.abs(first.face[i] - bare.face[i]) + Math.abs(first.face[i + 1] - bare.face[i + 1]) + Math.abs(first.face[i + 2] - bare.face[i + 2]) > 12) shows++;
      out.push({ pair: `${lipstick} + ${gloss}`, differ, pixels, most, glossed, shows });
    }
    a.restore(JSON.parse(saved));
    v.garment.mesh.visible = true;
    v.render();
    return out;
  });
  for (const x of r) {
    if (x.differ || x.pixels) errors.push(`lip order: ${x.pair} differs by order (${x.differ} paint values, ${x.pixels} pixels)`);
    if (x.glossed < 500 || x.shows < 50) errors.push(`lip order: ${x.pair}: the gloss hardly shows (${x.glossed} texels, ${x.shows} pixels)`);
  }
  console.log(`lip order: ${r.map((x) => `${x.pair}: ${x.differ} paint values and ${x.pixels} pixels differ (max ${x.most})`).join('; ')}`);
}

// Touch: one finger paints, at the tool's tip a little above it (as Haircut's clipper); a second finger during the
// stroke adds nothing; a lens or a gem is aimed at the tip and goes on where the finger lifts.
async function touchCheck(browser, errors) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 760 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:8132/index.html?seed=9');
  await page.waitForFunction('window.done === true', null, { timeout: 120000 });
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y, id]) => ({ x, y, id, radiusX: 4, radiusY: 4, force: 1 })) });
  const box = await page.locator('#stage canvas').boundingBox();
  // where the tool works: this far above the finger (input.js)
  const tip = Math.min(72, box.height * 0.12);
  // canvas points: the middle of each cheek, a point beside it, and each iris (the finger goes `tip` below them)
  const [a, a1, b, b1, irisR, irisL] = (await page.evaluate(() => {
    const v = window.view, [L, R] = v.eyes.meshes.map((m) => m.position), r = v.eyes.meshes[0].scale[0];
    return [[L[0] + 0.08, L[1] - 0.42, L[2]], [L[0] + 0.2, L[1] - 0.47, L[2]], [R[0] - 0.08, R[1] - 0.42, R[2]], [R[0] - 0.2, R[1] - 0.47, R[2]],
      [R[0], R[1], R[2] + r], [L[0], L[1], L[2] + r]].map((p) => v.makeup.picker.project(p));
  })).map(([x, y]) => [box.x + x, box.y + y + tip]);
  const lerp = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  const state = () => page.evaluate(() => { const m = window.view.makeup.makeup; return { n: m.strokes.length, last: m.strokes.at(-1), lenses: m.lenses }; });
  await touch('touchStart', [[...a, 1]]);
  for (let k = 1; k <= 8; k++) await touch('touchMove', [[...lerp(a, a1, k / 8), 1]]);
  await touch('touchEnd', []);
  const one = await state();
  await touch('touchStart', [[...a, 1]]);
  await touch('touchStart', [[...a, 1], [...b, 2]]);
  for (let k = 1; k <= 8; k++) await touch('touchMove', [[...lerp(a, a1, k / 8), 1], [...lerp(b, b1, k / 8), 2]]);
  await touch('touchEnd', [[...a1, 1]]);
  await touch('touchEnd', []);
  const two = await state();
  const leftCheek = (s) => s.segments.flat().every((v, i) => i % 3 !== 0 || v > 0); // the face's left is +x
  await page.getByRole('button', { name: 'Lenses', exact: true }).tap();
  await page.getByRole('radio', { name: 'Grey', exact: true }).tap();
  await touch('touchStart', [[...irisR, 3]]); await touch('touchEnd', []);
  await touch('touchStart', [[...irisL, 4]]); await touch('touchMove', [[irisL[0] + 30, irisL[1], 4]]); await touch('touchEnd', []);
  const lens = await state();
  await page.getByRole('button', { name: 'Gems', exact: true }).tap();
  await page.getByRole('radio', { name: 'Pearl', exact: true }).tap();
  await touch('touchStart', [[...b, 5]]); await touch('touchEnd', []);
  await touch('touchStart', [[...a, 6]]); for (let k = 1; k <= 8; k++) await touch('touchMove', [[...lerp(a, a1, k / 8), 6]]); await touch('touchEnd', []);
  const gem = await state(), aimed = await page.evaluate(() => window.view.makeup.makeup.strokes.at(-1).segments[0]), scroll = await page.evaluate(() => [scrollX, scrollY, visualViewport.scale, visualViewport.offsetLeft, visualViewport.offsetTop]);
  if (one.n !== 1 || one.last.tool !== 'brush') errors.push(`touch: a one-finger drag did not paint (${one.n} strokes)`);
  if (two.n !== 2 || !leftCheek(two.last)) errors.push('touch: a second finger added marks');
  // the left lens was aimed off the iris before the finger lifted: no lens
  if (lens.lenses.right !== 'lens-grey' || lens.lenses.left !== null) errors.push(`touch: lens tap/aim wrong (${JSON.stringify(lens.lenses)})`);
  // a tap puts a gem at the tip; an aimed gem goes on where the finger lifts (beside the left cheek's middle)
  if (gem.n !== 4 || gem.last.tool !== 'gem' || gem.last.colour !== 'gem-pearl' || !(aimed[0] > 0)) errors.push(`touch: gem tap/aim wrong (${gem.n} strokes)`);
  if (scroll.join() !== '0,0,1,0,0') errors.push(`touch: the page scrolled, panned or zoomed (${scroll})`);
  console.log(`touch: one finger paints at the tool's tip, a second finger is ignored, lens and gem aimed at the tip: ${errors.length ? 'see errors' : 'ok'}`);
  await ctx.close();
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
  await paintCheck(first, errors);
  await nearCheck(first, errors);
  await lipOrderCheck(first, errors);
  await first.close();
  await touchCheck(browser, errors);
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
