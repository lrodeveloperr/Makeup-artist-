// Face generator audit (contract CONTENT01): validates deterministic profiles, checks that every face keeps
// usable makeup targets, and reports coverage. Writes docs/FACE-AUDIT.md and docs/face-audit.json.
// Usage: node tests/face-audit.mjs [count=2000] [geometry sample=300]
import fs from 'node:fs';
import { readHead } from '../tools/read-head.mjs';
import { HeadGeometry } from '../src/face/head-geometry.js';
import { generateFace, signature, SHAPE_DIMS, GENERATOR_VERSION } from '../src/face/generator.js';
import { createQueueState, nextFace, heritageOf, ROTATION } from '../src/face/queue.js';
import { PROFILES } from '../src/face/profiles.js';
import { HAIR_STYLES } from '../src/face/hair-styles.js';
import { HAIR_COLOURS, IRIS, UNDERTONES } from '../src/face/colors.js';
import { lidMargins } from '../src/face/lashes.js';
import { GARMENT_COLOURS, PALETTES, NECKLINES, PATTERNS, colourInfo, skinInfo, nearSkin, tooDark, complexion } from '../src/face/outfit.js';

const N = +(process.argv[2] || 2000), GEO = +(process.argv[3] || 300);
const failures = [];
const fail = (seed, msg) => { if (failures.length < 50) failures.push(`seed ${seed}: ${msg}`); };
const count = (map, key) => map.set(key, (map.get(key) || 0) + 1);
const finite = (x) => typeof x === 'number' && Number.isFinite(x);

// ---------------- profile validity, determinism and coverage ----------------
const cov = { origin: new Map(), kind: new Map(), presentation: new Map(), style: new Map(), texture: new Map(), colour: new Map(),
  iris: new Map(), undertone: new Map(), tone: new Map(), brows: new Map(), age: new Map(),
  outfitColour: new Map(), pattern: new Map(), neckline: new Map(), garment: new Map() };
