// Runs every test suite against the exact release bytes and writes the QA ledger beside the release (contract §15).
//   1. logic suites and the size budget (these build their own pages)
//   2. PACK01: package a second time and compare bytes with the release
//   3. the release ZIP is extracted over build/game, each file checked against the manifest's hash
//   4. browser suites on those extracted bytes (the SDK stand-in is injected by the test runner, never shipped)
// Writes releases/<release>-qa.json and releases/<release>-qa.md. Exits 1 if anything fails.
// Usage: node tools/release-game.mjs && node tools/release-qa.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { unzipSync } from 'fflate';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const NAME = `freestyle-asmr-makeup-artist-v${pkg.version}-mediacube-youtube`;
const zipPath = `releases/${NAME}.zip`;
const manifest = JSON.parse(fs.readFileSync(`releases/${NAME}.json`, 'utf8'));
const zip = fs.readFileSync(zipPath);
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
if (sha(zip) !== manifest.archive.sha256) throw new Error('the ZIP does not match its manifest');

const results = [];
function run(id, what, args, covers) {
  const t = Date.now();
  const r = spawnSync('node', args, { encoding: 'utf8', maxBuffer: 64 << 20, env: process.env });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  const checks = (out.match(/^ok\b/gm) || []).length;
  const result = r.status === 0 ? 'PASS' : 'FAIL';
  results.push({ id, what, command: `node ${args.join(' ')}`, covers, result, checks, seconds: Math.round((Date.now() - t) / 100) / 10, tail: out.trim().split('\n').slice(-8).join('\n') });
  console.log(`${result} ${id} ${what} (${checks} checks, ${results.at(-1).seconds}s)`);
  if (r.status !== 0) console.log(out.trim().split('\n').slice(-40).join('\n'));
}
function record(id, what, ok, detail, covers) {
  results.push({ id, what, command: '(in release-qa)', covers, result: ok ? 'PASS' : 'FAIL', checks: 1, seconds: 0, tail: detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${what}: ${detail}`);
}

// 1. logic and budgets
run('UNIT', 'Face system unit tests', ['tests/unit.mjs'], 'face generator, geometry, saves of faces');
run('MAKEUP', 'Makeup domain', ['tests/makeup.mjs'], 'G01–G05, G07');
run('GAME', 'Game logic: lifecycle, daily colour, cadence, saves', ['tests/game.mjs'], 'FLOW01–03, R01–R06, AD01–AD06, SAVE01–SAVE05, METRIC01');
run('CONTENT01', 'Face audit, 2,000 faces', ['tests/face-audit.mjs', '2000', '300'], 'CONTENT01');
run('SIZE', 'Download size budget', ['tests/size-budget.mjs'], '§14 budgets');

// 2. reproducibility
const again = fs.mkdtempSync(path.join(os.tmpdir(), 'release-'));
const rebuilt = spawnSync('node', ['tools/release-game.mjs', '--out', again], { encoding: 'utf8' });
const second = rebuilt.status === 0 ? fs.readFileSync(path.join(again, `${NAME}.zip`)) : null;
record('PACK01', 'Rebuilt ZIP is byte-identical', !!second && Buffer.compare(second, zip) === 0, second ? `second build sha256 ${sha(second)}` : rebuilt.stderr.trim().slice(-400), 'PACK01');

// 3. the exact upload bytes become build/game
fs.rmSync('build/game', { recursive: true, force: true });
fs.mkdirSync('build/game', { recursive: true });
const entries = unzipSync(new Uint8Array(zip));
const want = new Map(manifest.files.map((f) => [f.name, f.sha256]));
let mismatch = [];
for (const [name, data] of Object.entries(entries)) {
  if (want.get(name) !== sha(data)) mismatch.push(name);
  fs.writeFileSync(path.join('build/game', name), data);
}
if (Object.keys(entries).length !== want.size) mismatch.push('file count');
record('PACK-EXTRACT', 'Extracted ZIP matches the manifest file by file', mismatch.length === 0, mismatch.length ? `mismatch: ${mismatch.join(', ')}` : `${want.size} files, index.html at root: ${!!entries['index.html']}`, 'PACK01');

// 4. browser suites on the exact bytes
run('GAME-BROWSER', 'Full game flow in the browser (SDK stand-in injected)', ['tests/game-smoke.mjs'], 'FLOW01–03, R01–R02, AD03, AD05, AD07, SAVE03, BOOT01, LIFE01–02, UI02 (textless)');
run('UI01', 'Layout on 30 screens, portrait and landscape', ['tests/layout.mjs'], 'UI01');
run('INPUTS', 'Every tool by finger, mouse and pen', ['tests/inputs.mjs'], 'G01–G06');
run('ZONES', 'Touch zones of every tool', ['tests/zones.mjs'], 'G01–G05 (assisted touch)');
run('SOUND', 'Sounds keep time with the hand', ['tests/sound.mjs'], 'LIFE02 (audio paths)');
const preview = spawnSync('node', ['tools/build-preview.mjs'], { encoding: 'utf8' });
if (preview.status !== 0) record('RENDER', 'Preview build', false, preview.stderr.slice(-400), 'render');
else run('RENDER', 'Faces and tools render; touch and patch redraws', ['tests/render-smoke.mjs'], 'RECOVERY01 (render), CONTENT01 (visual)');

const failed = results.filter((r) => r.result !== 'PASS');
const ledger = {
  release: NAME,
  archiveSha256: manifest.archive.sha256,
  sourceCommit: manifest.sourceCommit,
  ranAt: new Date().toISOString(),
  environment: `${process.env.GITHUB_ACTIONS ? `GitHub Actions run ${process.env.GITHUB_RUN_ID}` : os.hostname()}, Node ${process.version}, ${os.platform()} ${os.arch()}, headless Chromium (Playwright)`,
  summary: `${results.length - failed.length}/${results.length} PASS`,
  results,
  notRun: {
    'BROWSER01 (Firefox, WebKit, Edge)': 'NOT RUN: the suites run in Chromium only',
    'DEVICE01 (physical Android/iOS in the YouTube app)': 'NOT RUN here: owner play-through on a phone is recorded in README, not as evidence for these bytes',
    'PERF01 (cold/warm first playable on a named device)': 'NOT RUN',
    'SOAK01 (50 transitions, 10 active minutes)': 'NOT RUN',
    'HOST01 (McPlay pre-flight on these bytes)': 'NOT RUN at ledger time',
    'HOST02 (real host saves and test-inventory ads)': 'NOT RUN',
    'HOST03 (listing answers)': 'see the McPlay listing record',
  },
};
fs.writeFileSync(`releases/${NAME}-qa.json`, JSON.stringify(ledger, null, 2) + '\n');
const md = [
  `# QA ledger: ${NAME}`, '',
  `- Archive SHA-256: \`${ledger.archiveSha256}\``,
  `- Source commit: \`${ledger.sourceCommit}\``,
  `- Ran: ${ledger.ranAt}, ${ledger.environment}`,
  `- Result: **${ledger.summary}**`, '',
  '| ID | Suite | Covers | Result | Checks | Time |', '| --- | --- | --- | --- | --- | --- |',
  ...results.map((r) => `| ${r.id} | ${r.what} | ${r.covers} | ${r.result} | ${r.checks} | ${r.seconds}s |`), '',
  '## Not run', '', ...Object.entries(ledger.notRun).map(([k, v]) => `- ${k}: ${v}`), '',
].join('\n');
fs.writeFileSync(`releases/${NAME}-qa.md`, md);
console.log(`\n${ledger.summary}`);
process.exit(failed.length ? 1 : 0);
