# Freestyle makeup game

Build contract for WorksBien Studios' makeup game, using the reusable structure of [Haircut](https://github.com/lrodeveloperr/Haircut).

Start with [MAKEUP-AI-BUILD-CONTRACT.md](MAKEUP-AI-BUILD-CONTRACT.md). It is the current source of truth for gameplay, rewards, platform behavior and acceptance. Read [AGENTS.md](AGENTS.md) before making changes.

The agreed game is simple: apply makeup with four always-available tools, change eye colour with contact lenses, review the result, then move to the next generated face or watch one rewarded ad to replay the same clean face. One daily rewarded ad unlocks one extra colour for one specific tool or the lens selector for 24 hours.

The camera is already close enough for application. Players control the result through their strokes and repeated passes. There are no zoom controls or brush-size/intensity sliders.

Status (18 October 2026): the contract is prepared, and the **face generation and rendering prototype** is built: CC0 MakeHuman head, 93 shape dimensions, 16 ancestry profiles plus blends, procedural skin, eyes, brows, lashes, 22 hairstyles and head coverings, and a variety director. The face system downloads in about 320 KB (budget 400 KB; whole game 1 MB). It passes the 2,000-face audit and the browser render smoke test. See [docs/FACES.md](docs/FACES.md), [docs/FACE-AUDIT.md](docs/FACE-AUDIT.md) and [ASSETS.md](ASSETS.md). Makeup painting, game screens, saves, ads, the YouTube adapter and device/host checks are not built yet, and no release archive, certification or publication is claimed. The public game title is not locked.

```sh
npm ci
node tools/build-preview.mjs && node tools/serve.mjs build/preview   # http://localhost:8130/
npm test && node tests/render-smoke.mjs   # unit tests, 2,000-face audit, size budget, browser render
```
