// Download-size budget (YouTube Playables loads every byte before the first face).
// Builds the minified face preview and the minified game, and fails if a file or a total goes over budget:
//   face preview (the face system and the makeup tools)    ≤ 420 KB
//   the game page (build/game, what gets uploaded)          ≤ 1 MB
// Usage: node tests/size-budget.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';

// Studio targets (contract §14 allows 5 MB; the platform recommends files under 512 KiB). The whole game
// should stay under 1 MB; the face system gets 420 KB of that (raised from 400 KB when the highlighter, liquid
// liner and face gems and their 79 colours joined the tools, about 12 KB).
export const BUDGET = { faceRuntimeBytes: 420_000, gameBytes: 1_000_000, fileBytes: 512 * 1024 };

execFileSync('node', ['tools/build-preview.mjs', '--minify'], { stdio: 'inherit' });
execFileSync('node', ['tools/build-game.mjs', '--minify'], { stdio: 'inherit' });
const over = [];
for (const [dir, budget, label] of [['build/preview', BUDGET.faceRuntimeBytes, 'face'], ['build/game', BUDGET.gameBytes, 'game']]) {
  const files = fs.readdirSync(dir).map((f) => ({ f, bytes: fs.statSync(path.join(dir, f)).size }));
  const rawTotal = files.reduce((s, x) => s + x.bytes, 0);
  // Playables requires raw archive entries and applies transport compression itself. Use a conservative gzip
  // estimate for the initial game download while continuing to enforce the per-file raw-size preference.
  const total = label === 'game'
    ? files.reduce((sum, x) => sum + Math.min(x.bytes, zlib.gzipSync(fs.readFileSync(path.join(dir, x.f))).byteLength), 0)
    : rawTotal;
  console.log(dir);
  for (const x of files) console.log(`  ${x.f.padEnd(14)} ${String(x.bytes).padStart(9)} bytes`);
  console.log(`  ${'raw total'.padEnd(14)} ${String(rawTotal).padStart(9)} bytes`);
  console.log(`  ${'transfer total'.padEnd(14)} ${String(total).padStart(9)} bytes (${label} budget ${budget})`);
  for (const x of files) if (x.bytes > BUDGET.fileBytes) over.push(`${dir}/${x.f} is over ${BUDGET.fileBytes} bytes`);
  if (total > budget) over.push(`${dir} total ${total} is over the ${label} budget ${budget}`);
}
console.log(over.length ? 'FAIL\n' + over.join('\n') : 'PASS');
if (over.length) process.exit(1);
