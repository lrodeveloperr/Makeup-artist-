// Fast checks without a browser: asset integrity, deterministic generation, queue behaviour.
// Usage: node tests/unit.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { parseHead, morph } from '../src/face/head-data.js';
import { HeadGeometry } from '../src/face/head-geometry.js';
import { generateFace, signature, SHAPE_DIMS } from '../src/face/generator.js';
import { createQueueState, nextFace } from '../src/face/queue.js';
import { lidMargins } from '../src/face/lashes.js';
import { DIMS } from '../tools/makehuman/dims.mjs';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };
const buf = fs.readFileSync(new URL('../assets/head.bin', import.meta.url));
const head = parseHead(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));

test('head asset: provenance is the pinned CC0 MakeHuman commit', () => {
  assert.equal(head.header.source.license, 'CC0-1.0');
  assert.equal(head.header.source.commit, 'a8bc2d54ff0ac92e78ff71431b1023eda42bf482');
  assert.ok(Object.keys(head.header.source.files).length > 100);
});
test('head asset: every generator dimension exists, and every built dimension is listed', () => {
  for (const id of SHAPE_DIMS) assert.ok(head.dims.has(id), id);
  assert.deepEqual([...head.dims.keys()].sort(), DIMS.map((d) => d.id).sort());
});
test('morph: neutral is the reference, values are additive and anchored', () => {
  const P0 = morph(head, {});
  assert.deepEqual(P0, head.positions);
  const P1 = morph(head, { gender: 1 });
  let maxShift = 0;
  for (let i = 0; i < P0.length; i++) maxShift = Math.max(maxShift, Math.abs(P1[i] - P0[i]));
  assert.ok(maxShift > 0.05 && maxShift < 0.6, `gender changes the shape (${maxShift})`);
});
test('head geometry: subdivided mesh has finite positions for random faces', () => {
  const hg = new HeadGeometry(head);
  for (let s = 1; s <= 20; s++) {
    hg.setShape(generateFace(s).shape);
    assert.ok(hg.geometry.attributes.position.array.every(Number.isFinite));
  }
});
test('lash roots: four root lines ordered inner to outer corner', () => {
  const m = lidMargins(head);
  for (const eye of ['left', 'right']) for (const row of ['upper', 'lower']) {
    const ids = m[eye][row];
    assert.ok(ids.length >= 10);
    assert.ok(Math.abs(head.positions[ids[0] * 3]) < Math.abs(head.positions[ids[ids.length - 1] * 3]));
  }
});
test('generator: deterministic, plain JSON, young adults', () => {
  for (let s = 1; s <= 200; s++) {
    const a = generateFace(s), b = JSON.parse(JSON.stringify(generateFace(s)));
    assert.deepEqual(a, b);
    assert.ok(a.age >= 18 && a.age <= 30);
  }
});
test('generator: different seeds give different faces', () => {
  const sigs = new Set(Array.from({ length: 300 }, (_, i) => signature(generateFace(i + 1))));
  assert.ok(sigs.size > 280, `${sigs.size} distinct of 300`);
});
test('queue: deterministic, survives save/load, no immediate repeat', () => {
  let a = createQueueState(42), b = createQueueState(42), prev = null;
  for (let i = 0; i < 200; i++) {
    const ra = nextFace(a), rb = nextFace(JSON.parse(JSON.stringify(b)));
    assert.deepEqual(ra.face, rb.face);
    const sig = signature(ra.face);
    assert.notEqual(sig, prev);
    prev = sig; a = ra.state; b = rb.state;
  }
});
console.log(`${n} tests passed`);
