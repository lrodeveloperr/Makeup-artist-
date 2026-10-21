# Platforms

One game, one set of rules, one build per platform. Each build differs only in its **host**: the small module that
saves, plays ads, and passes on the platform's pause, sound and language (`createHost` in `src/game/`). The game
(`game/`, `src/`) never talks to a platform directly, so the owner's rules (two rewarded videos, the interstitial at
Next after every second finished look, no banners) hold everywhere.

| Platform | Host | Build | Release ZIP | Status |
| --- | --- | --- | --- | --- |
| YouTube Playables via MediaCube (McPlay) | `src/game/youtube.js` | `npm run build:game` → `build/game` | `npm run release:youtube` | Release v1.0.0 on `release/v1.0.0`; McPlay listing in progress |
| GamePush (CrazyGames, GameDistribution, GamePix, Y8, Yandex, VK and more) | `src/game/gamepush.js` | `npm run build:gamepush` → `build/gamepush` | `npm run release:gamepush` | Built and tested with a stand-in SDK; needs the project id and token, then a test on GamePush's own draft link |
| MiniGame (minigame.com) | not yet written | | | Its SDK documentation is behind the developer login |

## GamePush

- **SDK:** `game-score.js`, loaded from GamePush's documented hosts in turn, before the game's script
  (`tools/build-gamepush.mjs`). The page resolves `globalThis.gpReady` from `onGPInit`.
- **Project id and public token:** from the GamePush panel (Add game). They are public values. Put them in
  `platforms/gamepush.json` (`{ "projectId": "…", "publicToken": "…" }`) or pass `GP_PROJECT_ID` / `GP_PUBLIC_TOKEN`.
  The build refuses to run without them.
- **Saves:** one player field, `save`, a string. **Declare it in the panel first** (Players → Player Fields → Add Field,
  type *data*, key `save`). The game's save stays under 54 KB; GamePush allows 1 MB a player.
- **Ads:** `showFullscreen()` at Next only, under the game's own cadence; `showRewardedVideo()` for Redo and the daily
  colour, granted only on a strict `true`. No sticky banner and no preloader ad (owner's ad rules). GamePush's own
  frequency timer applies on top: its checklist allows interstitials at most once every 3 minutes, so set the
  fullscreen interval to 3 minutes in the panel. A refused interstitial keeps the game's cadence, as on YouTube.
- **Lifecycle:** `gameStart()` once the face is on screen, then `gameplayStart()`; `gameplayStop()` while GamePush
  pauses the game or an ad plays. GamePush's pause, resume and mute events drive the same paused and silent states
  as YouTube's.
- **Tests:** `npm run test:gamepush` builds the page with `tools/fake-gamepush.js` (a test stand-in, never uploaded)
  and plays it in a browser: readiness, saves, the interstitial, both rewarded videos refused and earned, pause and
  mute, a portal without rewarded videos, and reload.
- **Upload:** ZIP with `index.html` at the root (`npm run release:gamepush`), uploaded in Game Hosting. GamePush makes
  a draft test link; test there before publishing to any portal.

### GamePush checklist items for the owner

From GamePush's game-testing checklist; not decided here:

- **A pause/continue button and an option to turn music off.** The game has no music, and its pause comes from the
  platform. Some portals may still ask for an in-game pause button. Adding one is a change to the textless screen,
  so it needs the owner's decision.
- **Cover and icon:** the cover must show the game's exact title; the icon must not have a white or transparent
  background. The marketing covers carry the logo with the title; the app icon is opaque.
- **Languages:** English for worldwide portals; Russian for Russian portals (Yandex, VK, OK). The screen is textless;
  only the spoken labels are English.
