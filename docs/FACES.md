# Generated faces: graphics and diversity system

Status: **prototype, locally verified**. It renders generated faces in the browser and passes the face audit and
render smoke test listed below. It does not yet include makeup painting, the game screens, saves, ads or the
YouTube adapter. Hair and the garment are procedural and work for every face, but they need an art pass before
release (see "Known limits").

![24 faces from the queue](face-gallery.jpg)

## Owner decisions this implements (18 October 2026)

| Decision | Value |
| --- | --- |
| Engine | WebGL2 through a small purpose-built renderer (`src/gl/mini.js`, Three.js-style names). Three.js was the first choice; it was replaced on 18 October 2026 under the owner's load-time priority because the face scene used only a sliver of it (the bundle fell from 558 KB to 95 KB). No Unity or Godot web build. |
| Presentation | One 3D head, seen by a fixed front camera ("2.5D"). There is no orbit control. A hidden debug orbit exists in the preview only. |
| Base asset | MakeHuman's CC0 base mesh and shape targets, at a pinned commit. No paid scans, no non-commercial academic models (FLAME, BFM, SMPL-X), no MetaHuman, no AI-generated or photographed faces. |
| Customers | Every face is a young woman with a clearly feminine face and head shape. No vitiligo, albinism or dyed hair. |
| Hair | Always long and visible (players prefer long hair): no short cuts, updos or head coverings. Natural colours from a per-ancestry colour table. |
| Outfit | Every customer wears a blouse or a dress, flat or patterned, in colours that flatter her complexion: never close to her skin colour, and never black or very dark shades on deeper skin. The outfit is part of the look the player works with. |
| Diversity | All ancestries. Ancestry profiles mix MakeHuman's sculpted female base heads and add tendencies over individual feature controls, never "race buttons". Face shape, skin and natural hair texture and colour stay coherent with the ancestry; individual variation keeps faces from one profile different. |
| Age | Young adults only (18–30). |
| Textures | Procedural shaders, with no shipped photo textures. |

## Pipeline

```
MakeHuman (CC0, pinned commit)      tools/makehuman/fetch.mjs        sparse git checkout into .cache/
  base.obj + 230 .target files    ─ tools/makehuman/build-head.mjs ─▶ assets/head.bin.gz (committed, reproducible)
                                                                     │
src/face/generator.js  seed ──▶ face record (plain JSON)            │
src/face/queue.js      variety director over seeds                  ▼
src/face/face-view.js  record ─▶ morph ─▶ subdivide ─▶ skin, eyes, brows, lashes, hair, outfit ─▶ src/gl/mini.js (WebGL2)
```

### Head asset (`assets/head.bin.gz`)

- The head and shoulders of MakeHuman's hm08 base mesh: 4,478 vertices and 4,452 quads, plus eye and lash
  helper geometry. Its reference shape is a 25-year-old blend of MakeHuman's female macro targets, with the three
  ethnic macro targets weighted equally.
- 96 dimensions (`tools/makehuman/dims.mjs`): MakeHuman's three sculpted young-female base heads (African, Asian,
  Caucasian), stored as offsets from the reference, and 93 **shape dimensions**. Each shape dimension is a signed
  value in [-1, 1] mapped to MakeHuman's
  `incr`/`decr` targets, with left and right merged into one symmetric dimension. The dimensions cover face
  outline, forehead, brows, eye size, spacing, tilt and lids (epicanthic fold, lid crease, hooding), nose (about 20
  controls), lips (about 20 controls), cheeks, chin, jaw, neck and ears. Each dimension's whole-head translation is
  stored separately and removed at runtime, so faces change shape without moving out of the camera framing.
- **Face-first UV layout.** The islands are rotated upright and packed. The face and scalp island gets most of the
  texture, and the eye sockets and inside of the mouth are packed small. Makeup painting will use this layout
  (`uPaint` in the skin shader).
- **Feature regions per vertex.** These are geodesic distance from the lip line and from the lid margins, plus
  masks for cheeks, under-eye, nose, ears and lips taken from the matching targets. Natural features use them, and
  painting can use them later.
- **Landmarks.** The asset stores eye centres and the lip outline. The vermilion (lip-colour) border is evaluated
  per pixel, so it stays crisp on every face.
