// Parses assets/head.bin (built by tools/makehuman/build-head.mjs) and turns a set of shape-dimension
// values into vertex positions.
const TYPES = { Float32Array, Uint16Array, Int16Array, Uint32Array, Uint8Array };

export function parseHead(buffer) {
  const bytes = new Uint8Array(buffer);
  if (String.fromCharCode(...bytes.subarray(0, 4)) !== 'MKHD') throw new Error('not a head asset');
  const jsonLength = new DataView(buffer).getUint32(4, true);
  const header = JSON.parse(new TextDecoder().decode(bytes.subarray(8, 8 + jsonLength)));
  if (header.format !== 'makeup-head' || header.version !== 1) throw new Error('unsupported head asset version');
  const pre = 8 + ((jsonLength + 3) & ~3);
  const arrays = header.sections.map((s) => {
    const T = TYPES[s.type];
    // copy so every array is aligned and independent of the download buffer
    return new T(buffer.slice(pre + s.offset, pre + s.offset + s.length * T.BYTES_PER_ELEMENT));
  });
  const section = (name) => arrays[header.sections.findIndex((s) => s.name === name)];
  const dims = new Map();
  for (const d of header.dims) {
    const side = (s) => s && { idx: arrays[s.idx], delta: arrays[s.delta], scale: s.scale };
    dims.set(d.id, { plus: side(d.plus), minus: side(d.minus) });
  }
  const helpers = {};
  for (const [name, h] of Object.entries(header.helpers)) helpers[name] = { start: h.start, count: h.count, quads: arrays[h.quads] };
  return {
    header,
    vertexCount: header.vertexCount,
    headVertexCount: header.headVertexCount,
    positions: section('positions'),
    quadV: section('quadV'),
    quadT: section('quadT'),
    uvs: section('uvs'),
    regions: section('regions'),
    regionChannels: header.regionChannels,
    helpers,
    dims,
  };
}

// positions for one face: reference + sum of weighted sparse deltas
export function morph(head, values, out = new Float32Array(head.positions.length)) {
  out.set(head.positions);
  for (const [id, value] of Object.entries(values)) {
    if (!value) continue;
    const dim = head.dims.get(id);
    if (!dim) continue;
    const side = value > 0 ? dim.plus : dim.minus;
    if (!side) continue;
    const w = Math.abs(value) * side.scale;
    const { idx, delta } = side;
    for (let j = 0; j < idx.length; j++) {
      const i = idx[j] * 3;
      out[i] += w * delta[j * 3];
      out[i + 1] += w * delta[j * 3 + 1];
      out[i + 2] += w * delta[j * 3 + 2];
    }
  }
  return out;
}
