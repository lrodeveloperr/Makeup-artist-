# Makeup painting tools

Status: **prototype, locally verified.** The seven tools and the lens selector work on every generated face, by
mouse and by touch, in the developer preview (`preview/`). The look is stored as compact, validated data and
rebuilds exactly from a save. The game around the tools (review, saves, ads, the colour of the day) is in
[GAME.md](GAME.md). The preview's toolbar (`preview/`) is a test harness; the game screen is `game/`.

Contract sections: §2 (tools, lenses, input), §3 (completion predicate), §4 (colour catalogue), §8 (save
representation and limits).

## Code

| File | Role |
| --- | --- |
| `src/makeup/tools.js` | Fixed tool constants, the dab falloff (shared with the shader), per-dab rate, `DabWalker`, the liner's `TaperWalker` |
| `src/makeup/palette.js` | Colour catalogue with stable ids, per tool and for the lenses; the new-save selection |
| `src/makeup/makeup.js` | The makeup state: validation, immutable updates, limits, the completion predicate, the saved form |
| `src/makeup/picker.js` | What the pointer touches: skin (with its reference-body point), eyeball and iris, the lash plane |
| `src/makeup/paint.js` | Paint textures in the head's UV layout; draws dabs; live and replayed strokes |
| `src/makeup/applicator.js` | Turns pointer samples into stored points, paints them, records strokes, places gems, restores a saved look |
| `src/makeup/gems.js` | Face gems: finds a gem's place on the current face and draws the gems as small faceted 3D pieces |
| `src/makeup/input.js` | Pointer events: one captured primary pointer, coalesced samples, commit and cancel, lens and gem taps, where the tool works (a finger's tip above it; a mouse's pointer, hovering too) |
| `src/makeup/tools3d.js` | The tool in hand: each tool as a 3D model lit like the face, at her scale, drawn where it works |
| `src/face/lashes.js` | Mascara coats on the lashes (`coat`, `resetCoats`) |
| `src/face/skin-material.js` | Shades the painted colour, the gloss coat over it, shimmer and glow on the skin (`uPaint`, `uCoat`, `uFinish`) |

## The tools (fixed; no size, opacity, intensity or pressure settings)

Distances are on the face, in the reference body's frame. The face is about 13 cm wide, so a tool covers the same
part of every face at any screen size.

| Tool | For | Footprint | Edge | One pass leaves | Passes 1 / 2 / 3 / 5 | Stored point step |
| --- | --- | --- | --- | --- | --- | --- |
| Soft brush | Blush, bronzer, contour, eyeshadow, face colour | 9 mm radius | Gaussian, fully soft | 30 % | 30 / 51 / 66 / 83 % | 2 mm |
| Highlighter | The high points: cheekbones, nose, brow bone, cupid's bow | 5.5 mm radius | Gaussian, fully soft | 35 % of its glow (its sheer colour builds at a fifth of that) | 35 / 58 / 73 / 88 % | 1.5 mm |
| Detail pencil | Brows, soft eyeliner, fine lines, face art | 1.1 mm radius | Crisp (falloff from 70 % of the radius) | 85 % | 85 / 98 / 100 / 100 % | 0.7 mm |
| Liquid liner | Crisp liner, wings and flicks, graphic lines | 1.2 mm radius, tapering to 30 % at both ends | Very crisp (from 88 %) | 95 % | 95 / 100 / 100 / 100 % | 0.6 mm |
| Lip applicator | Lipstick and gloss (anywhere on the face; off-lip marks are allowed) | 3 mm radius | Medium (from 50 %) | 55 % | 55 / 80 / 91 / 98 % | 0.8 mm |
| Mascara wand | Lashes | Touches lashes within 3.2 mm of its path (the width of its brush) | – | Each stroke adds one coat to each lash it touches: colour moves 80 % towards the mascara, length +16 % (up to 150 % of natural), thickness +55 % (up to 2.4×), so one coat shows at a glance (owner, 20 October 2026) | – | 1 mm |
| Face gems | Rhinestones, drops, hearts, stars, flowers and pearls | One gem per tap, 8–13.5 mm across | – | – | – | One point per gem |

- **Dabs.** A stroke places dabs every 20 % (brush, highlighter), 30 % (pencil), 15 % (liner) or 25 % (lip) of
  the radius along its path.
  Each dab's opacity is set so that one straight pass leaves the "one pass" value along the middle of the path
  (`dabRate`). The speed of a stroke doesn't change how much colour it leaves.
