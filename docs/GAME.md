# The game: one screen, saves and ads

Status: **prototype, locally verified against a test stand-in for the YouTube SDK.** The single-screen game
plays end to end in the browser: make up a face, review it, move on to the next customer. It saves through the
YouTube Playables SDK and has the owner's ad rules. Not done yet:
- checks on the real YouTube host and on phones
- languages other than English
- sound
- a first-use hint
- score reporting

Contract sections: §3 (lifecycle and completion), §5 (daily colour), §7 (ads), §8–§11 (saves, startup, host).

## The screen

| State | What the player sees and can do |
| --- | --- |
| Create | The face. Four tools and the lenses, with the selected tool's colours (earned colours of the day first, marked with a star). **Done** (top right, the size of the daily button), and the daily button (top left). |
| The finish | A look that changed the face: the Done seal pops, Haircut's bell chime plays (if the host allows sound), and sparkles burst from the face. Review then rises onto the counter. An untouched Done goes straight to review with a soft tone. |
| Review | As Haircut's completion. The top buttons give way to the **eye** (hold to see the clean starting face; read-only). On the counter: **Retry** (breathing, with the video badge: the same face again, clean) and **Next**, with a picture of the next customer docked against the arrow (always free). |
| Colour of the day | Minimal: the **tool drawn in today's colour**, one big button (the video badge; a green tick once earned) and the time left. Once earned the colour is already selected. |
| Loading / Retry | A loading cover until the face is on screen. A missing SDK, a failed load, or a save that isn't this game's stops at **Retry**, and the save is never overwritten. |

