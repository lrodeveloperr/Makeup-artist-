// Fast checks of the makeup tools without a browser: fixed tool behaviour, deterministic dab placement (live
// painting equals replay), stroke data validation and limits, lenses and the completion predicate, mascara caps,
// and picking on a real generated face.
// Usage: node tests/makeup.mjs
import assert from 'node:assert/strict';
import * as GL from '../src/gl/mini.js';
import { readHead } from '../tools/read-head.mjs';
import { HeadGeometry } from '../src/face/head-geometry.js';
import { generateFace } from '../src/face/generator.js';
import { Eyes } from '../src/face/eyes.js';
import { Lashes } from '../src/face/lashes.js';
import { IRIS, hexToLinear } from '../src/face/colors.js';
import { CAMERA } from '../src/face/face-view.js';
import { TOOLS, SURFACE_TOOLS, falloff, dabRate, DabWalker } from '../src/makeup/tools.js';
import { PALETTE, DAILY, TOOL_IDS, colourById, DEFAULT_SELECTION } from '../src/makeup/palette.js';
import { createMakeup, addStroke, setLens, isChanged, validStroke, validMakeup, encodeMakeup, decodeMakeup, pointCount, LIMITS, Q, toQ } from '../src/makeup/makeup.js';
import { StrokePainter } from '../src/makeup/paint.js';
import { Picker } from '../src/makeup/picker.js';
import { Applicator } from '../src/makeup/applicator.js';
import { createRng } from '../src/face/rng.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };
const close = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b}`);

// a layer that records dabs instead of drawing them
const recorder = () => ({ dabs: [], draw(tool, colour, dabs) { this.dabs.push(...dabs.map((d) => d.slice())); } });
// coverage left at point p by dabs of one tool (the paint shader's formula)
const coverage = (tool, dabs, p, sheer = 1) => {
  const t = TOOLS[tool], rate = dabRate(tool, sheer);
  return 1 - dabs.reduce((keep, d) => keep * (1 - rate * falloff(t.edge, Math.hypot(p[0] - d[0], p[1] - d[1], p[2] - d[2]) / t.radius)), 1);
};
const line = (a, b, k) => Array.from({ length: k + 1 }, (_, i) => a.map((v, c) => v + ((b[c] - v) * i) / k));

test('palette: stable unique ids, valid colours, every tool and the lenses have colours', () => {
  const ids = Object.values(PALETTE).flat().map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const [target, list] of Object.entries(PALETTE)) {
    assert.ok(list.length >= 2, target); // a choice in every tool, even with the basics only
    for (const c of list) {
      assert.match(c.hex, /^#[0-9a-f]{6}$/);
      assert.ok(c.id.startsWith(target + '-'), c.id);
      assert.equal(colourById(c.id).target, target);
      if (target === 'lens') assert.ok(c.iris.length === 4 && c.iris.every((h) => /^#[0-9a-f]{6}$/.test(h)));
    }
  }
  assert.deepEqual(TOOL_IDS, ['brush', 'pencil', 'mascara', 'lip']);
  for (const [tool, id] of Object.entries(DEFAULT_SELECTION.colour)) assert.equal(colourById(id).target, tool);
});

// sRGB hex to CIELAB, for telling colours apart
function lab(hex) {
  const v = [1, 3, 5].map((i) => { const c = parseInt(hex.slice(i, i + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  const [x, y, z] = [(0.4124 * v[0] + 0.3576 * v[1] + 0.1805 * v[2]) / 0.95047, 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2], (0.0193 * v[0] + 0.1192 * v[1] + 0.9505 * v[2]) / 1.08883];
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
const deltaE = (a, b) => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]));

test('colours of the day: every colour of a tool is tellable apart from every other, base included', () => {
  const finish = (c) => `${c.gloss ? 'g' : ''}${c.shimmer ? 's' : ''}`;
  const colour = (c) => (c.iris ? c.iris[1] : c.hex);
  const bad = [];
  let total = 0;
  for (const tool of Object.keys(PALETTE)) {
    const all = [...PALETTE[tool], ...DAILY[tool]];
    total += DAILY[tool].length;
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
      const a = all[i], b = all[j], d = deltaE(colour(a), colour(b));
      // the same finish needs a clear colour difference; a different finish (matte vs gloss vs shimmer) a smaller one
      const need = finish(a) === finish(b) ? 8 : 4;
      if (d < need) bad.push(`${a.id} vs ${b.id}: ${d.toFixed(1)} < ${need}`);
    }
    for (const c of DAILY[tool]) assert.ok(colourById(c.id).daily && colourById(c.id).target === tool, c.id);
  }
  assert.deepEqual(bad, []);
  console.log(`  ${total} colours of the day`);
});

test('tools: fixed constants, no size or strength settings', () => {
  assert.deepEqual(Object.keys(TOOLS).sort(), ['brush', 'lip', 'mascara', 'pencil']);
  assert.deepEqual([...SURFACE_TOOLS].sort(), ['brush', 'lip', 'pencil']);
  for (const t of SURFACE_TOOLS) assert.ok(falloff(TOOLS[t].edge, 0) > 0.99 && falloff(TOOLS[t].edge, 1) === 0);
  // the brush is the widest, the pencil the finest
  assert.ok(TOOLS.brush.radius > TOOLS.lip.radius && TOOLS.lip.radius > TOOLS.pencil.radius);
});

test('dab walker: even spacing that does not depend on how the path is sampled', () => {
  for (const tool of SURFACE_TOOLS) {
    const step = TOOLS[tool].radius * TOOLS[tool].spacing;
    const a = [0.1, -0.3, 0.6], b = [0.5, -0.2, 0.55];
    const run = (pts) => { const w = new DabWalker(tool); return pts.flatMap((p) => w.add(p)); };
    const coarse = run([a, b]), fine = run(line(a, b, 97));
    assert.equal(coarse.length, fine.length, tool);
    coarse.forEach((d, i) => d.forEach((v, c) => close(v, fine[i][c], 1e-9, `${tool} dab ${i}`)));
    for (let i = 1; i < fine.length; i++) close(Math.hypot(...fine[i].map((v, c) => v - fine[i - 1][c])), step, 1e-9, `${tool} spacing`);
  }
});

test('dab walker: a lifted pen starts a new segment with its own dab', () => {
  const w = new DabWalker('pencil');
  assert.equal(w.add([0, 0, 0]).length, 1);
  w.lift();
  assert.deepEqual(w.add([1, 0, 0]), [[1, 0, 0]]);
});

test('one pass leaves the tool\'s pass opacity; passes build up but never exceed the colour', () => {
  for (const tool of SURFACE_TOOLS) {
    const w = new DabWalker(tool), r = TOOLS[tool].radius;
    const dabs = line([-20 * r, 0, 0], [20 * r, 0, 0], 400).flatMap((p) => w.add(p));
    const step = r * TOOLS[tool].spacing;
    // on a dab and half-way between two dabs, in the middle of a long stroke
    close(coverage(tool, dabs, [0, 0, 0]), TOOLS[tool].pass, 0.03, `${tool} on a dab`);
    close(coverage(tool, dabs, [step / 2, 0, 0]), TOOLS[tool].pass, 0.03, `${tool} between dabs`);
    // the edge is softer than the middle
    assert.ok(coverage(tool, dabs, [0, 0.7 * r, 0]) < coverage(tool, dabs, [0, 0, 0]));
    const passes = [1, 2, 4, 8].map((k) => coverage(tool, Array.from({ length: k }, () => dabs).flat(), [0, 0, 0]));
    for (let i = 1; i < passes.length; i++) assert.ok(passes[i] > passes[i - 1] && passes[i] < 1, `${tool} builds up`);
  }
  // a sheer colour builds more slowly
  const w = new DabWalker('lip'), dabs = line([-1, 0, 0], [1, 0, 0], 100).flatMap((p) => w.add(p));
  assert.ok(coverage('lip', dabs, [0, 0, 0], colourById('lip-clear-gloss').sheer) < 0.5 * TOOLS.lip.pass);
});

test('stroke painter: live painting and replay of the saved stroke place the same dabs', () => {
  for (const tool of SURFACE_TOOLS) {
    const colour = PALETTE[tool][2].id;
    const segs = [line([0.2, -0.4, 0.55], [0.45, -0.5, 0.5], 37), line([-0.3, -0.4, 0.55], [-0.2, -0.6, 0.6], 11)]
      .map((pts) => pts.flatMap((p) => p.map(toQ)));
    const live = recorder(), painter = new StrokePainter(live, tool, colour);
    for (const seg of segs) {
      painter.lift();
      for (let i = 0; i < seg.length; i += 3) painter.add(seg.slice(i, i + 3));
    }
    const replay = recorder();
    StrokePainter.replay(replay, { tool, colour, segments: segs });
    assert.ok(live.dabs.length > 10);
    assert.deepEqual(replay.dabs, live.dabs);
  }
});

test('makeup state: strokes validated, stored as copies, input never mutated', () => {
  const m0 = createMakeup();
  const good = { tool: 'brush', colour: 'brush-rose', segments: [[1, 2, 3, 4, 5, 6]] };
  const m1 = addStroke(m0, good);
  assert.equal(m0.strokes.length, 0);
  assert.equal(m1.strokes.length, 1);
  good.segments[0][0] = 99;
  assert.equal(m1.strokes[0].segments[0][0], 1);
  const bad = [
    { tool: 'brush', colour: 'lip-red', segments: [[1, 2, 3]] }, // colour of another tool
    { tool: 'eraser', colour: 'brush-rose', segments: [[1, 2, 3]] },
    { tool: 'brush', colour: 'brush-nope', segments: [[1, 2, 3]] },
    { tool: 'brush', colour: 'brush-rose', segments: [] },
    { tool: 'brush', colour: 'brush-rose', segments: [[]] },
    { tool: 'brush', colour: 'brush-rose', segments: [[1, 2]] }, // skin points are x, y, z
    { tool: 'mascara', colour: 'mascara-black', segments: [[1, 2, 3]] }, // wand points are x, y
    { tool: 'brush', colour: 'brush-rose', segments: [[1, 2, 3.5]] },
    { tool: 'brush', colour: 'brush-rose', segments: [[1, 2, NaN]] },
    { tool: 'brush', colour: 'brush-rose', segments: [[1, 2, LIMITS.coord + 1]] },
    { tool: 'brush', colour: 'brush-rose', segments: Array.from({ length: LIMITS.segments + 1 }, () => [0, 0, 0]) },
    { tool: 'brush', colour: 'brush-rose', segments: [new Array((LIMITS.pointsPerStroke + 1) * 3).fill(0)] },
    null, 'brush',
  ];
  for (const s of bad) { assert.equal(validStroke(s), false, JSON.stringify(s)?.slice(0, 80)); assert.equal(addStroke(m1, s), m1); }
  assert.ok(validStroke({ tool: 'mascara', colour: 'mascara-navy', segments: [[1, 2, 3, 4]] }));
  // the state is full: further strokes are refused, never silently dropping old work
  const full = { ...m1, strokes: new Array(LIMITS.strokes).fill(m1.strokes[0]) };
  assert.equal(addStroke(full, { tool: 'brush', colour: 'brush-rose', segments: [[0, 0, 0]] }), full);
  const big = { tool: 'pencil', colour: 'pencil-black', segments: [new Array(LIMITS.pointsPerStroke * 3).fill(0)] };
  let m = createMakeup();
  while (addStroke(m, big) !== m) m = addStroke(m, big);
  assert.ok(pointCount(m) <= LIMITS.points && pointCount(m) + LIMITS.pointsPerStroke > LIMITS.points);
  assert.ok(validMakeup(m));
  assert.equal(validMakeup({ ...m, strokes: [...m.strokes, big] }), false);
});

test('makeup state: saved data round-trips and malformed data is rejected', () => {
  let m = addStroke(createMakeup(), { tool: 'lip', colour: 'lip-red-gloss', segments: [[toQ(0.1), toQ(-0.6), toQ(0.55)]] });
  m = setLens(m, 'left', 'lens-violet');
  const copy = JSON.parse(JSON.stringify(m));
  assert.ok(validMakeup(copy));
  assert.deepEqual(copy, m);
  assert.equal(validMakeup({ ...copy, version: 2 }), false);
  assert.equal(validMakeup({ ...copy, lenses: { left: 'lens-nope', right: null } }), false);
  assert.equal(validMakeup({ ...copy, lenses: { left: 'brush-rose', right: null } }), false);
  assert.equal(validMakeup({ ...copy, strokes: [{ tool: 'brush' }] }), false);
  assert.equal(validMakeup(null), false);
  assert.equal(Q, 1024);
});

// The applicator's pointer handling without a GPU: the picker maps canvas pixels onto a curved surface at the
// game's framing (185 px per decimetre), and dabs are recorded instead of drawn.
const PX = 185;
function fakeApplicator() {
  const a = Object.create(Applicator.prototype);
  const at = (x, y) => [(x - 200) / PX, -(y - 300) / PX];
  a.picker = {
    pick: (x, y) => (x < 0 ? null : { kind: 'skin', ref: [...at(x, y), 0.5 - 0.3 * at(x, y)[0] ** 2] }),
    onPlane: (x, y) => (x < 0 ? null : at(x, y)),
  };
  a.paint = recorder();
  a.view = { lashes: { zPlane: 0.5, coat: (wand, colour, t, touched) => { touched.add(0); return true; } } };
  a.makeup = createMakeup();
  a.allowed = () => true;
  return a;
}
// a wandering pointer path of `length` decimetres, reported every few pixels
function drag(a, tool, colour, length, rng, from = [200, 300]) {
  const g = a.begin(tool, colour);
  let [x, y] = from, dir = rng.next() * 6.283;
  for (let d = 0; d < length * PX; ) {
    const step = 3 + rng.next() * 6;
    dir += (rng.next() - 0.5) * 0.5;
    x += Math.cos(dir) * step; y += Math.sin(dir) * step; d += step;
    a.move(g, x, y);
  }
  return a.end(g);
}

test('applicator: stored points are a tool step apart, the stroke ends where the pointer did, live = replay', () => {
  for (const tool of SURFACE_TOOLS) {
    const a = fakeApplicator(), colour = PALETTE[tool][0].id, g = a.begin(tool, colour);
    for (let x = 100; x <= 300; x += 1) a.move(g, x, 300 + 20 * Math.sin(x / 15));
    const stroke = a.end(g), seg = stroke.segments[0], step = TOOLS[tool].step * Q;
    for (let i = 3; i < seg.length - 3; i += 3) assert.ok(Math.hypot(seg[i] - seg[i - 3], seg[i + 1] - seg[i - 2], seg[i + 2] - seg[i - 1]) >= step);
    assert.deepEqual(seg.slice(-3), [300, -300 - 20 * Math.sin(20), 0.5 - 0.3 * (100 / PX) ** 2].map((v, i) => (i === 0 ? toQ(100 / PX) : toQ(i === 1 ? (300 - (300 + 20 * Math.sin(20))) / PX : v))));
    const replay = recorder();
    StrokePainter.replay(replay, stroke);
    assert.deepEqual(replay.dabs, a.paint.dabs, tool);
  }
});

test('applicator: leaving the face lifts the pen; coming back starts a new segment', () => {
  const a = fakeApplicator(), g = a.begin('pencil', 'pencil-black');
  for (const x of [50, 60, 70, -1, -1, 80, 90]) a.move(g, x, 300); // the move from 70 to -1 crosses 0..69
  const s = a.end(g);
  assert.equal(s.segments.length, 2);
  // within one interpolation step (2 px) of the face's edge at x = 0
  const edge = toQ(-200 / PX), px = (2 / PX) * Q;
  assert.ok(Math.abs(s.segments[0][s.segments[0].length - 3] - edge) <= px, 'the first segment runs to the face edge');
  assert.ok(Math.abs(s.segments[1][0] - edge) <= px, 'the second starts where the pointer came back');
  assert.equal(a.end(a.begin('brush', 'brush-rose')), null, 'a gesture that never touched the face stores nothing');
  // a colour the player may not use yet (a colour of the day not earned) does not apply
  a.allowed = (id) => id !== 'brush-neon-pink';
  assert.equal(a.begin('brush', 'brush-neon-pink'), null);
  assert.ok(a.begin('brush', 'brush-rose'));
  a.allowed = () => true;
  // a mascara wand that coats no lash is no work
  a.view.lashes.coat = () => false;
  const w = a.begin('mascara', 'mascara-black');
  for (let x = 100; x < 200; x += 5) a.move(w, x, 300);
  assert.equal(a.end(w), null);
  // skin under the outfit takes no paint
  a.view.garment = { covers: (r) => r[1] < -0.3 };
  const b = a.begin('brush', 'brush-rose');
  for (let y = 300; y < 400; y += 2) a.move(b, 200, y);
  const s2 = a.end(b);
  assert.ok(s2.segments.flat().every((v, i) => i % 3 !== 1 || v >= toQ(-0.3)), 'nothing stored under the outfit');
});

test('saved form: compact, lossless, and malformed saves are refused', () => {
  const rng = createRng(7), a = fakeApplicator();
  const colours = Object.fromEntries(TOOL_IDS.map((t) => [t, PALETTE[t].map((c) => c.id)]));
  for (let i = 0; i < 40; i++) {
    const tool = TOOL_IDS[i % 4];
    drag(a, tool, colours[tool][i % colours[tool].length], 0.1 + rng.next() * 0.5, rng, [200 + rng.gauss(30), 300 + rng.gauss(30)]);
  }
  a.makeup = setLens(a.makeup, 'left', 'lens-honey');
  const text = encodeMakeup(a.makeup);
  assert.deepEqual(decodeMakeup(text), a.makeup);
  assert.equal(decodeMakeup(encodeMakeup(createMakeup())).strokes.length, 0);
  // corrupted saves never throw and never yield an invalid state
  for (let i = 0; i < 2000; i++) {
    const at = Math.floor(rng.next() * text.length);
    const bad = rng.next() < 0.5 ? text.slice(0, at) + text.slice(at + 1) : text.slice(0, at) + 'A_:z"]'[Math.floor(rng.next() * 6)] + text.slice(at + 1);
    const d = decodeMakeup(bad);
    assert.ok(d === null || validMakeup(d));
  }
  for (const bad of ['', 'null', '{}', '{"v":1,"l":[null,null],"s":["brush-rose:"]}', '{"v":1,"l":[null,null],"s":["brush-nope:CGAAAA"]}',
    '{"v":1,"l":[null,null],"s":["lens-blue:CGAAAA"]}', '{"v":2,"l":[null,null],"s":[]}', '{"v":1,"l":["lens-nope",null],"s":[]}']) assert.equal(decodeMakeup(bad), null, bad);
});

// A maximum-work session: 400 strokes and 140 dm of path (a full look several times over: blush, contour,
// shadow, brows, liner, lips, mascara and face art), drawn through the real sampling code.
export const MAX_SESSION = { brush: [160, 0.45], pencil: [140, 0.2], lip: [60, 0.5], mascara: [40, 0.25] };
test('a maximum-work session fits the 64 KiB save target', () => {
  const rng = createRng(2026), a = fakeApplicator();
  let path = 0;
  for (const [tool, [count, length]] of Object.entries(MAX_SESSION)) {
    for (let i = 0; i < count; i++) {
      const s = drag(a, tool, PALETTE[tool][i % PALETTE[tool].length].id, length * (0.6 + 0.8 * rng.next()), rng, [200 + rng.gauss(40), 300 + rng.gauss(50)]);
      assert.ok(s);
      path += length;
    }
  }
  a.makeup = setLens(setLens(a.makeup, 'left', 'lens-violet'), 'right', 'lens-aqua');
  const bytes = Buffer.byteLength(encodeMakeup(a.makeup), 'utf8');
  const points = a.makeup.strokes.reduce((n, s) => n + s.segments.reduce((k, seg) => k + seg.length / (s.tool === 'mascara' ? 2 : 3), 0), 0);
  console.log(`  ${a.makeup.strokes.length} strokes, about ${Math.round(path)} dm, ${points} points: ${bytes} bytes saved`);
  assert.ok(bytes < 65536, `${bytes} bytes`);
});

test('lenses and the completion predicate', () => {
  const m0 = createMakeup();
  assert.equal(isChanged(m0, 'brown'), false);
  assert.equal(setLens(m0, 'middle', 'lens-blue'), m0);
  assert.equal(setLens(m0, 'left', 'brush-rose'), m0);
  const m1 = setLens(m0, 'right', 'lens-blue');
  assert.deepEqual(m0.lenses, { left: null, right: null });
  assert.deepEqual(m1.lenses, { left: null, right: 'lens-blue' });
  assert.equal(setLens(m1, 'right', 'lens-blue'), m1);
  // a lens showing the face's own iris colour is not a change; a different one is
  assert.equal(isChanged(m1, 'blue'), false);
  assert.equal(isChanged(m1, 'brown'), true);
  assert.equal(isChanged(setLens(m0, 'left', 'lens-brown'), 'brown'), false);
  assert.ok(Object.keys(IRIS).length);
  assert.equal(isChanged(addStroke(m0, { tool: 'pencil', colour: 'pencil-black', segments: [[0, 0, 0]] }), 'brown'), true);
});

// a real generated face, as the game shows it
const head = readHead();
const hg = new HeadGeometry(head);
const face = generateFace(5);
hg.setShape(face.shape);
const camera = new GL.PerspectiveCamera(CAMERA.fov, 3 / 4, 0.5, 60);
camera.position.copy(CAMERA.target).add(new GL.Vector3(0, 0, CAMERA.distance));
camera.lookAt(CAMERA.target);
camera.updateMatrixWorld?.();
const eyes = new Eyes();
eyes.place(hg, camera.position);
const centres = { left: eyes.meshes[0].position, right: eyes.meshes[1].position };

test('mascara: each stroke coats a touched lash once; length and thickness stop at their caps', () => {
  const lashes = new Lashes(head);
  lashes.build(face.lashes, hg, centres);
  const t = TOOLS.mascara, black = hexToLinear(colourById('mascara-black').hex);
  const natural = lashes.lashes.map((l) => ({ colour: l.colour.slice(), lengthMul: l.lengthMul, widthMul: l.widthMul }));
  // a wand stroke along the whole upper left lash line, in the lashes' plane
  const upper = lashes.paths.map((p, i) => ({ p, l: lashes.lashes[i] })).filter(({ l }) => l.eye === 'left' && l.row === 'upper');
  const tips = upper.map(({ p }) => p[Math.floor(p.length / 2)]).sort((a, b) => a[0] - b[0]);
  const wand = tips.flatMap((p) => [p[0], p[1]]);
  const touched = new Set();
  assert.ok(lashes.coat(wand, black, t, touched));
  const once = lashes.lashes.map((l) => l.lengthMul);
  assert.equal(lashes.coat(wand, black, t, touched), false, 'the same stroke does not coat again');
  assert.deepEqual(lashes.lashes.map((l) => l.lengthMul), once);
  const coated = [...touched];
  assert.ok(coated.length >= upper.length * 0.8, `${coated.length} of ${upper.length} upper lashes`);
  assert.ok(coated.every((i) => lashes.lashes[i].eye === 'left'), 'the other eye is untouched');
  // many more strokes: capped, and the colour converges on the mascara
  for (let k = 0; k < 30; k++) lashes.coat(wand, black, t, new Set());
  for (const i of coated) {
    const l = lashes.lashes[i], n0 = natural[i];
    close(l.lengthMul, n0.lengthMul * t.lengthMax, 1e-9, 'length cap');
    close(l.widthMul, t.widthMax, 1e-9, 'width cap');
    l.colour.forEach((c, a) => close(c, black[a], 1e-3, 'colour'));
  }
  assert.ok(lashes.paths.flat(2).every(Number.isFinite));
  lashes.resetCoats();
  assert.deepEqual(lashes.lashes.map((l) => ({ colour: l.colour, lengthMul: l.lengthMul, widthMul: l.widthMul })), natural);
});

test('picker: a projected skin point picks itself; the iris and the eye white are told apart', () => {
  const picker = new Picker();
  picker.update(hg, eyes, camera, 600, 800);
  const P = hg.geometry.attributes.position.array, R = hg.geometry.attributes.ref.array;
  // vertices on the front of the face: the pick is the vertex itself unless something nearer covers it
  const depth = (p) => CAMERA.distance - (p[2] - CAMERA.target[2]);
  let checked = 0, itself = 0;
  for (let i = 0; i < P.length / 3; i += 3) {
    const p = [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]];
    if (p[2] < 0.35 || Math.abs(p[0]) > 0.5 || p[1] < -1 || p[1] > 0.7) continue;
    const hit = picker.pick(...picker.project(p));
    if (hit?.kind !== 'skin') continue; // an eyeball in front of this vertex
    checked++;
    assert.ok(hit.depth <= depth(p) + 1e-3, `vertex ${i}: the pick is never behind the vertex`);
    if (hit.depth < depth(p) - 1e-3) continue; // covered (a lid fold, the nostril rim)
    itself++;
    for (let c = 0; c < 3; c++) close(hit.ref[c], R[i * 3 + c], 0.005, `vertex ${i} ref`);
  }
  assert.ok(checked >= 150 && itself >= 0.9 * checked, `${itself} of ${checked} skin points`);
  for (const [k, eye] of [[0, 'left'], [1, 'right']]) {
    const m = eyes.meshes[k], c = m.position, r = m.scale[0];
    const front = picker.project([c[0], c[1], c[2] + r]);
    assert.deepEqual(picker.pick(...front), { kind: 'eye', eye, iris: true });
    // a point on the eyeball towards the outer corner is white, not iris
    const out = Math.sign(c[0]) * 0.75;
    const white = picker.pick(...picker.project([c[0] + out * r, c[1], c[2] + r * Math.sqrt(1 - out * out)]));
    assert.deepEqual(white, { kind: 'eye', eye, iris: false });
  }
  // outside the canvas, nothing
  assert.equal(picker.pick(-5, 10), null);
  assert.equal(picker.onPlane(10, 900, 0.5), null);
});

console.log(`${n} makeup checks passed`);
