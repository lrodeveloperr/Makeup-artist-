// Builds the game:
//   build/game      the YouTube Playables page (loads the official SDK first; this is what gets uploaded)
//   build/game-dev  the development page: no SDK (local saves, no ads), or the test stand-in with ?testads
// Usage: node tools/build-game.mjs [--minify]
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import zlib from 'node:zlib';

const SDK = '<script src="https://www.youtube.com/game_api/v1"></script>';
const DEV = '<script>globalThis.MAKEUP_DEV = true;</script>\n<script src="fake-ytgame.js"></script>';
const MINIGAME = '<script>globalThis.MAKEUP_PLATFORM = "minigame";</script>\n<script src="https://sdk.minigame.vip/js/1.1/minigame.js"></script>';
const GAMEPUSH = `<script>
globalThis.MAKEUP_PLATFORM = 'gamepush';
globalThis.MAKEUP_GP = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('The GamePush SDK could not load')), 15000);
  globalThis.onGPInit = (gp) => { clearTimeout(timer); resolve(gp); };
});
((s,c,o,r,e)=>{var f=0,t={},p=0,m=r.length,w=[],j=u=>{if(f||t[u])return;f=1;t[u]=1;var d=c.createElement(o);d.async=1;d.src=u+e;d.onerror=()=>{f=0;n()};var a=c.getElementsByTagName(o)[0];a.parentNode.insertBefore(d,a)},n=()=>{for(var k=0;k<w.length;k++)if(!t[w[k]])return j(w[k])},q=()=>{++p>=m&&!f&&n()};r.forEach(u=>s.fetch(u,{method:'HEAD'}).then(x=>{x&&x.ok?(w.push(u),j(u)):q()}).catch(q));s.setTimeout(()=>{f||n()},5000)})(window,document,'script',atob('aHR0cHM6Ly9ncy5lcG9uZXNoLmNvbS9zZGsvZ2FtZS1zY29yZS5qcyxodHRwczovL3MzLmdhbWVwdXNoLmNvbS9maWxlcy9ncy9zZGsvZ2FtZS1zY29yZS5qcyxodHRwczovL3MzLWV1LmdhbWVwdXNoLmNvbS9zZGsvZ2FtZS1zY29yZS5qcyxodHRwczovL2dhbWVwdXNoLmNvbS9zZGsvZ2FtZS1zY29yZS5qcw==').split(','),'?projectId=31729&publicToken=8HBrnHy5iUcWW4HB7de2IZiRZHMgKds8&callback=onGPInit');
</script>`;
const html = fs.readFileSync('game/index.html', 'utf8');
const head = zlib.gunzipSync(fs.readFileSync('assets/head.bin.gz'));
const headChunk = 500_000;
for (const [dir, host] of [['build/game', SDK], ['build/game-dev', DEV], ['build/minigame', MINIGAME], ['build/gamepush', GAMEPUSH]]) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(`${dir}/index.html`, html.replace('<!--HOST-->', host));
  // YouTube serves ZIP entries without Content-Encoding, so release packages ship raw chunks. Keeping each chunk
  // below the studio's 512 KiB preference also lets the browser fetch them concurrently.
  for (let at = 0, part = 0; at < head.byteLength; at += headChunk, part++) {
    fs.writeFileSync(`${dir}/head-${part}.bin`, head.subarray(at, Math.min(at + headChunk, head.byteLength)));
  }
  // the tools' CC0 recordings (tools/make-sounds.py)
  for (const f of fs.readdirSync('assets/sounds')) fs.copyFileSync(`assets/sounds/${f}`, `${dir}/snd-${f}`);
  // the MIT notice of fflate, bundled in main.js (ASSETS.md)
  fs.copyFileSync('licenses/fflate-MIT.txt', `${dir}/fflate-MIT.txt`);
}
// the face's download size, for the loading screen's progress where a server does not send it
const define = { HEAD_BYTES: String(head.byteLength) };
await esbuild.build({ entryPoints: ['game/main.js'], bundle: true, format: 'esm', define, minify: process.argv.includes('--minify'), outfile: 'build/game/main.js', logLevel: 'warning', target: 'es2022' });
fs.copyFileSync('build/game/main.js', 'build/game-dev/main.js');
fs.copyFileSync('build/game/main.js', 'build/minigame/main.js');
fs.copyFileSync('build/game/main.js', 'build/gamepush/main.js');
fs.copyFileSync('tools/fake-ytgame.js', 'build/game-dev/fake-ytgame.js');