**Look: Blush Studio, textless (owner's choice, 19 October 2026).** The controls are Haircut's, recoloured:
- round "sticker" buttons with an ink outline and a hard shadow that presses down
- a yellow video badge on everything that plays a video
- a green rosette seal for Done, the size of the other top buttons
- a rose accent for the active tool and for Next

The customer sits behind a vanity counter that carries the controls, in front of a blush salon wall with a lit
vanity mirror (the 3D canvas is transparent). Create and review keep the same counter height, so the face never
moves.

Nothing on screen is a word:
- The colour of the day shows the tool in that colour (`game/art.js`: a compact and brush, a lipstick, a pencil,
  a mascara, an eye wearing the lens; gloss adds a highlight, shimmer adds sparkles), a video button (a tick once
  earned), and the time left in numbers.
- An unsaved state is a cloud icon.
- The error screen is a warning icon and a Retry arrow, with a small diagnostic code.

Every control has a spoken English label (`aria-label`). `tests/game-smoke.mjs` checks there is no visible text
on each screen.

There is no eraser, undo or free reset. Redo is the rewarded replay the contract promises. An untouched
Done/Next is allowed, but counts nothing.

## Ads (owner decisions, 19 October 2026)

- **Pre-roll:** YouTube shows it before the game opens. The game never requests it.
- **Interstitial: systematic, at Next after every second finished look.** A finished look is one that changed
  the face (makeup, or a lens that differs from the natural iris).
  - The contract's guards stay: a minute of actual making since the last break, a minute between interstitial
    requests, and a minute after a rewarded video.
  - **A rewarded video also stands in for the next interstitial:** that break is skipped and counting starts
    again.
  - It never plays during making, a stroke, tool or colour choice, review, the before/after comparison, or a
    panel.
  - A refused or failed request lets the next face come normally and keeps the count.
- **Rewarded, exactly two purposes, always the player's choice:**
  1. **Redo this face** (`makeup-replay-face`, in review). One video: the same face, clean, as a new attempt.
     The queue and totals stay.
  2. **Colour of the day** (`makeup-daily-colour`, in the daily section). One video: today's colour joins its
     tool's colours **for good**, on every face.
- **When there are no rewarded videos** (off YouTube, or the SDK has none), the daily button and Redo are hidden.
  The base game is complete without them.
- **The order of every ad request:**
  1. Capture what is being requested (this attempt, or today's offer).
  2. Save, and wait for the acknowledgement. If the save fails, no ad is requested.
  3. Request the ad. The game pauses while it plays.
  4. Wait for the host to resume.
  5. Grant only on a strict `true`, once, using the captured context, then save.

  If midnight passes during the video, the colour that was advertised is the one granted.

## The colour of the day

This follows the pattern of Haircut's daily pick (`src/game/daily.js`):
- **Offer:** one special colour for one tool (or the lenses) per local calendar day. It's the same for every
  player who doesn't own it yet, and never one the player owns.
- **Catalogue:** 52 special colours outside the base catalogue (`DAILY` in `src/makeup/palette.js`). The base
  keeps the everyday shades only (owner decision, 19 October 2026). The specials are:
  - 16 brush: neon, metallic, opal, shimmer and fantasy shades
  - 10 pencil
  - 7 mascara
  - 11 lip: every gloss, plus holographic and gold
  - 8 lens: aqua, violet and other fantasy colours
- **Rotation:** the tool families take turns day by day.
- **Timing:** a countdown runs to local midnight, when the next colour replaces the offer. A red dot on the
  daily button shows once a day while today's colour is waiting.
- **Clock:** the day comes from the device clock. Changing it can show another day's offer, but each colour
  still costs one video and is never granted twice.

## Saves

- **One envelope:** `{ game: 'worksbien-makeup', v: 1, generator, state }` (`src/game/game.js`). It holds:
  - the customer queue, and the current and next face records
  - the current attempt: id, create or review, the makeup in the compact form from [MAKEUP.md](MAKEUP.md), and
    whether it was counted
  - completions and ad pacing
  - earned colours, today's offer and the selection
- **Size:** a new game saves in about 6.9 KB. With a maximum-work look it stays under the contract's 64 KiB
  target (the makeup part is at most about 40 KB).
- **When:**
  - right after each stroke, lens change, Done, Next and earned reward
  - other changes within a second
  - in YouTube's pause callback (the final-save window)

  Writes are serialised. A change made during a write stays unsaved until a later write includes it. A failed
  save shows "Not saved yet. Retrying…" and is retried.
- **Loading:** a save that is empty or `{}` starts a new game. Anything else must validate exactly: every face
  record must be one the generator makes from its seed, the makeup must decode, and ids and counters must be in
  range. A save from another game, a newer version or damaged data is protected and stops at Retry.

## Host (`src/game/youtube.js`)

The adapter follows Haircut's direct YouTube client:
- The SDK's pause and resume callbacks are registered before anything asynchronous.
- `firstFrameReady` is sent when the loading screen shows, and `gameReady` once the face is on screen.
- The game is paused, and the screen made inert, while the host pauses it or an ad plays. An ad result never
  clears a host pause.
- Saves over 3 MiB are refused.

It runs in three environments:

| Environment | Saves | Ads |
| --- | --- | --- |
| YouTube (`ytgame.IN_PLAYABLES_ENV`) | Cloud (`loadData` / `saveData`) | Interstitial and rewarded |
| Real SDK outside YouTube | Local, separate key | None |
| Development page (`build/game-dev`) | Local, separate key | None, or the labelled test stand-in with `?testads` |

`tools/fake-ytgame.js` is a **test fixture**. It shows a labelled "TEST AD" overlay. The browser test injects
it in place of the SDK address, and it is never part of an upload. The YouTube page (`build/game`) always
loads the real SDK first.

## Build and test

```sh
npm run build:game     # build/game (YouTube page, minified) and build/game-dev
npm run serve:game     # the development page on http://localhost:8130/ (add ?testads for test ads)
npm test               # includes tests/game.mjs (rules, pacing, daily colour, saves, ad ordering)
npm run test:game      # tests/game-smoke.mjs: the YouTube page in Chromium with the SDK stand-in
```

**`tests/game.mjs`** covers:
- the daily offer is deterministic, never repeats an owned colour, and rotates tools
- pacing: every second finished look, the minute guards, untouched looks never count, and rewarded skips
- finish counts once; Next brings the previewed face; replay gives the same face clean
- earned colours are kept and usable, and colours not yet earned can't be used
- the save round-trips, and other-game, too-new and tampered saves are refused
- a save comes before every ad, and no ad is requested if the save fails
- rewards are granted once, on true only, with the captured offer
- double taps; a change made during a write stays unsaved until the next write

**`tests/game-smoke.mjs`** runs the full flow with the mouse:
- readiness signals
- review and before/after
- Next and an untouched Next
- the interstitial on the second look
- a refused, then an earned, colour of the day
- Redo
- a host pause
- reload restoring everything
- a missing SDK and a foreign save stopping at Retry
- the dev page without ads
- no visible words on any screen

**Size:** the game page is 408 KB (`tests/size-budget.mjs`, game budget 1 MB).

## Not built yet

- **Next-customer teaser:** a small preview of the next face in review, to keep players through the
  interstitial (agreed in principle).
- **Localisation:** the contract asks for the host language, and the final locale list is still to be decided.
  English only for now.
- **More sound and a first-use hint:** only the finish chime exists so far.
- **Score reporting:** `engagement.sendScore` with acknowledged completions.
- **Real-host and device checks:** YouTube's Playables test suite, permitted test inventory, physical phones,
  and other browsers.
- **Context loss:** rebuilding the paint after a lost WebGL context.
