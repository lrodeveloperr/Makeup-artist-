// Builds the GamePush page (gamepush.com, which places one build on CrazyGames, GameDistribution, GamePix, Y8, Yandex,
// VK and other portals): the same game as the YouTube page, with src/game/gamepush.js as its host instead of
// src/game/youtube.js. The YouTube build (tools/build-game.mjs) is not touched.
//   build/gamepush       the page to upload to GamePush hosting (ZIP its contents: index.html at the root)
//   build/gamepush-test  the same page with a test stand-in for the GamePush SDK (tests only, never uploaded)
// The project's id and public token come from the GamePush panel (Add game). They are public values shown to every
// player's browser, kept in platforms/gamepush.json or given as GP_PROJECT_ID / GP_PUBLIC_TOKEN.
// Usage: node tools/build-gamepush.mjs [--minify]
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const config = fs.existsSync('platforms/gamepush.json') ? JSON.parse(fs.readFileSync('platforms/gamepush.json', 'utf8')) : {};
const projectId = String(process.env.GP_PROJECT_ID || config.projectId || '');
const publicToken = String(process.env.GP_PUBLIC_TOKEN || config.publicToken || '');
const test = process.argv.includes('--test-only');
if (!test && (!/^\d+$/.test(projectId) || !/^[A-Za-z0-9]+$/.test(publicToken))) {
  console.error('GamePush needs the project id and public token from its panel (platforms/gamepush.json or GP_PROJECT_ID / GP_PUBLIC_TOKEN).');
  process.exit(1);
}

// The GamePush loader: the SDK from its documented hosts in turn, resolving globalThis.gpReady with the SDK once it
// calls onGPInit. Registered before the game's script, so nothing it reports is missed.
const loader = (query) => `<script>
(function () {
  var hosts = ['https://gamepush.com/sdk/game-score.js', 'https://s3.gamepush.com/files/gs/sdk/game-score.js', 'https://s3-eu.gamepush.com/sdk/game-score.js', 'https://gs.eponesh.com/sdk/game-score.js'];
  var done;
  globalThis.gpReady = new Promise(function (resolve) { done = resolve; });
  globalThis.onGPInit = function (gp) { done(gp); };
  (function next(i) {
    if (i >= hosts.length) return;
    var s = document.createElement('script');
    s.src = hosts[i] + '?${query}&callback=onGPInit';
    s.async = true;
    s.onerror = function () { s.remove(); next(i + 1); };
    document.head.appendChild(s);
  })(0);
})();
</script>`;
const query = `projectId=${encodeURIComponent(projectId || '0')}&publicToken=${encodeURIComponent(publicToken || 'test')}`;
const TEST = `<script src="fake-gamepush.js"></script>`;

// the game, with the GamePush host in place of the YouTube one
const swapHost = {
  name: 'gamepush-host',
  setup(build) {
    build.onResolve({ filter: /\/youtube\.js$/ }, (args) => (args.importer.endsWith(path.join('game', 'main.js'))
      ? { path: path.resolve('src/game/gamepush.js') } : undefined));
  },
};
const html = fs.readFileSync('game/index.html', 'utf8');
const define = { HEAD_BYTES: String(fs.statSync('assets/head.bin.gz').size) };
const targets = test ? [['build/gamepush-test', TEST]] : [['build/gamepush', loader(query)], ['build/gamepush-test', TEST]];
for (const [dir, hostTag] of targets) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(`${dir}/index.html`, html.replace('<!--HOST-->', hostTag));
  fs.copyFileSync('assets/head.bin.gz', `${dir}/head.bin.gz`);
  for (const f of fs.readdirSync('assets/sounds')) fs.copyFileSync(`assets/sounds/${f}`, `${dir}/snd-${f}`);
  fs.copyFileSync('licenses/fflate-MIT.txt', `${dir}/fflate-MIT.txt`);
  await esbuild.build({ entryPoints: ['game/main.js'], bundle: true, format: 'esm', define, plugins: [swapHost], minify: process.argv.includes('--minify'), outfile: `${dir}/main.js`, logLevel: 'warning', target: 'es2022' });
}
fs.copyFileSync('tools/fake-gamepush.js', 'build/gamepush-test/fake-gamepush.js');
// the main bundle must hold the GamePush host and not the YouTube one
const bundle = fs.readFileSync(`${targets[0][0]}/main.js`, 'utf8');
if (bundle.includes('game_api') || bundle.includes('requestRewardedAd')) throw new Error('the YouTube host was bundled into the GamePush build');
if (!bundle.includes('showRewardedVideo')) throw new Error('the GamePush host is missing from the bundle');
console.log(targets.map(([d]) => d).join(', '));
