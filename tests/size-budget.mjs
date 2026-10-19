// Download-size budget (YouTube Playables loads every byte before the first face).
// Builds the minified face preview and the minified game, and fails if a file or a total goes over budget:
//   face preview (the face system and the painting tools)  ≤ 400 KB
//   the game page (build/game, what gets uploaded)          ≤ 1 MB
// Usage: node tests/size-budget.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// Studio targets (contract §14 allows 5 MB; the platform recommends files under 512 KiB). The whole game
// should stay under 1 MB; the face system gets 400 KB of that.
export const BUDGET = { faceRuntimeBytes: 400_000, gameBytes: 1_000_000, fileBytes: 512 * 1024 };

execFileSync('node', ['tools/build-preview.mjs', '--minify'], { stdio: 'inherit' });
execFileSync('node', ['tools/build-game.mjs', '--minify'], { stdio: 'inherit' });
const over = [];
for (const [dir, budget, label] of [['build/preview', BUDGET.faceRuntimeBytes, 'face'], ['build/game', BUDGET.gameBytes, 'game']]) {
  const files = fs.readdirSync(dir).map((f) => ({ f, bytes: fs.statSync(path.join(dir, f)).size }));
  const total = files.reduce((s, x) => s + x.bytes, 0);
  console.log(dir);
  for (const x of files) console.log(`  ${x.f.padEnd(14)} ${String(x.bytes).padStart(9)} bytes`);
  console.log(`  ${'total'.padEnd(14)} ${String(total).padStart(9)} bytes (${label} budget ${budget})`);
  for (const x of files) if (x.bytes > BUDGET.fileBytes) over.push(`${dir}/${x.f} is over ${BUDGET.fileBytes} bytes`);
  if (total > budget) over.push(`${dir} total ${total} is over the ${label} budget ${budget}`);
}
console.log(over.length ? 'FAIL\n' + over.join('\n') : 'PASS');
if (over.length) process.exit(1);