- **Encoding (version 2).** Vertices and faces are in spatial (Morton) order. Positions are 16-bit, regions 8-bit,
  shape deltas 8-bit with one scale per dimension, and target indices are varint gaps. Positions, faces, UVs and
  deltas are stored as differences from their neighbours, and the file is gzipped. The browser inflates it with its
  native `DecompressionStream`, or with fflate (about 4 KB) where that is missing. Provenance (source file hashes,
  targets per dimension) is in `assets/head.manifest.json`, which is not loaded at runtime.
- Size: **243,991 bytes** (700,070 bytes inflated), down from 1,193,728 bytes in version 1. Building twice gives
  byte-identical output.

### Rendering (`src/face/`)

| Module | What it does |
| --- | --- |
| `../gl/mini.js` | The renderer: shader programs, buffers, alpha-blended passes, Khronos neutral tone mapping to sRGB |
| `head-data.js`, `subdivide.js`, `head-geometry.js` | Inflate and parse the asset, apply shape dimensions, run one Catmull-Clark subdivision step, and compute normals and a cavity term (cheap occlusion in creases) |
| `skin-material.js` | Wrapped diffuse with a red shift (a subsurface stand-in) and two specular lobes. Per pixel: natural lips, flush, under-eye tone, freckles, beauty marks, brow fill, a lash line, a painted hairline (matte, so it never shines through the hair), pores, and the `uPaint` hook for makeup |
| `eyes.js` | Eyeballs placed from MakeHuman's eye helpers and aimed at the camera. Procedural iris, set per eye (ready for contact lenses) |
| `brows.js`, `lashes.js`, `strands.js` | Short, groomed brow hairs rooted on the skin over a soft brow fill, and upper and lower lashes rooted on MakeHuman's lash helper lines. Upper lashes fan out and gather into small clumps; lower lashes are fewer and lighter. Each lash keeps its own parameters, ready for mascara |
| `hair.js`, `hair-material.js` | Procedural long hairstyles built from the morphed head (see below) |
| `garment.js` | The blouse or dress: one geometry per neckline (with straps or a frill where needed) and a shader for the patterns |
| `lighting.js` | One fixed "makeup station" light rig shared by every material |

### Generator (`src/face/generator.js`, `profiles.js`, `hair-styles.js`, `colors.js`)

A face record holds every resolved value. It is versioned (`GENERATOR_VERSION`) and fully deterministic from its
seed, so a save can store the record or just `{version, seed}`.

- **Origin.**
  - 75% of faces come from a single profile. There are 15 profiles: West African; East African; Southern and
    Central African; North African and Middle Eastern; Mediterranean European; Northern European; South Asian;
    East Asian; Southeast Asian; Central Asian; Indigenous Americas; Pacific Islander; Melanesian; Aboriginal
    Australian; Arctic Indigenous.
  - 25% are named blends: Latin American, Afro-Caribbean, Afro-Latin, South African Coloured, Central Asian ×
    European, Arab × East African, East Asian × European, South Asian × European.
  - Profiles are drawn evenly rather than by world population, so every session meets a wide range of people.
- **Shape.** Independent noise on about 90 sliders made faces look unnatural (long lower faces, squinting eyes,
  protruding mouths, egg-shaped crowns), and large slider offsets did not read as feminine. The shape model has
  four parts:
  - **Sculpted base heads.** Each profile mixes MakeHuman's three sculpted young-female heads (`BASE_HEADS`, for
    example South Asian = 65% Caucasian, 20% African, 15% Asian head). These carry most of the ancestry and look
    more natural than slider offsets, so profile slider tendencies are applied at half strength.
  - **Calibrated spread.** One standard deviation of a dimension moves the face by a fixed visible amount (about
    0.7 mm for small features, 1.2–1.4 mm for skull and structure). This uses each target's measured effect in
    `dim-impact.js`, which is generated from the asset and checked by the tests.
  - **Correlated factors.** Nine factors move related dimensions together: face width, face length, fullness,
    profile depth, eye openness, lip fullness, nose size, jaw strength and eye tilt. Independent noise is small on
    top of them.
  - **Feminine baseline.** Every face starts from the same young-woman point: a softer jaw and smaller chin, a
    slimmer nose, fuller lips with a defined bow, almond eyes with a relaxed upper lid and a lifted outer corner,
    higher brows over a smooth brow ridge, a smooth forehead, a slim neck and ears close to the head. Each face also
    leans towards an oval, heart, round or diamond outline.
  - Head top above the eyes spans 0.93–1.10 dm across 300 faces (it was 0.80–1.47 before calibration).
- **Skin.**
  - Tone is a continuous ramp that extends Haircut's ten anchor tones, with five undertones.
  - Freckles depend on fairness and red hair.
  - Beauty marks on about 44% of faces. No vitiligo or albinism (owner decision).
