// Download-size budget for the face runtime (YouTube Playables loads every byte before the first face).
// Builds the minified preview and fails if a file or the total goes over budget.
// Usage: node tests/size-budget.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// Studio targets (contract §14 allows 5 MB; the platform recommends files under 512 KiB). The whole game
// should stay under 1 MB; the face system gets 400 KB of that, leaving room for UI, painting and the
// YouTube adapter.
export const BUDGET = { faceRuntimeBytes: 400_000, gameBytes: 1_000_000, fileBytes: 512 * 1024 };

execFileSync('node', ['tools/build-preview.mjs', '--minify'], { stdio: 'inherit' });
const dir = 'build/preview';
const files = fs.readdirSync(dir).map((f) => ({ f, bytes: fs.statSync(path.join(dir, f)).size }));
const total = files.reduce((s, x) => s + x.bytes, 0);
for (const x of files) console.log(`${x.f.padEnd(14)} ${String(x.bytes).padStart(9)} bytes`);
console.log(`${'total'.padEnd(14)} ${String(total).padStart(9)} bytes (budget ${BUDGET.faceRuntimeBytes})`);
const over = files.filter((x) => x.bytes > BUDGET.fileBytes).map((x) => `${x.f} is over ${BUDGET.fileBytes} bytes`);
if (total > BUDGET.faceRuntimeBytes) over.push(`total ${total} is over the face budget ${BUDGET.faceRuntimeBytes}`);
console.log(over.length ? 'FAIL\n' + over.join('\n') : 'PASS');
if (over.length) process.exit(1);
