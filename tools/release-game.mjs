// Packages the YouTube Playables upload (contract §14, PACK01): builds the minified game page (build/game), then
// writes an immutable, byte-reproducible ZIP with index.html at its root and a release manifest beside it.
//   releases/freestyle-asmr-makeup-artist-v<version>-mediacube-youtube.zip
//   releases/freestyle-asmr-makeup-artist-v<version>-mediacube-youtube.json
// The ZIP holds exactly what build/game holds: no test stand-in, no dev page, no source. An existing release is never
// overwritten: a new release needs a new version in package.json.
// Usage: node tools/release-game.mjs [--target youtube|gamepush] [--out <dir>]
//   --target gamepush packages build/gamepush (tools/build-gamepush.mjs) as ...-gamepush.zip instead
//   --out writes a second copy elsewhere, to compare bytes
process.env.TZ = 'UTC'; // ZIP times are stored in local time; pin it so every machine writes the same bytes
const fs = await import('node:fs');
const path = await import('node:path');
const crypto = await import('node:crypto');
const { execFileSync } = await import('node:child_process');
const { zipSync } = await import('fflate');
const { SAVE_VERSION } = await import('../src/game/game.js');
const { GENERATOR_VERSION } = await import('../src/face/generator.js');
const { PLACEMENTS } = await import('../src/game/session.js');

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const arg = (flag) => { const i = process.argv.indexOf(flag); return i > 0 ? process.argv[i + 1] : undefined; };
const TARGETS = {
  youtube: {
    suffix: 'mediacube-youtube', builder: 'tools/build-game.mjs', src: 'build/game',
    target: 'YouTube Playables via MediaCube (McPlay)',
    sdk: 'https://www.youtube.com/game_api/v1 (official, unmodified, loaded before game code)',
    allowed: ['https://www.youtube.com/game_api/v1'],
    forbidden: [/fake-ytgame/, /__fakeAds/, /MAKEUP_DEV\s*=\s*true/, /TEST FIXTURE/, /playgama|bridge\.js/i, /gamepush|game-score\.js/i, /google-analytics|googletagmanager|gtag\(/i],
  },
  gamepush: {
    suffix: 'gamepush', builder: 'tools/build-gamepush.mjs', src: 'build/gamepush',
    target: 'GamePush (gamepush.com) hosting and the portals it publishes to',
    sdk: 'GamePush SDK game-score.js from its documented hosts, loaded before game code',
    allowed: ['https://gamepush.com/sdk/game-score.js', 'https://s3.gamepush.com/files/gs/sdk/game-score.js', 'https://s3-eu.gamepush.com/sdk/game-score.js', 'https://gs.eponesh.com/sdk/game-score.js'],
    forbidden: [/fake-gamepush/, /__fakeAds/, /__gpLog/, /MAKEUP_DEV\s*=\s*true/, /TEST FIXTURE/, /playgama|bridge\.js/i, /game_api|ytgame/, /google-analytics|googletagmanager|gtag\(/i],
  },
};
const T = TARGETS[arg('--target') || 'youtube'];
if (!T) { console.error(`unknown target: ${arg('--target')}`); process.exit(1); }
const NAME = `freestyle-asmr-makeup-artist-v${pkg.version}-${T.suffix}`;
const outDir = arg('--out') || 'releases';
const zipPath = path.join(outDir, `${NAME}.zip`);
const manifestPath = path.join(outDir, `${NAME}.json`);
if (fs.existsSync(zipPath) || fs.existsSync(manifestPath)) {
  console.error(`${zipPath} already exists: releases are immutable. Raise the version in package.json for a new one.`);
  process.exit(1);
}

execFileSync('node', [T.builder, '--minify'], { stdio: 'inherit' });

const SRC = T.src;
const MTIME = new Date('2026-01-01T00:00:00Z'); // fixed, so the bytes do not depend on when it was built
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const names = fs.readdirSync(SRC).sort();
const files = {};
const listing = [];
for (const name of names) {
  const p = path.join(SRC, name);
  if (!fs.statSync(p).isFile()) throw new Error(`${p}: only flat files belong in the upload`);
  if (!/^[A-Za-z0-9._-]+$/.test(name)) throw new Error(`${name}: not a portable file name`);
  const data = new Uint8Array(fs.readFileSync(p));
  // compressed files gain nothing from deflate; store them so the ZIP stays quick to open
  const level = /\.(gz|mp3|png|webp|jpg)$/.test(name) ? 0 : 9;
  files[name] = [data, { level, mtime: MTIME }];
  listing.push({ name, bytes: data.length, sha256: sha(data) });
}
if (!files['index.html']) throw new Error('index.html must sit at the root of the upload');

// the upload must never carry a test stand-in, the dev flag or another publisher's SDK (PACK02)
const FORBIDDEN = T.forbidden;
for (const { name } of listing) {
  if (!/\.(html|js|txt|json)$/.test(name)) continue;
  const text = fs.readFileSync(path.join(SRC, name), 'utf8');
  for (const re of FORBIDDEN) if (re.test(text)) throw new Error(`${name} contains ${re}: not allowed in the upload`);
}
const html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
const urls = [...new Set([...html.matchAll(/https?:\/\/[^\s"'<>)]+/g)].map((m) => m[0]))];
const external = urls.filter((u) => !T.allowed.includes(u));

const zip = zipSync(files);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(zipPath, zip, { flag: 'wx' });

let commit = 'unknown', dirty = null;
try {
  commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  dirty = execFileSync('git', ['status', '--porcelain', '--', 'game', 'src', 'assets', 'tools', 'licenses', 'package.json', 'package-lock.json'], { encoding: 'utf8' }).trim() !== '';
} catch { /* not a git checkout */ }

const expanded = listing.reduce((t, f) => t + f.bytes, 0);
const largest = listing.reduce((a, b) => (b.bytes > a.bytes ? b : a));
const manifest = {
  title: 'Freestyle ASMR Makeup Artist',
  studio: 'WorksBien Studios',
  target: T.target,
  release: NAME,
  version: pkg.version,
  sourceCommit: commit,
  sourceDirty: dirty,
  archive: { file: `${NAME}.zip`, sha256: sha(zip), bytes: zip.length },
  expandedBytes: expanded,
  fileCount: listing.length,
  largestFile: { name: largest.name, bytes: largest.bytes },
  budgets: { zipUnder: 5_000_000, expandedUnder: 5_000_000, gameUnder: 1_000_000, fileUnder: 524_288, filesAtMost: 8000 },
  withinBudgets: zip.length < 5_000_000 && expanded < 1_000_000 && largest.bytes < 524_288 && listing.length <= 8000,
  sdk: T.sdk,
  externalUrlsInPage: external,
  saveSchema: SAVE_VERSION,
  faceGenerator: GENERATOR_VERSION,
  rewardedPlacements: PLACEMENTS,
  scoreReporting: 'disabled (sendScore is never called)',
  files: listing,
  states: {
    locallyVerified: 'see the QA ledger built from these exact bytes',
    physicalDevice: 'NOT RUN',
    mcplayPreflight: 'NOT RUN',
    mcplayCertification: 'NOT RUN',
    published: 'NO',
  },
};
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
console.log(`${zipPath}\n  sha256 ${manifest.archive.sha256}\n  ${zip.length} bytes zipped, ${expanded} expanded, ${listing.length} files, largest ${largest.name} (${largest.bytes})`);
if (external.length) console.log(`  external URLs in index.html besides the SDK: ${external.join(', ')}`);
if (!manifest.withinBudgets) { console.error('over budget'); process.exit(1); }
