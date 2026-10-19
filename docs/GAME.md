# The game: one screen, saves and ads

Status: **prototype, locally verified against a test stand-in for the YouTube SDK.** The single-screen game
plays end to end in the browser: make up a face, review it, move on to the next customer. It saves through the
YouTube Playables SDK and has the owner's ad rules. Not done yet:
- checks on the real YouTube host and on phones
- languages other than English
- more sound (only the finish chime exists)
- a first-use hint
- score reporting

Contract sections: §3 (lifecycle and completion), §5 (daily colour), §7 (ads), §8–§11 (saves, startup, host).

## The screen

| State | What the player sees and can do |
| --- | --- |
| Create | The face. Seven tools and the lenses, with the selected tool's colours (earned colours of the day first, marked with a star). **Done** (top right, the size of the daily button), and the daily button (top left). |
| The finish | A look that changed the face: the Done seal pops, Haircut's bell chime plays (if the host allows sound), and sparkles burst from the face. Review then rises onto the counter. An untouched Done goes straight to review with a soft tone. |
| Review | As Haircut's completion. The top buttons give way, leaving the finished look on its own (no before/after button: owner decision, 19 October 2026). Arranged as Haircut's completion: **Next** is a big arrow at the counter's right edge, with a picture of the next customer docked against it in one cream pill and a chevron nudging between them (always free). **Retry** (breathing, with the video badge: the same face again, clean) sits level with it at the left edge, the same size as the Next arrow. In landscape, and on portrait screens too narrow for both (under 348 px at the UI scale), Retry takes the top-left corner at the top buttons' size. |
| Colour of the day | Minimal: a **product shot** of today's colour (owner's choice, 19 October 2026), one big button (the video badge; a green tick once earned) and the time left. Once earned the colour is already selected. |
| Loading / Retry | A loading cover until the face is on screen. A missing SDK, a failed load, or a save that isn't this game's stops at **Retry**, and the save is never overwritten. |

**Look: Blush Studio, textless (owner's choice, 19 October 2026).** The controls are Haircut's, recoloured:
- round "sticker" buttons with an ink outline and a hard shadow that presses down
- a yellow video badge on everything that plays a video
- a green rosette seal for Done, the size of the other top buttons
- a rose accent for the active tool and for Next

The customer sits behind a vanity counter that carries the controls, in front of a blush salon wall with a lit
vanity mirror (the 3D canvas is transparent). The mirror is hung just behind her and sized from her head, so it
keeps the same size beside her and the same shape on every screen. On a phone the camera is closer, so the arch
and its bulbs show above her head and the sides run off the edges. Create and review keep the same counter
height, so the face never moves.

Nothing on screen is a word:
- The colour of the day shows the product in that colour, drawn to look real (`game/reward.js`): a lipstick, an
  open compact with its brush, a baked highlighter with its fan brush and a swatch, a sharpened pencil with the
  line it draws, a liquid liner and its wing, a mascara and its wand, the face gem itself, or an eye wearing the
  lens. Gloss adds a wet highlight, shimmer adds sparkle. Below it are a video button (a tick once
  earned) and the time left in numbers.
- The countdown is Haircut's daily-pick clock:
  - a ring around the picture that drains anticlockwise with the day, green, then orange from 6 hours left, then
    red from 2 hours, ending as a red dot
  - a stopwatch pill in the same colour
  - in the last ten minutes the card glows red and the picture beats
  - once the colour is taken the ring goes
- An unsaved state is a cloud icon.
- The error screen is a warning icon and a Retry arrow, with a small diagnostic code.

Every control has a spoken English label (`aria-label`). `tests/game-smoke.mjs` checks there is no visible text
on each screen.

**Screens (Haircut's scaling):**
- **UI scale:** every control is drawn at one scale, taken from the screen's short side. It's 1 on phones, up to
  2.4 on big screens and down to 0.6 in tiny embeds. It's capped by the height (portrait: height / 700;
  landscape: height / 380), so the controls never crowd out the face.
- **Tools:** the eight tool buttons (seven tools and the lenses) sit in one row on phones from 320 px wide. In tiny
  or narrow embeds they become two rows of four bigger buttons, and review's counter grows with them so the face
  doesn't move.
- **Landscape** (wider than 1.15 × tall): the counter becomes a column at the side, with the tools in two columns
  beside a grid of colours, and review stacked. The top buttons sit over the scene's corners.
- **Narrow, tall screens:** the canvas is never narrower than 0.56 × its height, so her head and hair always fit
  across. Spare height becomes salon wall above her head; the canvas stands on the counter.
- **The daily pop-up** shrinks below the scale when the screen is too short for it.
- **The mirror** follows her head (`placeMirror` in `game/main.js`), never the screen's percentages.
- **Making a look and review** keep the same counter, so the face doesn't move.
- **`npm run test:layout`** (`tests/layout.mjs`) runs Haircut's 30-viewport matrix, from 225×400 to 3840×1080,
  portrait and landscape, live-resized. It covers making a look, the colour of the day and review, and checks:
  - every control is on screen, at least 30 px, and apart from the others
  - no control covers her eyes or mouth
  - the face fits its canvas and stays put between making and review
  - she sits in the middle of the salon mirror (within 1 px)

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
  - It never plays during making, a stroke, tool or colour choice, review, or a panel.
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
- **Catalogue:** 233 colours of the day (`DAILY` in `src/makeup/palette.js`): every coherent colour each tool
  can carry beyond the basic base (owner decisions, 19 October 2026). That's over seven months of daily offers.
  - 49 brush: pinks, reds, corals, purples, blues, greens, neutrals, and 16 shimmers and metallics
  - 12 highlighter: rose gold, pink, peach, champagne pink, topaz, copper, lilac, amethyst, opal, icy blue, aqua, mint
  - 30 pencil
  - 25 liquid liner: brights and darks, 4 metallics and 5 glitters
  - 22 mascara
  - 44 lip: brights, mauves and fantasy shades, 9 glosses, and metallics and glitters
  - 33 face gems: coloured and iridescent stones, drops, hearts, stars, flowers and pearls
  - 18 lens

  `tests/makeup.mjs` checks that every pair of colours within a tool, base included, is tellable apart (CIELAB
  ΔE ≥ 8 for the same finish, ≥ 4 across matte, gloss and shimmer).
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
- review
- Next and an untouched Next
- the interstitial on the second look
- a refused, then an earned, colour of the day
- Redo
- a host pause
- reload restoring everything
- a missing SDK and a foreign save stopping at Retry
- the dev page without ads
- no visible words on any screen

**Size:** the game page is 458 KB (`tests/size-budget.mjs`, game budget 1 MB).

## Not built yet

- **Localisation:** the contract asks for the host language, and the final locale list is still to be decided.
  English only for now.
- **More sound and a first-use hint:** only the finish chime exists so far.
- **Score reporting:** `engagement.sendScore` with acknowledged completions.
- **Real-host and device checks:** YouTube's Playables test suite, permitted test inventory, physical phones,
  and other browsers.
- **Context loss:** rebuilding the paint after a lost WebGL context.
