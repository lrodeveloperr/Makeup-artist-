# Makeup painting tools

Status: **prototype, locally verified.** The four tools and the lens selector work on every generated face, by
mouse and by touch, in the developer preview (`preview/`). The look is stored as compact, validated data and
rebuilds exactly from a save. The game around the tools (review, saves, ads, the colour of the day) is in
[GAME.md](GAME.md). The preview's toolbar (`preview/`) is a test harness; the game screen is `game/`.

Contract sections: §2 (tools, lenses, input), §3 (completion predicate), §4 (colour catalogue), §8 (save
representation and limits).

## Code

| File | Role |
| --- | --- |
| `src/makeup/tools.js` | Fixed tool constants, the dab falloff (shared with the shader), per-dab rate, `DabWalker` |
| `src/makeup/palette.js` | Colour catalogue with stable ids, per tool and for the lenses; the new-save selection |
| `src/makeup/makeup.js` | The makeup state: validation, immutable updates, limits, the completion predicate, the saved form |
| `src/makeup/picker.js` | What the pointer touches: skin (with its reference-body point), eyeball and iris, the lash plane |
| `src/makeup/paint.js` | Paint textures in the head's UV layout; draws dabs; live and replayed strokes |
| `src/makeup/applicator.js` | Turns pointer samples into stored points, paints them, records strokes, restores a saved look |
| `src/makeup/input.js` | Pointer events: one captured primary pointer, coalesced samples, commit and cancel, lens taps |
| `src/face/lashes.js` | Mascara coats on the lashes (`coat`, `resetCoats`) |
| `src/face/skin-material.js` | Shades the painted colour, gloss and shimmer on the skin (`uPaint`, `uFinish`) |

## The tools (fixed; no size, opacity, intensity or pressure settings)

Distances are on the face, in the reference body's frame. The face is about 13 cm wide, so a tool covers the same
part of every face at any screen size.

| Tool | For | Footprint | Edge | One pass leaves | Passes 1 / 2 / 3 / 5 | Stored point step |
| --- | --- | --- | --- | --- | --- | --- |
| Soft brush | Blush, bronzer, contour, eyeshadow, highlighter, face colour | 9 mm radius | Gaussian, fully soft | 30 % | 30 / 51 / 66 / 83 % | 2 mm |
| Detail pencil | Brows, eyeliner, fine lines, face art | 1.1 mm radius | Crisp (falloff from 70 % of the radius) | 85 % | 85 / 98 / 100 / 100 % | 0.7 mm |
| Lip applicator | Lipstick and gloss (anywhere on the face; off-lip marks are allowed) | 3 mm radius | Medium (from 50 %) | 55 % | 55 / 80 / 91 / 98 % | 0.8 mm |
| Mascara wand | Lashes | Touches lashes within 2.2 mm of its path | – | Each stroke adds one coat to each lash it touches: colour moves 55 % towards the mascara, length +8 % (up to 135 % of natural), thickness +25 % (up to 2×) | – | 1 mm |

- **Dabs.** A stroke places dabs every 20 % (brush), 30 % (pencil) or 25 % (lip) of the radius along its path.
  Each dab's opacity is set so that one straight pass leaves the "one pass" value along the middle of the path
  (`dabRate`). The speed of a stroke doesn't change how much colour it leaves.
- **Order matters and build-up is bounded.** Each dab is laid over what is there. Repeated passes approach the
  colour (1 − (1 − pass)ⁿ) and never exceed it. A new colour covers older marks only where it is applied; it never
  recolours earlier marks.