const byComplexion = {}; // complexion group -> Map(main outfit colour -> faces)
let freckles = 0, moles = 0, highlights = 0;
const sigs = new Set();
for (let seed = 1; seed <= N; seed++) {
  const f = generateFace(seed);
  if (JSON.stringify(f) !== JSON.stringify(generateFace(seed))) fail(seed, 'not deterministic');
  if (f.version !== GENERATOR_VERSION) fail(seed, 'version');
  for (const id of SHAPE_DIMS) if (!finite(f.shape[id]) || Math.abs(f.shape[id]) > 1) fail(seed, `shape ${id}=${f.shape[id]}`);
  const w = f.origin.parts.reduce((a, p) => a + p.weight, 0);
  if (Math.abs(w - 1) > 0.01 || f.origin.parts.some((p) => !PROFILES[p.id])) fail(seed, 'origin weights');
  if (!(f.skin.tone >= 0 && f.skin.tone <= 1) || !UNDERTONES[f.skin.undertone]) fail(seed, 'skin');
  if (!HAIR_STYLES[f.hair.style] || !HAIR_STYLES[f.hair.style].textures.includes(f.hair.texture)) fail(seed, `style ${f.hair.style} vs ${f.hair.texture}`);
  if (!HAIR_COLOURS[f.hair.colour] || !HAIR_COLOURS[f.hair.natural] || !HAIR_COLOURS[f.brows.colour] || !HAIR_COLOURS[f.lashes.colour]) fail(seed, 'colour');
  if (!IRIS[f.eyes.iris]) fail(seed, 'iris');
  if (f.age < 18 || f.age > 30) fail(seed, `age ${f.age}`);
  for (const m of f.skin.moles) {
    const [x, y] = m.at;
    if ((Math.abs(y) < 0.16 && Math.abs(x) > 0.08 && Math.abs(x) < 0.48) || (y > -0.78 && y < -0.48 && Math.abs(x) < 0.26)) fail(seed, 'mole on eye/lips');
  }
  const main = f.origin.parts.reduce((a, b) => (b.weight > a.weight ? b : a)).id;
  count(cov.origin, main); count(cov.kind, f.origin.kind); count(cov.presentation, f.presentation); count(cov.style, f.hair.style);
  count(cov.texture, f.hair.texture); count(cov.colour, f.hair.colour); count(cov.iris, f.eyes.iris); count(cov.undertone, f.skin.undertone);
  count(cov.tone, Math.min(9, Math.floor(f.skin.tone * 10))); count(cov.brows, f.brows.shape); count(cov.age, f.age);
  if (f.skin.freckles.density > 0) freckles++;
  if (f.skin.moles.length) moles++;
  if (f.hair.colour !== f.hair.natural) fail(seed, 'dyed hair');
  if (f.presentation !== 'feminine') fail(seed, 'not feminine');
  if (f.hair.highlights) highlights++;
  // outfit: catalogue values, colours from the complexion's palette, never dark on deeper skin, never close to the skin
  const o = f.outfit, group = complexion(f.skin.tone, f.skin.undertone);
  if (!NECKLINES[o.kind] || !NECKLINES[o.kind][o.neckline] || !PATTERNS[o.pattern]) fail(seed, `outfit ${o.kind}/${o.neckline}/${o.pattern}`);
  if (!o.names.length || o.names.some((n, i) => GARMENT_COLOURS[n] !== o.colours[i] || !PALETTES[group].includes(n))) fail(seed, `outfit colours ${o.names}`);
  if (o.names.some((n) => tooDark(colourInfo(n), f.skin.tone))) fail(seed, `dark outfit colour on deep skin (${o.names})`);
  if (nearSkin(colourInfo(o.names[0]), skinInfo(f.skin.tone, f.skin.undertone))) fail(seed, `outfit ${o.names[0]} too close to the skin`);
  count(cov.outfitColour, o.names[0]); count(cov.pattern, o.pattern); count(cov.neckline, o.neckline); count(cov.garment, o.kind);
  count(byComplexion[group] || (byComplexion[group] = new Map()), o.names[0]);
  sigs.add(signature(f));
}

// ---------------- queue: no adjacent repeats, variety between neighbours ----------------
let state = createQueueState(7), prev = null, adjacentSame = 0, sameStyle = 0, sameOrigin = 0, sameTone = 0, repeats4 = 0;
const order = [];
const recentSigs = [];
for (let i = 0; i < N; i++) {
  const r = nextFace(state);
  order.push(heritageOf(r.face));
  state = JSON.parse(JSON.stringify(r.state)); // the queue state must survive a save/load round trip
  const sig = signature(r.face), parts = sig.split('|');
  if (prev) {
    const p = prev.split('|');
    if (sig === prev) adjacentSame++;
    if (parts[2] === p[2]) sameStyle++;
    if (parts[0] === p[0]) sameOrigin++;
    if (parts[5] === p[5]) sameTone++;
  }
  if (recentSigs.includes(sig)) repeats4++;
  recentSigs.unshift(sig); recentSigs.length = Math.min(recentSigs.length, 4);
  prev = sig;
}
if (adjacentSame) failures.push(`queue: ${adjacentSame} adjacent identical faces`);
// every run of ROTATION faces meets every heritage
let rotationMisses = 0;
for (let w = 0; w + ROTATION <= order.length; w += ROTATION) {
  const seen = new Set(order.slice(w, w + ROTATION));
  for (const id of Object.keys(PROFILES)) if (!seen.has(id)) rotationMisses++;
}
if (rotationMisses) failures.push(`queue: ${rotationMisses} heritages missing from a ${ROTATION}-face rotation`);

