# Freestyle makeup game

Build contract for WorksBien Studios' makeup game, using the reusable structure of [Haircut](https://github.com/lrodeveloperr/Haircut).

Start with [MAKEUP-AI-BUILD-CONTRACT.md](MAKEUP-AI-BUILD-CONTRACT.md). It is the current source of truth for gameplay, rewards, platform behavior and acceptance. Read [AGENTS.md](AGENTS.md) before making changes.

The agreed game is simple: apply makeup with four always-available tools, change eye colour with contact lenses, review the result, then move to the next generated face or watch one rewarded ad to replay the same clean face. One daily rewarded ad unlocks one extra colour for one specific tool or the lens selector for 24 hours.

The camera is already close enough for application. Players control the result through their strokes and repeated passes. There are no zoom controls or brush-size/intensity sliders.

Status (18 October 2026): the contract is prepared, and the **face generation and rendering prototype** is built: CC0 MakeHuman head with its three sculpted young-female base heads and 93 shape dimensions, 15 ancestry profiles plus named blends, procedural skin, eyes, brows and lashes, 8 long hairstyles that suit each natural hair texture, natural hair colours per ancestry, blouses and dresses worn on the body in complexion-flattering colours and patterns, and a variety director. Every customer is a young woman with long hair. The face system downloads in about 360 KB (budget 400 KB; whole game 1 MB). It passes the 2,000-face audit and the browser render smoke test. See [docs/FACES.md](docs/FACES.md), [docs/FACE-AUDIT.md](docs/FACE-AUDIT.md) and [ASSETS.md](ASSETS.md). Makeup painting, game screens, saves, ads, the YouTube adapter and device/host checks are not built yet, and no release archive, certification or publication is claimed. The public game title is not locked.

```sh
npm ci
node tools/build-preview.mjs && node tools/serve.mjs build/preview   # http://localhost:8130/
npm test && node tests/render-smoke.mjs   # unit tests, 2,000-face audit, size budget, browser render
```