- **Eyes, brows, lashes.** Iris colour comes from the profile. Brows use five shapes with varied thickness, density
  and colour (derived from natural hair colour). Lash length, density and curl vary.
- **Hair.**
  - The profile sets natural texture (straight, wavy, curly, coily) and natural colour. Colour is a table of
    17 natural shades (jet black to platinum blonde, plus auburn, copper and strawberry blonde) with a weight per
    profile, for example: West African mostly jet black, soft black and darkest brown; Mediterranean mostly dark
    brown, chestnut and medium brown with some light brown, blonde and auburn; Northern European spread across
    browns, ash, honey, golden and light blonde, with some platinum, strawberry blonde, copper and auburn.
  - The style is drawn from the profile's long styles (`STYLES`), keeping only those that suit that texture.
  - No dyed colours. About 10% of faces have subtle highlights one natural shade lighter.
- **Outfit** (`outfit.js`). A blouse or a dress, chosen by complexion (skin depth and undertone), not by ancestry
  label:
  - **Palettes.** Fair skin with a cool undertone gets clear cool colours (navy, berry, cornflower, emerald,
    lavender, black, white…); fair skin with a warm undertone gets warm ones (coral, warm pink, teal, leaf green,
    rust, golden yellow…); medium skin gets rich colours (cobalt, terracotta, mustard, teal, fuchsia, burgundy…);
    deep skin gets saturated, bright and light colours (white, gold, cobalt, fuchsia, emerald, sky blue,
    lavender…). A few colours that make an undertone look sallow are dropped (olive and camel on olive skin,
    orange on pink skin).
  - **Rules.** Very dark colours (black, navy, charcoal, burgundy, plum) are never worn on deeper skin. No colour
    within a perceptual distance of 30 (CIELAB) of the skin is used, so the outfit never melts into the skin.
    Loud colours (lime, lemon) are accents only.
  - **Patterns.** Solid, two-tone (a contrasting neckline band and straps), stripes, dots, florals, gingham or a
    bold geometric print. The second colour is a neutral, a neighbouring hue or (for small motifs) the
    complementary hue, with enough lightness difference to read; two equally vivid mid-tones are never paired.
  - **Necklines.** Blouses: boat, scoop, ruffle or off-the-shoulder. Dresses: straps, off-the-shoulder, scoop or
    boat. Every neckline leaves the neck bare and follows where each face's body mesh ends.
- **Presentation.** Every face is feminine. Makeup tools work the same on every face.
- **Labels.** Profile ids are internal. Players never see them, and they never decide tools, colours, difficulty,
  scores or a "suggested look". The dev preview shows them for review only.

### Variety director (`src/face/queue.js`)

This picks each next face from up to 8 deterministic candidates. It scores each candidate against the last four
faces on origin, hairstyle, parting, skin-tone band, hair colour, outfit colour, iris and brow shape. Its state is
`{version, cursor, recent}` and survives a JSON save. It never stalls: after 8 candidates it takes the most
different one.

## Hairstyles

Every face has long hair (owner decision: players prefer it). Eight styles are built procedurally around each morphed
head, each offered only to the natural textures that suit it:

- Long straight and long layered (shorter face-framing layers): straight or wavy hair
- Long wavy: wavy, curly or straight hair
- Long curls: curly, wavy or coily hair
- Silk press (straightened natural hair), box braids, locs, and cornrows into long braids: coily or curly hair

Partings (middle, left, right or none), length, volume and highlights vary per face. The ends fall past the bottom
of the frame, over the shoulders and down the back.

Building blocks:

- **Hood.** The hair lying on the head: a shell around the skull, `lift` above it, sampled by direction from the
  hairline centre so that it rolls down onto the scalp exactly at the face's hairline. The hairline edge is
  evaluated per pixel with a little wispy breakup, and the parting is a shallow groove. The skin shader paints
  matte fine hairs under it.
- **Drape.** Sheets of hair hang from the shell. They never move back in towards the head, so the sides fall
  straight down from the widest part of the skull and over the ears instead of hugging it like a cap. Below the
  jaw they fall in front of or behind the shoulders. Two face-framing pieces leave the parting, sweep over the
  corners of the forehead and fall beside the cheeks.
- **Tubes** for box braids, locs and cornrow braids; a thin **cap** layer for the cornrows on the scalp.
- **Two-pass drawing.** Hair is drawn once for its solid parts (writing depth) and again for its soft fringes
  (blended, not writing depth), so nearly transparent edges never punch see-through holes in the hair behind.
