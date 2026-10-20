// Loads assets/head.bin.gz (built by tools/makehuman/build-head.mjs) and turns a set of shape-dimension
// values into vertex positions.
import { gunzipSync } from 'fflate';

const TYPES = { Uint16Array, Int16Array, Uint8Array, Int8Array };

// gzip -> ArrayBuffer: the browser's own decompressor where available (Chrome 80+, Safari 16.4+),
// otherwise fflate's small inflater (about 4 KB)
export async function inflate(buffer) {
  if (typeof DecompressionStream === 'function') {
    const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).arrayBuffer();
  }
  const out = gunzipSync(new Uint8Array(buffer));
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
}
// onProgress (optional): called with the fraction downloaded (0 to 1), for a loading screen. The size comes from the
// server, or else `size` (the file's size, known when the game is built); where a server compresses it on the way, it
// never claims more than it knows
export async function loadHead(url, onProgress, size = 0) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`head asset: HTTP ${res.status}`);
  const total = +res.headers.get('content-length') || size;
  if (!onProgress || !res.body?.getReader || !total) return parseHead(await inflate(await res.arrayBuffer()));
  const reader = res.body.getReader(), parts = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value); got += value.length;
    onProgress(Math.min(got / total, 0.99));
  }
  const bytes = new Uint8Array(got);
  let at = 0;
  for (const p of parts) { bytes.set(p, at); at += p.length; }
  onProgress(1);
  return parseHead(await inflate(bytes.buffer));
}

// undo the build's predictive coding: each value was stored minus the one `stride` before it
function undelta(arr, stride) {
  for (let i = stride; i < arr.length; i++) arr[i] += arr[i - stride];
  return arr;
}
function readVarints(bytes, count) {
  const out = new Uint32Array(count);
  let p = 0, prev = -1;
  for (let j = 0; j < count; j++) {
    let v = 0, shift = 0, b;
    do { b = bytes[p++]; v |= (b & 0x7f) << shift; shift += 7; } while (b & 0x80);
    out[j] = prev = prev + 1 + v;
  }
  return out;
}

export function parseHead(buffer) {
  const bytes = new Uint8Array(buffer);
  if (String.fromCharCode(...bytes.subarray(0, 4)) !== 'MKHD') throw new Error('not a head asset');
  const jsonLength = new DataView(buffer).getUint32(4, true);
  const header = JSON.parse(new TextDecoder().decode(bytes.subarray(8, 8 + jsonLength)));
  if (header.format !== 'makeup-head' || header.version !== 2) throw new Error('unsupported head asset version');
  const pre = 8 + ((jsonLength + 3) & ~3);
  const arrays = header.sections.map((s) => {
    const T = TYPES[s.type];
    const a = new T(buffer.slice(pre + s.offset, pre + s.offset + s.length * T.BYTES_PER_ELEMENT));
    return s.stride ? undelta(a, s.stride) : a;
  });
  const section = (name) => arrays[header.sections.findIndex((s) => s.name === name)];

  const q = section('positions'), positions = new Float32Array(q.length);
  for (let i = 0; i < q.length; i++) {
    const a = i % 3;
    positions[i] = header.posMin[a] + ((q[i] + 32768) / 65535) * (header.posMax[a] - header.posMin[a]);
  }
  const nc = header.regionChannels.length, qr = section('regions'), regions = new Float32Array(qr.length);
  for (let i = 0; i < qr.length; i++) {
    const c = i % nc;
    regions[i] = header.regMin[c] + (qr[i] / 255) * (header.regMax[c] - header.regMin[c]);
  }
  const dims = new Map();
  for (const d of header.dims) {
    const side = (s) => {
      if (!s) return null;
      const raw = arrays[s.delta], delta = new Float32Array(raw.length);
      for (let i = 0; i < raw.length; i++) delta[i] = raw[i] * s.scale;
      return { idx: readVarints(arrays[s.idx], s.count), delta, shift: s.shift };
    };
    dims.set(d.id, { plus: side(d.plus), minus: side(d.minus) });
  }
  const helpers = {};
  for (const [name, h] of Object.entries(header.helpers)) helpers[name] = { start: h.start, count: h.count, quads: arrays[h.quads] };
  return {
    header,
    vertexCount: header.vertexCount,
    headVertexCount: header.headVertexCount,
    positions,
    quadV: section('quadV'),
    quadT: section('quadT'),
    uvs: section('uvs'),
    regions,
    regionChannels: header.regionChannels,
    helpers,
    dims,
  };
}

// positions for one face: reference + sum of weighted sparse deltas, minus each dimension's whole-head
// shift (so the head stays anchored in the camera frame)
export function morph(head, values, out = new Float32Array(head.positions.length)) {
  out.set(head.positions);
  const shift = [0, 0, 0];
  for (const [id, value] of Object.entries(values)) {
    if (!value) continue;
    const dim = head.dims.get(id);
    if (!dim) continue;
    const side = value > 0 ? dim.plus : dim.minus;
    if (!side) continue;
    const w = Math.abs(value);
    for (let a = 0; a < 3; a++) shift[a] += w * side.shift[a];
    const { idx, delta } = side;
    for (let j = 0; j < idx.length; j++) {
      const i = idx[j] * 3;
      out[i] += w * delta[j * 3];
      out[i + 1] += w * delta[j * 3 + 1];
      out[i + 2] += w * delta[j * 3 + 2];
    }
  }
  if (shift[0] || shift[1] || shift[2]) for (let i = 0; i < out.length; i += 3) { out[i] -= shift[0]; out[i + 1] -= shift[1]; out[i + 2] -= shift[2]; }
  return out;
}
