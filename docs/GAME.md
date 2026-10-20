# The game: one screen, saves and ads

Status: **prototype, locally verified against a test stand-in for the YouTube SDK.** The single-screen game
plays end to end in the browser: make up a face, review it, move on to the next customer. It saves through the
YouTube Playables SDK and has the owner's ad rules. Not done yet:
- checks on the real YouTube host and on phones
- languages other than English
- listening checks on real phones (the sounds are measured and rendered, not yet heard on devices)
- a first-use hint
- score reporting

Contract sections: §3 (lifecycle and completion), §5 (daily colour), §7 (ads), §8–§11 (saves, startup, host).

## The screen

| State | What the player sees and can do |
| --- | --- |
| Create | The face. Seven tools and the lenses, with the selected tool's colours (six at a time: the newest earned colours of the day first, then the base colours). **Done** (top right, the size of the daily button), and the daily button (top left). |
| The finish | A look that changed the face: the Done seal pops, Haircut's bell chime plays (if the host allows sound), and sparkles burst from the face. Review then rises onto the counter. An untouched Done goes straight to review with a soft tone. |
| Review | As Haircut's completion. The top buttons give way, leaving the finished look on its own (no before/after button: owner decision, 19 October 2026). Arranged as Haircut's completion: **Next** is a big arrow at the counter's right edge, with a picture of the next customer docked against it in one cream pill and a chevron nudging between them (always free). **Retry** (breathing, with the video badge: the same face again, clean) sits level with it at the left edge, the same size as the Next arrow. In landscape, and on portrait screens too narrow for both (under 348 px at the UI scale), Retry takes the top-left corner at the top buttons' size. |
| Colour of the day | **The gift** (owner's choice, 20 October 2026): a gift box tied in today's colour, one big button showing the deal (the video badge → the **product shot** of today's colour), and a clock that ticks until the box is opened. After the video the box opens on the colour, with a sound and confetti, and the button becomes an arrow back to the game with the colour already selected. |
| Loading / Retry | A loading cover until the face is on screen (owner's choice, 19 October 2026): a blush compact, textless and sized like the controls on every screen, whose pan fills with the face's download where the game can measure it, and otherwise fills and empties in a loop; it completes and fades into the game as it starts, never adding a delay. A missing SDK, a failed load, or a save that isn't this game's stops at **Retry**, and the save is never overwritten. |

**Look: Blush Studio, textless (owner's choice, 19 October 2026).** The controls are Haircut's, recoloured:
- round "sticker" buttons with an ink outline and a hard shadow that presses down
- a yellow video badge on everything that plays a video
- a green rosette seal for Done, the size of the other top buttons
- a rose accent for the active tool and for Next

The customer sits behind a vanity counter that carries the controls, in front of a blush salon wall with a lit
vanity mirror (the 3D canvas is transparent). The mirror is hung just behind her and sized from her head, so it
keeps the same size beside her and the same shape on every screen. On a phone the camera is closer, so the arch
and its bulbs show above her head and the sides run off the edges. The bulbs are evenly spaced along the
whole frame (up the sides and round the arch) and placed as fractions of the mirror, so every screen shows the
same lights in the same places. Create and review keep the same counter
height, so the face never moves.

Nothing on screen is a word:
- The colour of the day is a gift (owner's choice, 20 October 2026):
  - a cream gift box tied with a ribbon and bow in today's colour, in slowly turning light rays; now and then the
    lid lifts a little and light leaks out. A green ∞ seal says it is kept for good.
  - the product appears once, on the button, drawn to look real (`game/reward.js`): a lipstick, an open compact
    with its brush, a baked highlighter with its fan brush and a swatch, a sharpened pencil with the line it draws,
    a liquid liner and its wing, a mascara and its wand, the face gem itself, or an eye wearing the lens. Gloss adds
    a wet highlight, shimmer adds sparkle. The button reads video badge → arrow → product: one video for this.
  - the clock is a stopwatch tag hanging off the bow. From the moment the card opens it ticks and tocks every
    second: the tag swings, its hand moves, and a soft tick sounds. Its colour is Haircut's daily-pick clock: green,
    orange from 6 hours left, red from 2 hours. In the last ten minutes the card glows red and the box beats.
  - after the video the box shakes, the lid flies off with a rustle and a pop, and the product rises out of the box
    in a flash, with confetti over the whole screen and a sparkling chime. The clock stops, then swings away.
  - the button becomes a green arrow. It closes the card, and the colour is already selected in its tray, like
    any other. Opened again the same day, the card shows the open box with the product and the arrow.
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
- **Many colours (owner, 19–20 October 2026: no colour cut off on any screen; at most six at a time; the arrows
  quieter than the colours).** A tool shows its colours six to a page, its newest colours of the day first (the
  one just earned is on the first page), then its base colours. In portrait the page is one row between two arrows
  (five or four colours on the narrowest phones, so they never crowd); at the side and on a tall counter it is two
  rows of three with the pair of arrows below. The arrows are bare chevrons in a soft ink, with no button around
  them. They darken when pointed at or pressed, and the one with nowhere to go fades out without moving anything.
  Each has a tap area at least 30 px across on screen. A finger swipe, a mouse drag or a wheel flick also turns
  one page, and a drag never picks a colour. A tool opens on the page holding its picked colour. Nothing scrolls,
  and there are no badges on the colours. The picked colour's ring clears its neighbours, the arrows and the
  counter's edges. `tests/layout.mjs` checks all of this on all 30 screens with every colour earned (85 lipsticks and
  glosses), and `tests/game-smoke.mjs` turns the pages with the arrows, a swipe, a drag and the wheel.
- **Narrow, tall screens** (such as 225 × 800 and 320 × 1120): as on phones, her face fills the space above the
  counter. The canvas can be as narrow as 0.4 × its height, a close-up where her face fills the width and her hair
  runs off the sides. Only on screens taller still does the spare height go to the counter, which then holds
  bigger tools in two rows of four, the colours in wrapping rows of bigger swatches, and in review Retry above
  the Next row (the same size as the Next arrow). Create and review keep the same counter, so her face doesn't
  move.
- **The daily pop-up** (owner, 20 October 2026: perfectly placed on every screen) is designed at 290 × 400 and scaled
  as one piece: at the UI scale, shrunk only to keep 16 px clear of every edge of the safe area. It sits in the
  exact centre of the safe area, and its close button is inside the card, so the card's outline is the whole
  pop-up. `tests/layout.mjs` checks on all 30 screens that the margins on opposite sides are equal (within a
  pixel) and at least 16 px.
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

## Sound (owner decisions, 19 October 2026: satisfying ASMR sounds, no music; real recordings, free of copyright)

The tools and the taps on the face are **real recordings, all CC0** (public domain, from Freesound; each credited
in [ASSETS.md](../ASSETS.md)). `tools/make-sounds.py` (`npm run sounds`) fetches each one, checks that its page still
says CC0, cleans it and cuts it into its **units**, its single movements: one brush swish, one lipstick rub, one
gloss swipe, one burst of mascara bristles, one pencil stroke (each the rise and fall of the tool's sound around one
peak, starting with its sound, not a slow build-up). Pops and knocks are left out; the most typical units of every
length are kept (short, medium, long and longest in turn, about 3 s a tool), so a quick flick and a long, slow sweep
each find a unit of about their length; each is evened to the same level (crackly ones, the mascara's bristles and
the gloss, have their sharpest ticks softened so none sounds like a click), and they are saved with silence between
them (`assets/sounds/*.mp3`, mono, 56 kbit/s, 27–34 KB a tool); the game finds each unit by that silence. The files
load with the face.

**The sound keeps time with the hand, not with the recording.** Every sweep of the hand plays one unit: a fresh one
when the hand turns back (brushing back and forth: swish, swish, in time) or moves on after a pause. The game learns
how long the hand's sweeps take and picks a unit of about that length (one of the three closest, never the same twice
running), played up to 15 % faster or slower to fit and running a little past the sweep, so the turn, not the
recording, brings the next movement. It also learns how far the sweeps reach, so from how far and how fast this one
has gone it knows when the hand will turn. A sweep that outlasts its unit carries on **legato**: the next unit joins
in past its attack and the two cross-fade, so it sounds as the same movement going on, never a new swish mid-sweep;
it is fitted to the rest of the sweep, and none starts just before a turn. The timing runs on the hand's own clock
(the pointer samples' times), so a busy frame never sounds like a pause.

| Tool | Recording |
| --- | --- |
| Soft brush | A makeup brush on skin |
| Highlighter | A softer, airier brush pass |
| Pencil | A soft pencil stroke (recorded on paper, softened towards skin) |
| Liquid liner | Fine felt tips (on paper, softened and quietened) |
| Mascara | A mascara wand's bristles, recorded close in a studio (plays while it passes through lashes, coated or not) |
| Lipstick | A creamy rub on skin; gloss: lip gloss being applied (swipes only) |
| Face gems | A tap on glass (glass gems; iridescent ones a little brighter), a small hard click (pearls), a jewellery click (metal) |
| Lenses | A single droplet |

No CC0 recording of lipstick going onto lips was found; the creamy rub is the closest real texture.

- **The process only (owner, 19 October 2026: "the sound you can hear during the process is okay"; a sharp sound at
  the end of a lipstick or gloss stroke was not).** A new movement (a stroke's start, or a turn back) only sounds once
  the hand has really travelled 4 px in its direction, so a finger slipping back as it lifts, or a touch that barely
  moves, makes no sound (before, that slip started a fresh unit that was cut off at once: a short, sharp burst). A
  stroke's end fades gently, never cut. The recordings' sharp transients (gloss's sticky pops, lip smacks, the
  highlighter's and mascara's sharpest ticks) are softened when the units are cut (`declick` in
  `tools/make-sounds.py`), leaving only each tool's even texture: lipstick, brush, pencil and liner have no sharp
  spot left, gloss and highlighter two faint ones (gloss had 44), and mascara keeps only the soft tick of its
  bristles (37, from 124). Each recording is downloaded once from Freesound, paced and patient with its rate limit,
  and kept in `build/freesound` for rebuilds. `tests/sound.mjs` checks that nothing starts as the finger
  lifts or for a barely-moving touch.
- **Speed and stopping.** The hand's speed is measured on the face (decimetres a second, the same on every
  screen): faster plays the unit louder and brighter, as friction does. The sound fades when the hand stops or
  leaves the face. No two gems ring quite alike (a small random pitch).
- **The controls** are synthesised: a soft tactile click when a tool is picked up, a tap when a colour is chosen,
  a pop as the colour of the day opens, a whoosh as the next customer sits down, a rising sparkle for an earned
  colour, and a low soft bump when something is refused. The finish keeps Haircut's bell chime.
- **Levels (owner, 19 October 2026: the tools were too loud):** the tools are quiet and close, about −45 dB on
  average and peaking at 0.03–0.07 of full scale, under the controls (0.12) and the finish chime (0.26). A gentle
  compressor keeps many small sounds from clipping.
- **Checks:** `tests/sound.mjs` (`npm run test:sound`) renders every sound offline with a hand brushing back and
  forth at a known tempo, then resting, then sweeping slowly: every tool's recording splits into several units, a
  fresh movement (a unit with its attack) begins within 60 ms of every turn of the hand and none inside a sweep (a
  long sweep carries on legato), units never stutter (no two movements within 60 ms, no two units closer than 0.1 s
  inside a sweep), it is silent while the hand rests, and the tools peak under the controls. It
  writes `tests/out/sounds/*.wav` to listen to.
- **Audit in the real game (19 October 2026, owner: "play the game and audit the sound waves").** The built game
  was played in a browser by a scripted hand (every tool: six quick sweeps, a rest with the hand down, three slow
  sweeps, eased into each turn like a real hand; then gems and a lens) and its output recorded losslessly. Found and
  fixed: the brush and lipstick units were mostly 0.13–0.18 s dabs, so a sweep chained two to four of them and
  stippled (longer units now: a second brush recording, a spread of lengths); the mascara went silent after its
  first pass (it sounded only while adding a coat); some units began with a slow build-up, coming in late at the
  turn; crackly units lost up to 8 dB to the limiter; a long sweep's second unit restarted with a fresh swish just
  before the turn. Now: one attack per sweep, 17–41 ms after the hand reverses on quick sweeps and 80–100 ms on slow
  ones (where the hand barely moves at the turn), true silence at rest, every unit at the same level, no clipping.
  The browser game test checks that all 11 recordings load, a stroke
  plays its recording, and nothing plays, not even a tool's click, while the host has sound off.

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
- **Catalogue:** 365 colours of the day (`DAILY` in `src/makeup/palette.js`), a full year of daily offers: every
  coherent colour each tool can carry beyond the basic base (owner decisions, 19 October 2026). Mascara, lenses and
  highlighter are near their natural limits (colour on thin lashes blurs; iris colours and highlighters are narrow
  families); the year's depth is in lips, gems, eyeshadow and liners, where real products span almost every colour
  and finish. Beyond about this many, new colours would be near-duplicates of old ones, not worth a video.
  - 84 brush: pinks, reds, corals, purples, blues, greens, earthy and cool mattes, neons, and 31 shimmers, metallics,
    pearls and glitters
  - 16 highlighter: rose gold, rose, pink, peach, coral, champagne pink, sunbeam, topaz, copper, deep bronze, lilac,
    amethyst, opal, icy blue, aqua, mint
  - 36 pencil
  - 38 liquid liner: brights and darks, 6 metallics and 9 glitters
  - 22 mascara
  - 79 lip: nudes, deeps, brights and fantasy shades, metallics, 18 tinted glosses and glitter top coats
  - 68 face gems: coloured and iridescent stones and metal studs, drops, hearts, stars, flowers and pearls in glass,
    iridescent glass, pearl and metal
  - 22 lens

  `tests/makeup.mjs` checks that every pair of colours within a tool, base included, is tellable apart (CIELAB
  ΔE ≥ 8 for the same finish, ≥ 4 across matte, gloss and shimmer).
- **Rotation:** the tool families take turns day by day.
- **All earned (owner, 19 October 2026):** once every colour of the day is the player's, the gift button goes away
  for good (on earning the last one, when its card closes). Nothing is left to offer, so nothing asks for a video.
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

**Size:** the game page is 656 KB (of which the recordings are 188 KB) (`tests/size-budget.mjs`, game budget 1 MB).

## Not built yet

- **Localisation:** the contract asks for the host language, and the final locale list is still to be decided.
  English only for now.
- **A first-use hint.**
- **Score reporting:** `engagement.sendScore` with acknowledged completions.
- **Real-host and device checks:** YouTube's Playables test suite, permitted test inventory, physical phones,
  and other browsers.
- **Context loss:** rebuilding the paint after a lost WebGL context.