// ---------------- geometry: every face keeps usable makeup targets ----------------
const head = readHead();
const hg = new HeadGeometry(head);
const margins = lidMargins(head);
const geo = { eyeR: [], lidGap: [], mouthW: [], top: [], chin: [] };
const stat = (a) => { const s = [...a].sort((x, y) => x - y); return { min: s[0], p5: s[Math.floor(s.length * 0.05)], median: s[Math.floor(s.length / 2)], p95: s[Math.floor(s.length * 0.95)], max: s[s.length - 1] }; };
for (let seed = 1; seed <= GEO; seed++) {
  const f = generateFace(seed);
  const P = hg.setShape(f.shape);
  if (P.some((x) => !Number.isFinite(x))) { fail(seed, 'non-finite vertex'); continue; }
  const L = hg.helperSphere('helper-l-eye'), R = hg.helperSphere('helper-r-eye');
  geo.eyeR.push(L.radius);
  if (Math.abs(L.radius - R.radius) > 1e-3 || Math.abs(L.center.x + R.center.x) > 1e-3) fail(seed, 'eyes not symmetric');
  // lid opening: distance between upper and lower lash root lines at mid-eye
  const mid = (ids) => ids[Math.floor(ids.length / 2)];
  const u = mid(margins.left.upper), l = mid(margins.left.lower);
  const gap = P[u * 3 + 1] - P[l * 3 + 1];
  geo.lidGap.push(gap);
  if (!(gap > 0.02)) fail(seed, `eye nearly closed (${gap.toFixed(3)})`);
  // mouth width from the lip-line landmarks moved with the face: use the widest lip vertices
  let mw = 0, top = -9, chin = 9;
  const ri = head.regionChannels.indexOf('lips'), nc = head.regionChannels.length;
  for (let k = 0; k < head.headVertexCount; k++) {
    if (head.regions[k * nc + ri] > 0.4) mw = Math.max(mw, Math.abs(P[k * 3]) * 2);
    top = Math.max(top, P[k * 3 + 1]);
    if (Math.abs(P[k * 3]) < 0.05 && P[k * 3 + 2] > 0) chin = Math.min(chin, P[k * 3 + 1]);
  }
  geo.mouthW.push(mw); geo.top.push(top); geo.chin.push(chin);
  if (!(mw > 0.22)) fail(seed, `mouth too small (${mw.toFixed(3)})`);
}