- The outfit (`garment.js`) sits at the bottom of the frame. Below the end of the body mesh, the shoulders are
  continued outwards so the garment fills the frame. Patterns are laid out as seen from the front and
  anti-aliased, so they stay crisp at phone size.

## Commands

```sh
npm ci
node tools/makehuman/fetch.mjs          # only needed to rebuild the head asset
node tools/makehuman/build-head.mjs     # rebuilds assets/head.bin.gz + head.manifest.json (byte-identical)
node tools/makehuman/impact.mjs         # regenerates src/face/dim-impact.js after a head rebuild
node tools/build-preview.mjs            # build/preview; serve with: node tools/serve.mjs build/preview
node tests/unit.mjs                     # asset, generator and queue checks
node tests/face-audit.mjs 2000 300      # writes docs/FACE-AUDIT.md and docs/face-audit.json
node tests/size-budget.mjs              # download-size budget (fails over 400 KB total or 512 KiB per file)
node tests/render-smoke.mjs [--gallery] # Chromium WebGL render check; --gallery rewrites docs/face-gallery.jpg
```

Open `http://localhost:8130/` after `node tools/serve.mjs build/preview` and use Next / Back or the arrow keys.
`?sheet&n=24&cols=6&label` shows a contact sheet with labels.

## Measured (local, headless Chromium with SwiftShader software WebGL)

- Building a face (morph, subdivision, brows, lashes, hair, outfit) takes about 60 ms on the CPU (50–96 ms over
  ten faces). This happens once per Next, not per frame.
- **Download:** 349,946 bytes in total: `head.bin.gz` 243,991, `main.js` 104,980 (minified, renderer included),
  `index.html` 975. That is down from about 1.75 MB, and every file is under the platform's recommended 512 KiB.
  The budget test fails above 400 KB for the face system. The whole-game target is 1 MB, against the contract's
  5 MB studio limit and the platform's 15 MiB recommendation. For comparison, Haircut's YouTube build is 1.09 MB.
- **Time to first face:** 2.4 s after navigation from a local server, with software WebGL (shader compilation
  dominates). This is a desktop
  container, not a phone, and it excludes network time.
- These numbers are not phone measurements. Physical mid-range Android frame-time and first-playable checks
  (contract §14) are still NOT RUN.

## How to extend

- **Add a profile.** Add an entry to `PROFILES` with a tone range, weights and small shape means (|x| ≤ 0.5), its
  base-head mix in `BASE_HEADS` and its long styles in `STYLES`, then run the audit.
- **Add a shape dimension.** Add it in `tools/makehuman/dims.mjs`, rebuild the head, run `impact.mjs`, and add it
  to `SHAPE_DIMS`. Its spread comes from its measured effect; add it to a factor if it should move with related
  features.
- **Add a hairstyle.** It must be long. Add a catalogue entry in `hair-styles.js` (the textures that suit it), a case
  in `Hair.build`, and weights in the `STYLES` of the profiles it fits.
- **Makeup painting (next step).** Render brush stamps into a UV-space render target, compute distance from the 3D
  hit point in the fragment shader so strokes cross UV seams, and bind it as `uPaint` (premultiplied colour). For
  mascara, change per-lash `widthMul`, `lengthMul` and `colour` in `Lashes` and call `update`. For lenses, call
  `Eyes.setIris(left, right)`.

## Known limits (honest list)

- Hair is procedural and reads well at phone size, but strand detail, curl clumping and the hanging lengths (which
  are a few layered sheets) need an art pass, or replacement with authored hair cards using the same building
  blocks.
- Outfits are flat-shaded fabric with procedural patterns; folds, sleeves and fabric texture need an art pass.
- The makeup palettes are not built yet. The outfit gives the player a colour cue to work with; it must never become
  a required target or a score (contract: freestyle, no scoring rubric or required target).
- No blink or idle animation yet. A procedural upper-lid blink around the eye centre is the planned approach, and
  it must freeze during a stroke (contract §2).
- Profile shape tendencies are directional and qualitative, not fitted measurements. Have people from the
  represented communities review sample faces before launch.
- Shader cost on low-end phones is unmeasured. The skin shader uses 3D cellular noise for pores and freckles; if
  needed, bake those into a small tiling texture and cap the pixel ratio at 1.5.
- The renderer covers only this scene's needs: no lights objects, shadows, frustum culling or texture formats beyond
  RGBA8. Painting will add one render target.
