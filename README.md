# Freestyle makeup game

WorksBien Studios' makeup game for YouTube Playables, built on the reusable structure of
[Haircut](https://github.com/lrodeveloperr/Haircut).

Start with [MAKEUP-AI-BUILD-CONTRACT.md](MAKEUP-AI-BUILD-CONTRACT.md): it is the source of truth for gameplay, rewards,
platform behaviour, acceptance and the owner's decisions. Read [AGENTS.md](AGENTS.md) before making changes.

## The game

Apply makeup freely to a generated customer, review the look, then move on to the next face, or watch one rewarded
video to replay the same face clean. Every day one special colour for one tool (or the lenses) is offered as a gift box
until midnight; one rewarded video keeps it for good. An interstitial plays at Next after every second finished look.

- **Seven tools, always available:** soft brush, highlighter, detail pencil, liquid liner, mascara wand, lipstick and
  gloss, and tap-on 3D face gems, plus contact lenses for eye colour. Each tool is drawn in hand as a 3D model lit
  like the face, with real CC0 ASMR recordings (no music).
- **Fixed behaviour:** no sliders, eraser or undo. Strokes and repeated passes decide the result, and the close,
  front-facing camera needs no zoom.
- **Colours:** 35 base colours (a clear gloss among them) and 365 colours of the day (a year of daily offers), shown
  six at a time, newest first.
- **No words on screen:** icons, pictures and numbers only, so it plays the same in every language.

## Mouse, pen and touch

- **A mouse or a pen is free.** The tool takes the cursor's place, its tip exactly at the pointer.
- **A finger is assisted** (owner decisions, 20 October 2026):
  - Each tool works only in its own zones of the face, which glow faintly while the finger is down. A stroke stays in
    the zone it starts in, and a finger that strays a little is pulled to the zone's edge, so no tool has to be forced.
  - The liner and the pencil follow the lash line.
  - The tool is held just above the finger and set back over it, so it is seen in hand: 48 px above a forefinger, up
    to 66 px for a thumb, and a contact lens at 85 % of that. These heights were tuned by the owner on a phone.
  - While painting, only the area round the stroke is redrawn, so painting stays smooth on phones.

## Faces

CC0 MakeHuman heads with 93 shape dimensions, 15 ancestry profiles and named blends, procedural skin, eyes, brows
and lashes, 8 long hairstyles suited to each natural hair texture, natural hair colours per ancestry, and blouses and
dresses in complexion-flattering colours. Every customer is a young woman with long hair. See
[docs/FACES.md](docs/FACES.md) and [ASSETS.md](ASSETS.md).

## Status (20 October 2026)

- **Complete and merged into `main`.** The game plays end to end: Done → review → Next, Redo for a video, the gift box,
  saves and ads through the YouTube Playables SDK.
- **Download:** 419,946 bytes for the face system and tools (budget 420,000), and about 740 KB for the whole game page
  (budget 1 MB).
- **Saves:** a look is stored as compact, validated data that rebuilds exactly. A maximum-work session saves in under
  54 KB.
- **Pre-release integrity check passed.** Every test suite passes on the final code. A three-part code review fixed 17
  issues. The most serious were a GPU memory leak, recovery when a phone discards the game's graphics, the gift reveal,
  a lost Done, and paused saves.
- **Testing by the owner:** played on a laptop, with touch tuned on a phone. All automated tests run in a desktop
  browser with simulated touch, so a final play-through on a phone is the owner's step before publishing.
- **Release:** the owner makes the release package and publishes. No release archive, certification or publication
  is claimed here, and the public game title is not locked.

More detail: [docs/GAME.md](docs/GAME.md) (screen, sound, ads, saves, tests) and [docs/MAKEUP.md](docs/MAKEUP.md)
(tools, zones, input).

## Build and test

```sh
npm ci
npm run serve:game     # the game (development page): http://localhost:8130/?testads
npm run build:game     # build/game: the YouTube page to package (with the fflate licence notice)

npm test               # unit, makeup and game logic, the 2,000-face audit, the size budget
npm run test:game      # the full game flow in the browser, with a test stand-in for the SDK
npm run test:inputs    # every tool by finger, mouse and pen, its tip drawn where it works
npm run test:zones     # every touch zone of every tool paints and shows; nothing lands outside
npm run test:render    # faces and tools render; touch and patch redraws
npm run test:layout    # 30 screen sizes, portrait and landscape
npm run test:sound     # the sounds keep time with the hand
```
