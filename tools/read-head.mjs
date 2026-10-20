// Node helper: read and parse assets/head.bin.gz (the browser uses loadHead() in src/face/head-data.js).
import fs from 'node:fs';
import zlib from 'node:zlib';
import { parseHead } from '../src/face/head-data.js';

export function readHead(file = new URL('../assets/head.bin.gz', import.meta.url)) {
  const raw = zlib.gunzipSync(fs.readFileSync(file));
  return parseHead(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length));
}