// ---------------- report ----------------
const pct = (n) => ((100 * n) / N).toFixed(1) + '%';
const table = (map, label, sort = true) => {
  const rows = [...map.entries()];
  if (sort) rows.sort((a, b) => b[1] - a[1]);
  return `| ${label} | faces | share |\n| --- | ---: | ---: |\n` + rows.map(([k, v]) => `| ${k} | ${v} | ${pct(v)} |`).join('\n');
};
const fmt = (o) => Object.entries(o).map(([k, v]) => `${k} ${v.toFixed(3)}`).join(', ');
const lowerBound = sigs.size;
const report = {
  generatorVersion: GENERATOR_VERSION, faces: N, geometrySample: GEO, failures,
  coverage: Object.fromEntries(Object.entries(cov).map(([k, m]) => [k, Object.fromEntries([...m.entries()].sort())])),
  rates: { freckles: freckles / N, moles: moles / N, highlights: highlights / N },
  distinctSignatures: lowerBound,
  queue: { adjacentIdentical: adjacentSame, adjacentSameStyle: sameStyle / (N - 1), adjacentSameOrigin: sameOrigin / (N - 1), adjacentSameToneBin: sameTone / (N - 1), repeatsWithinFour: repeats4 },
  geometry: Object.fromEntries(Object.entries(geo).map(([k, v]) => [k, stat(v)])),
};
const md = `# Face generator audit

Generated by \`node tests/face-audit.mjs ${N} ${GEO}\` (generator version ${GENERATOR_VERSION}). Do not edit by hand.

**Result: ${failures.length ? 'FAIL' : 'PASS'}** — ${N} deterministic profiles validated; ${GEO} morphed through the head asset for target checks.
${failures.length ? '\n' + failures.map((f) => '- ' + f).join('\n') + '\n' : ''}
## What is checked

- Every profile is deterministic (same seed → identical record), uses only catalogue values, keeps every shape value in [-1, 1], ages 18–30, and never places a beauty mark on the eyes or lips.
- Every face is feminine, with natural (undyed) hair in a long style from the catalogue that suits her natural hair texture.
- Every outfit uses catalogue values; its colours come from the palette for the face's complexion; deeper skin (tone ≥ 0.45) never wears very dark colours (black, navy, charcoal, burgundy, plum); and the main colour is never close to the skin's own colour.
- The queue (\`src/face/queue.js\`) never shows the same complete face twice in a row, meets every one of the ${Object.keys(PROFILES).length} heritages in every run of ${ROTATION} faces (plus mixed-heritage faces), and its state survives a JSON save/load.
- For the geometry sample: finite vertices, symmetric eyes, open eyelids (lash lines apart) and a usable mouth on every face.

## Variety

- Distinct face signatures (origin · presentation · hairstyle · hair colour · iris · tone band · brow shape · parting · outfit colour) seen in ${N} faces: **${lowerBound}**. This is a lower bound on visibly different configurations; it ignores the ${SHAPE_DIMS.length} continuous shape dimensions, freckles, marks and lip/brow detail that also differ per face. It is not a "millions of faces" claim.
- Queue neighbours: ${adjacentSame} identical, ${(100 * report.queue.adjacentSameStyle).toFixed(1)}% same hairstyle, ${(100 * report.queue.adjacentSameOrigin).toFixed(1)}% same main origin, ${(100 * report.queue.adjacentSameToneBin).toFixed(1)}% same skin-tone band; ${repeats4} signature repeats within four faces.
- Freckles ${pct(freckles)}, beauty marks ${pct(moles)}, subtle natural highlights ${pct(highlights)}. Every face has long, visible hair (no short cuts, updos or head coverings), and no vitiligo, albinism or dyed colours (owner decisions).

## Coverage

${table(cov.origin, 'Main origin profile')}

${table(cov.kind, 'Origin kind')}

${table(cov.presentation, 'Presentation')}

${table(new Map([...cov.tone.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => [`${k / 10}–${(k + 1) / 10}`, v])), 'Skin tone (0 fair – 1 deep)', false)}

${table(cov.undertone, 'Undertone')}

${table(cov.texture, 'Natural hair texture')}

${table(cov.style, 'Hairstyle')}

${table(cov.colour, 'Hair colour')}

${table(cov.iris, 'Iris')}

${table(cov.brows, 'Brow shape')}

${table(cov.garment, 'Garment')}

${table(cov.neckline, 'Neckline')}

${table(cov.pattern, 'Outfit pattern')}

| Complexion | faces | main outfit colours (most worn first) |
| --- | ---: | --- |
${Object.entries(byComplexion).sort().map(([g, m]) => `| ${g} | ${[...m.values()].reduce((a, b) => a + b, 0)} | ${[...m.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k).join(', ')} |`).join('\n')}

## Geometry (decimetres, ${GEO} faces)

- Eyeball radius: ${fmt(report.geometry.eyeR)}
- Lid opening at mid-eye: ${fmt(report.geometry.lidGap)}
- Mouth width: ${fmt(report.geometry.mouthW)}
- Head top above the eyes: ${fmt(report.geometry.top)}
- Chin below the eyes: ${fmt(report.geometry.chin)}
`;
fs.mkdirSync(new URL('../docs/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('../docs/FACE-AUDIT.md', import.meta.url), md);
fs.writeFileSync(new URL('../docs/face-audit.json', import.meta.url), JSON.stringify(report, null, 1) + '\n');
console.log(`${failures.length ? 'FAIL' : 'PASS'}: ${N} faces, ${lowerBound} distinct signatures, queue adjacent identical ${adjacentSame}`);
if (failures.length) { console.log(failures.join('\n')); process.exit(1); }
