// Deterministic MiniGame / GamePush release archives. Build first with `npm run build:game`.
import fs from 'node:fs';
import path from 'node:path';
import { zipSync } from 'fflate';

const platform = process.argv[2];
if (!['minigame', 'gamepush'].includes(platform)) throw new Error('platform must be minigame or gamepush');
const source = path.resolve(`build/${platform}`);
const output = path.resolve(process.argv[3] || `freestyle-asmr-makeup-artist-${platform}.zip`);
if (!fs.existsSync(source)) throw new Error(`${source} is missing; run the game build first`);
if (fs.existsSync(output)) throw new Error(`refusing to overwrite ${output}`);

const files = fs.readdirSync(source, { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
  .sort();
const entries = {};
for (const file of files) {
  entries[file] = [new Uint8Array(fs.readFileSync(path.join(source, file))), {
    level: 9,
    mtime: new Date(1980, 0, 1, 0, 0, 0),
  }];
}
fs.writeFileSync(output, zipSync(entries, { level: 9 }));
console.log(output);
