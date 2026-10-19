# Freestyle makeup game

Build contract for WorksBien Studios' makeup game, using the reusable structure of [Haircut](https://github.com/lrodeveloperr/Haircut).

Start with [MAKEUP-AI-BUILD-CONTRACT.md](MAKEUP-AI-BUILD-CONTRACT.md). It is the current source of truth for gameplay, rewards, platform behavior and acceptance. Read [AGENTS.md](AGENTS.md) before making changes.

The agreed game is simple: apply makeup with four always-available tools, change eye colour with contact lenses, review the result, then move to the next generated face or watch one rewarded ad to replay the same clean face. Each day one special colour for one tool (or the lenses) is on offer until midnight; one rewarded ad adds it to that tool's colours for good. An interstitial plays at Next after every second finished look.

The camera is already close enough for application. Players control the result through their strokes and repeated passes. There are no zoom controls or brush-size/intensity sliders.

Status (19 October 2026): the contract is prepared, and the **face generation and rendering prototype** is built: CC0 MakeHuman head with its three sculpted young-female base heads and 93 shape dimensions, 15 ancestry profiles plus named blends, procedural skin, eyes, brows and lashes, 8 long hairstyles that suit each natural hair texture, natural hair colours per ancestry, blouses and dresses worn on the body in complexion-flattering colours and patterns, and a variety director. Every customer is a young woman with long hair. The **makeup painting tools** work on every face by mouse and touch: soft brush, detail pencil, mascara wand and lip applicator with fixed behaviour (no sliders, eraser or undo), 43 base colours with gloss and shimmer finishes, and 8 contact-lens colours tapped onto either iris. The look is stored as compact validated data that rebuilds exactly; a maximum-work session saves in under 40 KB. The face system and the tools download in about 388 KB (face budget 400 KB), and the whole game page in about 408 KB (budget 1 MB). They pass the 2,000-face audit, the makeup checks and the browser render, paint and touch smoke test. See [docs/FACES.md](docs/FACES.md), [docs/MAKEUP.md](docs/MAKEUP.md), [docs/FACE-AUDIT.md](docs/FACE-AUDIT.md) and [ASSETS.md](ASSETS.md). The **single-screen game** plays end to end: Done → review (hold for the before) → Next, Redo for a video, the colour of the day, saves and ads through the YouTube Playables SDK, verified in the browser against a test stand-in for the SDK ([docs/GAME.md](docs/GAME.md)). Real-host and device checks, languages, sound and packaging are not done yet, and no release archive, certification or publication is claimed. The public game title is not locked.

```sh
npm ci
npm run serve:game                        # the game (development page): http://localhost:8130/?testads
node tools/build-preview.mjs && node tools/serve.mjs build/preview   # face and tool preview
npm test && npm run test:render && npm run test:game   # unit tests, audit, size budget, browser tests
```