- **Finishes are properties of a colour, not settings.** Gloss (wet shine: lower roughness and a stronger
  highlight) on the glosses. Shimmer (a soft sheen in the product's colour plus fine glints fixed to the skin) on
  champagne, gold and pearl (brush) and gold (pencil). Sheer products (clear gloss, champagne, pearl) build their
  pigment more slowly, but their shine at full rate.
- **Where paint goes.** The brush, pencil and lip applicator paint any visible skin of the face, ears, neck and
  chest. There are no "correct" regions, so asymmetric and off-lip marks are allowed. The eyeball, the skin under
  the outfit and empty space take no paint: the pen lifts there and puts down again when the pointer returns.
  Strokes pass under hair to the skin. The mascara wand works only on lashes. A wand stroke that touches no lash
  is not stored.
- **Contact lenses.** Select a lens colour and tap an iris. Each eye is independent. A tap anywhere else, or a
  drag, does nothing. A lens never changes the makeup.

### Colours (base catalogue, all available from the start)

The base catalogue is the basics only (owner decisions, 19 October 2026): a starter kit that suits every
complexion and matches every natural hair and eye colour in the game (`src/makeup/palette.js`):
- brush 6: rose, peach, berry, bronze, taupe, charcoal
- pencil 5: black, espresso, brown, auburn, blonde
- mascara 2: black, brown
- lip 6: nude, rose, pink, red, berry, brown
- lenses 5: brown, hazel, green, blue, grey

Every other coherent colour each tool can carry (coral, plum and mauve, a white pencil, honey lenses, and the
shimmers, glosses, metallics, brights and fantasy shades) is one of the 163 colours of the day (`DAILY`). One is
offered each day and kept for good once earned ([GAME.md](GAME.md)), and a tool lists the player's earned ones
first. The swatches show gloss and shimmer.
The selected colour of each tool is remembered while switching tools. A new save starts with the soft brush in
Rose (contract §3).

## How painting works

- **Texture space, measured on the body.** Paint lives in two 1024 × 1024 textures laid out like the head's UV
  map: colour (premultiplied) and finish (gloss, shimmer). Both are half-float where the device can render to them,
  with an 8-bit fallback. A dab is drawn by rendering the head mesh into the texture and measuring each texel's
  distance to the dab's centre on the reference body. Dabs are therefore round on the face, have the same size on
  every face, and continue across UV seams.
- **Picking.** The camera is fixed while the player works. The skin's triangles are projected to the screen once
  per face, size or camera change and binned in an 8-pixel grid, so a pick tests only a few triangles and keeps
  the nearest. The eyeballs are exact spheres, with the iris told apart from the white. Picks hold on shared edges
  and vertices (no cracks).
- **Stored points.** Pointer samples, including coalesced ones, are interpolated every 2 screen pixels and
  projected onto the face. A point is stored once the pointer is the tool's step away from the last stored point,
  and the last sample is always stored when the pen lifts or the stroke ends. Live painting draws from the stored
  points only, so **live painting and replay from a save produce the same dabs** (a unit test checks they are
  equal; the browser test checks the restored look matches the live one pixel for pixel).

## Input (contract §2 input rules)

- One captured primary pointer applies at a time. Other fingers and non-primary mouse buttons are ignored. The
  canvas has `touch-action: none` and no context menu, so a stroke never scrolls, zooms or opens a menu.
- The tool and colour are captured at pointer-down and kept for the whole gesture.
- Pointer-up commits. Cancel, lost capture, resize or an interrupt (`input.interrupt()`, for a host pause or an
  opening panel) ends the gesture at its last applied sample and keeps that work. A new pointer-down is needed to
  continue.
- Stored marks are in face coordinates, so resizing or rotating the screen changes only the pointer mapping.
- There is no eraser, undo, clear or reset of the same face.

## Stored work and saves

State: `{ version, strokes: [{ tool, colour, segments: [[x, y, z, …], …] }], lenses: { left, right } }`, in
application order. Points are integers in tenths of a millimetre (Q = 1,024 per decimetre, a fifth of a screen
pixel at the game's framing). They are reference-body positions for skin tools and positions in the lashes' plane
for the wand. Every update returns a new state, and invalid input (wrong tool for a colour, unknown ids,
non-integers, empty or oversized segments, out-of-range values) leaves the state unchanged. `decodeMakeup`
rejects any save that is not exactly valid; it never repairs one.

**Saved form** (`encodeMakeup` / `decodeMakeup`): JSON with each stroke as `"<colour id>:<points>"`. The tool is
the colour's own tool. The points are zigzag varints written five bits per URL-safe character: the first point,
then the differences between neighbouring points, which are a tool step apart and usually take one character per
coordinate. An id keeps its colour and finish forever once released.

**Measured maximum-work session** (`tests/makeup.mjs`). 400 strokes and about 140 dm of path, drawn through the
real sampling code at the game's framing:
- 160 brush strokes of 4.5 cm
- 140 pencil strokes of 2 cm
- 60 lip strokes of 5 cm
- 40 mascara strokes of 2.5 cm
- both lenses

That is a full look several times over. It stores **9,381 points in 39,588 bytes**, below the contract's 64 KiB
normal save target.

**Limits** (`LIMITS` in `makeup.js`):
- 4,000 strokes.
- 100,000 points in total. That is about ten maximum-work sessions, and about 420 KB saved at the measured density
  (the platform recommends saves under 500 KiB and requires under 3 MiB).
- 16,384 points and 512 segments per stroke.

Within the limits nothing is dropped or simplified. Past them, new strokes are refused. Before release, a raster
checkpoint could replace this refusal for players who go far beyond ordinary play.

## Completion predicate (contract §3)

`isChanged(state, naturalIris)` is true when a stroke is stored, or when a lens differs from the face's natural
iris colour. Selecting a tool or colour, a stroke that touched nothing paintable, a wand that missed every lash,
or a lens matching the natural iris does not count.

## Verification

- `node tests/makeup.mjs` (in `npm test`), 15 checks:
  - catalogue ids, colours and default selection
  - tool constants
  - even dab spacing independent of pointer sampling
  - one pass leaves the stated opacity, passes build up but never exceed the colour, sheer builds more slowly
  - live dabs equal replayed dabs
  - stored-point spacing and pen-up/re-entry segments
  - no storage for a missed wand or under the outfit
  - validation and limits
  - lossless saved form, with 2,000 corrupted saves refused without exceptions
  - the maximum-work session under 64 KiB
  - lenses and the completion predicate
  - mascara: one coat per stroke, caps, reset
  - picking on a real face (skin points pick themselves, iris vs white)
- `node tools/build-preview.mjs && node tests/render-smoke.mjs`, in Chromium:
  - Every tool and a lens change the face. Pixels away from the face don't change.
  - A reset gives back the clean face exactly.
  - A restored save matches the live look pixel for pixel (max channel difference 1).
  - A real mouse drag adds a stroke.
  - By touch: one finger paints, a second finger adds nothing, a lens applies on a tap but not on a drag, and the
    page never scrolls or zooms.
- Download: the face system and the painting tools together are 385 KB (`tests/size-budget.mjs`; the face budget
  alone is 400 KB). The painting code adds about 21 KB minified.

## Known limits

- **Hair over painted skin.** Paint can go on skin under the hair, but the hair still draws over it, so a stroke
  near the hairline can look shorter than it is.
- **UV seams.** Texels just outside a UV island are not painted, so bilinear filtering can show a faint lighter
  line where paint crosses an island border. The face and scalp share one island. Check the seams around the ears
  and neck in the art pass.
- **Outfit edge flicker in software WebGL.** In software WebGL the outfit's anti-aliased neckline varies by a few
  pixels between frames. This hasn't been checked on GPU devices yet. The paint test hides the outfit while
  comparing pixels.
- **WebGL context loss.** The paint lives only in GPU textures. After a lost context the renderer must rebuild
  them with `restore(state)`; context-loss handling is not built yet.
- **Real devices.** Physical touch devices, other browsers and frame-time measurement on a mid-range phone are
  still to do (contract UI01, BROWSER01).
