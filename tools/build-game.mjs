// Builds the game:
//   build/game      the YouTube Playables page (loads the official SDK first; this is what gets uploaded)
//   build/game-dev  the development page: no SDK (local saves, no ads), or the test stand-in with ?testads
// Usage: node tools/build-game.mjs [--minify]
import * as esbuild from 'esbuild';
import fs from 'node:fs';

const SDK = '<script src="https://www.youtube.com/game_api/v1"></script>';
const DEV = '<script>globalThis.MAKEUP_DEV = true;</script>\n<script src="fake-ytgame.js"></script>';
const html = fs.readFileSync('game/index.html', 'utf8');
for (const [dir, host] of [['build/game', SDK], ['build/game-dev', DEV]]) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(`${dir}/index.html`, html.replace('<!--HOST-->', host));
  fs.copyFileSync('assets/head.bin.gz', `${dir}/head.bin.gz`);
}
await esbuild.build({ entryPoints: ['game/main.js'], bundle: true, format: 'esm', minify: process.argv.includes('--minify'), outfile: 'build/game/main.js', logLevel: 'warning', target: 'es2022' });
fs.copyFileSync('build/game/main.js', 'build/game-dev/main.js');
fs.copyFileSync('tools/fake-ytgame.js', 'build/game-dev/fake-ytgame.js');
