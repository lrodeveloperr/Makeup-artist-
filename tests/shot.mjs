// Screenshot helper: node tests/shot.mjs <dir> <url-path> <out.png> [width] [height]
import { chromium } from 'playwright';
import { serve } from '../tools/serve.mjs';
const [dir, urlPath, out, w = 600, h = 800] = process.argv.slice(2);
const server = await serve(dir, 8131);
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
page.on('console', (m) => console.log('console:', m.text()));
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto('http://localhost:8131/' + urlPath);
await page.waitForFunction('window.done === true', null, { timeout: 60000 });
await page.screenshot({ path: out });
await browser.close();
server.close();
