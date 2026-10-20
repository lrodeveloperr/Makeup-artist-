// Reads the pinned MakeHuman checkout: the hm08 base mesh and its .target files.
// Only CC0 assets bundled with MakeHuman are read (see ASSETS.md); no MakeHuman program code is used.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const MAKEHUMAN_REPO = 'https://github.com/makehumancommunity/makehuman';
export const MAKEHUMAN_COMMIT = 'a8bc2d54ff0ac92e78ff71431b1023eda42bf482';
export const DEFAULT_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../.cache/makehuman');

export function openSource(root = process.env.MAKEHUMAN_DIR || DEFAULT_ROOT) {
  const data = path.join(root, 'makehuman/data');
  if (!fs.existsSync(path.join(data, '3dobjs/base.obj'))) {
    throw new Error(`MakeHuman data not found under ${root}. Run: node tools/makehuman/fetch.mjs`);
  }
  const used = new Map(); // relative path -> sha256, recorded in the asset header
  const read = (rel) => {
    const buf = fs.readFileSync(path.join(data, rel));
    used.set('makehuman/data/' + rel, crypto.createHash('sha256').update(buf).digest('hex'));
    return buf.toString('utf8');
  };
  return { root, data, read, used };
}

// base.obj: vertices, texture coordinates and faces with their group names
export function parseObj(text) {
  const V = [], VT = [], F = [];
  let group = '';
  for (const line of text.split('\n')) {
    const p = line.trim().split(/\s+/);
    if (p[0] === 'v') V.push([+p[1], +p[2], +p[3]]);
    else if (p[0] === 'vt') VT.push([+p[1], +p[2]]);
    else if (p[0] === 'g') group = p[1];
    else if (p[0] === 'f') {
      const c = p.slice(1).map((s) => s.split('/').map((n) => +n - 1));
      F.push({ group, v: c.map((x) => x[0]), t: c.map((x) => x[1]) });
    }
  }
  return { V, VT, F };
}

// .target: "index dx dy dz" per moved vertex
export function parseTarget(text) {
  const idx = [], d = [];
  for (const line of text.split('\n')) {
    if (!line || line[0] === '#') continue;
    const p = line.trim().split(/\s+/);
    if (p.length < 4) continue;
    idx.push(+p[0]);
    d.push(+p[1], +p[2], +p[3]);
  }
  return { idx, d };
}