- **Order matters and build-up is bounded.** Each dab is laid over what is there. Repeated passes approach the
  colour (1 − (1 − pass)ⁿ) and never exceed it. A new colour covers older marks only where it is applied; it never
  recolours earlier marks.
- **Finishes are properties of a colour, not settings.** Gloss on the glosses (below). Shimmer (a soft sheen in the product's colour plus fine glints fixed to the skin) on
  champagne, gold and pearl (brush) and gold (pencil). Glow (highlighter): the high points catch the light in a
  broad, pearly lustre in the product's tint, with fine glints; where the light doesn't reach, little shows. Sheer
  products (champagne, pearl, every highlighter) build their pigment more slowly, but their shimmer and glow at
  full rate.
- **Lipstick and gloss mix the same in either order (owner, 19 October 2026: "the mix has to be spot on,
  regardless of whether the person applies A or B first").** As on real lips, lipstick is the colour and a gloss is a
  clear, lightly tinted coat over it. A gloss paints only its own coat layer and lipstick only the pigment layer, and
  the skin shader always lays the coat on top, so gloss then lipstick gives exactly the paint and the face of
  lipstick then gloss (the browser smoke test checks clear, tinted and glitter glosses, value for value and pixel for
  pixel). Under the coat, the colour looks deeper and richer, as anything does under a wet film. The coat's tint is
  mostly a dye that filters what is under it, plus a little pigment that lightens it towards the gloss's colour:
  pink gloss over red lipstick gives a raspberry red, clear gloss keeps the red and deepens it. Each gloss's `tint`
  (how strongly it colours what is under it once built up) is 0 for clear gloss, 0.2–0.5 for light and glitter
  glosses and 0.7 for red, berry and plum, so a gloss never covers a lipstick and on bare lips reads as a sheer
  wash of its colour. Its shine is a clear lacquer: a sharp, bright reflection of each light over the lipstick's own
  satin sheen, and the room glancing off the film. Glitter belongs to the coat, so a lipstick put on after a glitter
  gloss keeps the glitter. Two lipsticks, or two glosses, still layer in the order applied.
- **The liner tapers.** Every segment of a liner stroke thins to 30 % of its width over its first 2 mm and its
  last 7 mm, so a flick ends in a sharp wing tip (`TaperWalker`). The end isn't known while the pen moves, so the
  dabs within 7 mm of the pen wait (a few pixels behind it) until the line goes on, or until the pen lifts and
  they're drawn thinning to the tip. Live painting and replay feed it the same points, so both draw the same dabs.
- **Where paint goes.** The brush, highlighter, pencil, liner and lip applicator paint any visible skin of the face, ears, neck and
  chest. There are no "correct" regions, so asymmetric and off-lip marks are allowed. The eyeball, the skin under
  the outfit and empty space take no paint: the pen lifts there and puts down again when the pointer returns. The
  pencil and the liner, traced along the lashes, keep to the lid's edge where the pointer slips just onto the eye
  (within 45 % of the eye's radius), so a line along the lash line is one unbroken line; a stroke across the middle
  of the eye still draws nothing there.
  Strokes pass under hair to the skin. The mascara wand works only on lashes. A wand stroke that touches no lash
  is not stored.
- **Face gems.** Select a gem and tap the skin: the gem sticks there, facing out from the skin and upright to the
  face, and catches the salon lights in its facets (glass, iridescent glass, pearl or metal). A drag, the eyes, the
  outfit and empty space place nothing. Each tap is one gem; a face holds up to 200. On a phone the gem is aimed
  (below).
- **Contact lenses.** Select a lens colour and tap an iris. Each eye is independent. A tap anywhere else, or a
  drag, does nothing. A lens never changes the makeup. On a phone the lens is aimed (below).
- **The tool in hand (owner, 19 October 2026: "as you are moving your hand, you are seeing the tool actually
  work"; the tool's graphics must match the face's, and how it is held must be right with a mouse and on a touch
  screen).** The selected tool is drawn where it works as a 3D model (`src/makeup/tools3d.js`) in real proportions
  at her scale (the owner preferred real size to a smaller tool, 20 October 2026): the brush's tuft, a real fan brush
  (its bristles fanning out from a flat ferrule), the pencil's lead, the liner's felt tip, the mascara's brush, the
  lipstick's slanted bullet (wound up about 1.5 cm, as far as a woman winds it to use), tweezers holding the gem (the
  placed gems' own geometry and material), a contact lens. The fan brush is held as it sweeps highlighter along the
  cheekbone: its fan lies along the bone, which rises outwards, so its handle runs down and away from the middle of
  her face, on whichever side it is (with a mouse; under a finger it leans right like every other tool, owner, 20
  October 2026, as leaning left upset its alignment over the finger). It is lit by the face's three lights, sky and ground, with her tone mapping,
  colour space and camera perspective, so a brush's tuft is as wide as the stroke it paints and the lens as wide as
  an iris; a soft shadow falls down and to the right, as from her key light. It is drawn once for each tool, colour
  and grip, then moved with the pointer.
  - **Mouse or pen:** the tool takes the cursor's place over her face, its tip exactly at the pointer, from the
    moment it is over her (so the player aims before pressing), held at a pen's angle; strokes, gems and lenses go on
    at the pointer. Off her face the cursor comes back.
  - **Finger:** a finger covers what it touches, so the tool works at its tip, held a little above the finger
    (owner, 20 October 2026: the balance between the finger and seeing the tool, part of the ASMR, so it feels held
    rather than like painting with the finger; a one-finger game, so the sweet spot is slightly above the finger or
    thumb, not too high). As an offset cursor (Potter, Weldon and Shneiderman, 1988; Vogel and Baudisch's Shift,
    2007, which notes that a fixed offset costs speed and reach, so it is kept as small as clears the finger): the
    reported touch point is the middle of the contact, the fingertip reaches about half the contact's height above
    it, so the tip sits at half the contact's height plus 25 px (about 4 mm on a phone: the nail and a small gap),
    from 48 px (a forefinger, about 8 mm: the owner found 44 px too low and 54 px too high) to 66 px (a thumb, about
    10.5 mm), 51 px where the device gives no contact size, and at most 16 % of the face's height in a tiny embed.
    Across, the tip is set back by 1.5 times the tool's lean as drawn, so the tool shows over the finger rather than
    beside it (owner's pick on a phone, 20 October 2026: about 20 px for a forefinger). A contact lens is held nearer,
    at 85 % of that height (owner, 20 October 2026: it was too high; 85 % was the pick on a phone). (It was 72 px,
    then 44 px when paint landed away from the finger; the zones below now keep the paint where it belongs, so the tool can stand clear of the
    finger again.) Its handle runs down to
    the finger, while the finger is down. Strokes paint at the tip from the moment the finger drags; a touch that
    lifts without sliding leaves one dab. A gem or a lens shows at the tip from the touch and goes on where the
    finger lifts (press, aim, release), since a tap under a finger cannot be aimed. On a touch screen the selected
    tool is drawn ahead, as soon as the face is ready, so it appears the moment the finger lands.
  - **A finger is assisted; a mouse or a pen is free** (owner, 20 October 2026: on a touch screen there is almost
    no margin for error, since the tool works the moment it is dragged). Under a finger each tool paints only in
    its own zones of the face, and a stroke stays in the zone it starts in: a slip onto the nose or the eye paints
    nothing (the pen is up outside the zone, and comes down again if the finger comes back). The zones are drawn
    once on the reference head (`game/zones.js`), so they fit every face, and they hold the points a stroke passes
    through, so a tool's soft edge reaches a little past them, as a real brush does:

    | Tool | Zones (each side separately) |
    |---|---|
    | Brush | the upper lid, from the lashes up to under her brow, its shadow reaching a little past the outer corner; the apple of the cheek |
    | Highlighter | the top of the cheekbone; the bridge of the nose; under the brow's tail; the cupid's bow |
    | Pencil | her brows (her own brow shape, 2 mm round it); along the lashes |
    | Liner | along the lashes, upper and lower, and a wing rising from the outer corner |
    | Lipstick and gloss | the lips, kept 0.8 mm inside their outline |
    | Mascara | the lashes (as with a mouse) |
    | Lens | the iris (as with a mouse) |
    | Gems | her face, but not her lips, ears or neck |

    The liner's wing is captured the same way (a stroke near its sharp tip slides along it rather than leaving a
    dot). The highlighter's glow has a soft sheen from the room's light as well as the key light's lustre, so a
    stroke shows even where the key light falls away (under the brow's tail).
    No tool is forced (owner, 20 October 2026: some tools felt as if they had to be forced to work): a finger that
    strays up to 6 mm outside the zone it is painting, or lands up to 6 mm outside one, is moved in to the zone's
    edge (towards a point inside it, such as the middle line of her brow or cheekbone), so the paint slides along
    the edge as along a stencil, and a stroke that starts just beside a zone starts at its edge; further out the pen
    is up. With a finger wobbling ±3 mm along each feature, every tool now paints on 97–100 % of its samples (the
    cheekbone's highlighter and the brow pencil were refused on up to 60 % before). A straight pencil line across an
    arched brow follows the arch.
    Along the lashes the liner and the pencil paint where the tool is, anywhere in the lash band (about 8 mm round
    the eye), up or down, on either eye (owner, 20 October 2026: drawing in the lit band must work there). Only a
    point too close to the lashes for a line to show is moved out to where it shows (`toLashes`: the lid's edge found
    on screen, then 3.2 mm onto the upper lid, as seen from the front the lashes hide about three millimetres of lid,
    or 1 mm below the lower lashes); until then any point in the band was pulled onto the lash line, so a line drawn
    in the band did not follow the tool. While a
    finger is down, the selected tool's zones light up faintly (`ZoneGlow`), so the rule needs no words. Painting
    redraws only the patch round the stroke; the patch covers where guided or captured paint actually lands, so it
    shows while the finger is still down on any screen.
    `tests/zones.mjs` (`npm run test:zones`) checks the integrity on three faces, on a grid every 6 px over the face:
    every point in a tool's zones paints under a finger, the paint shows (the picture changes where it went), and
    nothing a finger stores lies outside the tool's zones; gems go on the face, never the lips. Run on 12 faces
    while building it, the pencil painted every one of its zone points, visibly, on every face. The stored
    strokes are ordinary points, so a restored look replays exactly, and the save format is unchanged.

### Colours (base catalogue, all available from the start)

The base catalogue is the basics only (owner decisions, 19 October 2026): a starter kit that suits every
complexion and matches every natural hair and eye colour in the game (`src/makeup/palette.js`):
- brush 6: rose, peach, berry, bronze, taupe, charcoal
- highlighter 4: pearl, champagne, gold, bronze (a glow for every skin tone)
- pencil 5: black, espresso, brown, auburn, blonde
- liquid liner 2: black, brown
- mascara 2: black, brown
- lip 7: nude, rose, pink, red, berry, brown, and a clear gloss (owner, 20 October 2026: every player can try gloss
  over a lipstick from the start; the tinted, shimmer and glitter glosses are colours of the day)
- face gems 4: crystal, pearl, gold star, pink heart
- lenses 5: brown, hazel, green, blue, grey

Every other coherent colour each tool can carry (coral, plum and mauve, a white pencil, honey lenses, coloured and
glitter liners, pink to opal highlighters, stones, drops, hearts, stars, flowers and pearls, and the shimmers,
glosses, metallics, brights and fantasy shades) is one of the 365 colours of the day (`DAILY`). One is
offered each day and kept for good once earned ([GAME.md](GAME.md)), and a tool lists the player's earned ones
first. The swatches show gloss and shimmer; a gem's swatch is the gem.
The selected colour of each tool is remembered while switching tools. A new save starts with the soft brush in
Rose (contract §3).

## How painting works

- **Texture space, measured on the body.** Paint lives in three 1024 × 1024 textures laid out like the head's UV
  map: colour (the pigment layer, premultiplied), coat (the gloss's tint and shine) and finish (the coat's tint
  strength, shimmer, glow, the coat's glitter). All are half-float where the device can render to them,
  with an 8-bit fallback. A dab is drawn by rendering the head mesh into the texture and measuring each texel's
  distance to the dab's centre on the reference body. Dabs are therefore round on the face, have the same size on
  every face, and continue across UV seams.
- **Only where the dabs reach.** Each batch of dabs draws only the head's triangles that come within its dabs'
  radius (found in a grid of the triangles' reference-body bounds), clipped to those triangles' texels, instead of
  the whole head into both whole textures: about 1 ms a pointer sample in software WebGL instead of 95, and on a
  phone's GPU a few hundred texels a sample instead of two million. The result is exactly the same (the browser
  smoke test paints every surface tool both ways and compares every value). Drawing the whole head each sample had
  backed the GPU up while painting, holding back the next frames and the input that waits for them (the first gem
  tap after a long session sounded 0.7–1.7 s late in the sound audit; now 23 ms).
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
- A finger works at the tool's tip, above it, and is kept to the tool's zones (see the tool in hand, above): the
  game draws the tool there through `attachInput`'s `aim` hook and gives the zones through the applicator's `zones`
  hook (`begin` and `tapGem` take `assisted`, true for a finger). The preview has no zones: a finger is free there.
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
for the wand. A face gem is a stroke of one point (where it sits on the reference body). Every update returns a
new state, and invalid input (wrong tool for a colour, unknown ids,
non-integers, empty or oversized segments, out-of-range values) leaves the state unchanged. `decodeMakeup`
rejects any save that is not exactly valid; it never repairs one.

**Saved form** (`encodeMakeup` / `decodeMakeup`): JSON with each stroke as `"<colour id>:<points>"`. The tool is
the colour's own tool. The points are zigzag varints written five bits per URL-safe character: the first point,
then the differences between neighbouring points, which are a tool step apart and usually take one character per
coordinate. An id keeps its colour and finish forever once released.

**Measured maximum-work session** (`tests/makeup.mjs`). 500 strokes and about 164 dm of path, drawn through the
real sampling code at the game's framing, and a face full of gems:
- 160 brush strokes of 4.5 cm
- 40 highlighter strokes of 3 cm
- 140 pencil strokes of 2 cm
- 60 liner strokes of 2 cm
- 60 lip strokes of 5 cm
- 40 mascara strokes of 2.5 cm
- 200 gems
- both lenses

That is a full look several times over. It stores **11,768 points in 53,421 bytes**, below the contract's 64 KiB
normal save target.

**Limits** (`LIMITS` in `makeup.js`):
- 4,000 strokes.
- 100,000 points in total. That is about ten maximum-work sessions, and about 420 KB saved at the measured density
  (the platform recommends saves under 500 KiB and requires under 3 MiB).
- 16,384 points and 512 segments per stroke.
- 200 gems on a face.

Within the limits nothing is dropped or simplified. Past them, new strokes are refused. Before release, a raster
checkpoint could replace this refusal for players who go far beyond ordinary play.

## Completion predicate (contract §3)

`isChanged(state, naturalIris)` is true when a stroke or a gem is stored, or when a lens differs from the face's natural
iris colour. Selecting a tool or colour, a stroke that touched nothing paintable, a wand that missed every lash,
or a lens matching the natural iris does not count.

## Verification

- `node tests/makeup.mjs` (in `npm test`), 17 checks:
  - catalogue ids, colours and default selection
  - tool constants (every highlighter sheer and glowing)
  - even dab spacing independent of pointer sampling
  - the liner thins to a point at both ends, however the path is sampled, and holds back only its tip
  - one pass leaves the stated opacity, passes build up but never exceed the colour, sheer builds more slowly
  - live dabs equal replayed dabs
  - stored-point spacing and pen-up/re-entry segments
  - no storage for a missed wand or under the outfit
  - validation and limits
  - lossless saved form, with 2,000 corrupted saves refused without exceptions
  - the maximum-work session under 64 KiB
  - face gems: one point per tap; nothing off the skin, under the outfit, for a colour not earned or past 200
  - lenses and the completion predicate
  - mascara: one coat per stroke, caps, reset
  - picking on a real face (skin points pick themselves, iris vs white)
- `node tools/build-preview.mjs && node tests/render-smoke.mjs`, in Chromium:
  - Every tool, a gem and a lens change the face. Pixels away from the face don't change.
  - A reset gives back the clean face exactly.
  - A restored save matches the live look pixel for pixel (max channel difference 1), liner tips and gems
    included.
  - A real mouse drag adds a stroke.
  - By touch: one finger paints, a second finger adds nothing, a lens and a gem apply on a tap but not on a drag,
    and the page never scrolls, pans or zooms.
  - Partial redraw: strokes drawn with only the painted patch redrawn match a full redraw (allowing for the few
    values two full redraws already differ in).
- Download: the face system and the makeup tools together are 405 KB (`tests/size-budget.mjs`; the face budget
  is 420 KB, raised from 400 KB when the highlighter, liquid liner and gems and their colours added about 12 KB).

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
