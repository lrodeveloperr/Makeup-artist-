# Platform adapters

Version 1.0.2 adds release targets for MiniGame and GamePush without changing the core gameplay or ad cadence.

## MiniGame

- Loads the MiniGame JavaScript SDK from `https://sdk.minigame.vip/js/1.1/minigame.js`.
- Initializes the SDK before loading player data.
- Calls `startGameAsync` and `setGameReadyAsync` only when the game is interactive.
- Uses MiniGame rewarded and interstitial APIs through the shared host interface.
- Stores the existing game save in MiniGame player cloud data.

Build with `npm run build:game` and package with `npm run package:minigame`.

## GamePush

- Loads the official GamePush SDK for project 31729.
- Calls `gameStart` when the game is interactive.
- Uses GamePush fullscreen and rewarded ad APIs through the shared host interface.
- Stores the existing game save through GamePush player cloud data.

Build with `npm run build:game` and package with `npm run package:gamepush`.

## Verification

- `tests/hosts.mjs` verifies both adapters initialize, save and load data, signal readiness, invoke ads, and pause/resume correctly.
- The existing unit, makeup, game, face-audit, and size-budget suites remain part of `npm test`.
- GamePush's sandbox verified SDK initialization and the `gameStart` signal for the hosted v1 draft.

The two rewarded placements, every-second-completed-look interstitial cadence, and no-banner rule remain unchanged.
