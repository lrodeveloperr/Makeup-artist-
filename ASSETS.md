# Asset and code provenance

Every runtime asset in this repository is either CC0, MIT-licensed, or original work of the studio. No paid scans,
non-commercial research models, photographs of people, or AI-generated images are used.

| Item | Source | Licence | Where |
| --- | --- | --- | --- |
| Head and upper-body base mesh and 230 shape targets (`assets/head.bin.gz`) | [MakeHuman](https://github.com/makehumancommunity/makehuman) commit `a8bc2d54ff0ac92e78ff71431b1023eda42bf482`, `makehuman/data/3dobjs/base.obj` and `makehuman/data/targets/**` | **CC0 1.0** (bundled assets; see the repository's `LICENSE.md` §C–D). No attribution required | `licenses/makehuman-assets-CC0.md`. The SHA-256 of every source file read is recorded in `assets/head.manifest.json` (`source.files`) |
| fflate 0.8.3 (gunzip only, fallback where the browser lacks `DecompressionStream`) | npm `fflate` | MIT | `licenses/fflate-MIT.txt`; include it with any shipped build |
| Fredoka Bold (the lettering of the game logo, `marketing/logo/`, converted to outlines; not in the game build) | npm `@fontsource/fredoka` 5.0.13 (The Fredoka Project Authors) | SIL OFL 1.1 | `licenses/fredoka-OFL.txt` |
| Skin-tone anchors, iris colour stops, seeded PRNG | Studio's own Haircut code (`source/customers/people.js`) | Studio-owned | Adapted in `src/face/colors.js` and `src/face/rng.js` |
| Sound: soft brush (`assets/sounds/brush.mp3`) | Freesound [489425](https://freesound.org/s/489425/) "makeup brush.m4a" by john9192 and [575858](https://freesound.org/s/575858/) "Makeup brush skin.m4a" by tea333 (HQ previews) | **CC0 1.0**. No attribution required; credited here | Cleaned and cut into single movements by `tools/make-sounds.py` |
| Sound: highlighter (`assets/sounds/glow.mp3`) | Freesound [512288](https://freesound.org/s/512288/) "put mascara on (a soft hairbrush)" by vandale (HQ preview) | **CC0 1.0**. No attribution required; credited here | Cleaned and cut into single movements by `tools/make-sounds.py` |
| Sound: pencil (`assets/sounds/pencil.mp3`) | Freesound [809937](https://freesound.org/s/809937/) "Pencil stroke slow soft" by Trtle.T (HQ preview) | **CC0 1.0**. No attribution required; credited here | Cleaned and cut into single movements by `tools/make-sounds.py` |
| Sound: liquid liner (`assets/sounds/liner.mp3`) | Freesound [321138](https://freesound.org/s/321138/) "Felt tip pen drawing spiral 01.wav" by elliott.klein (HQ preview) | **CC0 1.0**. No attribution required; credited here | Cleaned and cut into single movements by `tools/make-sounds.py` |
| Sound: liquid liner (`assets/sounds/liner.mp3`) | Freesound [351145](https://freesound.org/s/351145/) "fast and slow marker strokes" by MBPiM (HQ preview) | **CC0 1.0**. No attribution required; credited here | Cleaned and cut into single movements by `tools/make-sounds.py` |
| Sound: mascara (`assets/sounds/mascara.mp3`) | Freesound [410069](https://freesound.org/s/410069/) "RIMEL.wav" by alinnefrasson (HQ preview) | **CC0 1.0**. No attribution required; credited here | Cleaned and cut into single movements by `tools/make-sounds.py` |
| Sound: lipstick (`assets/sounds/lip.mp3`) | Freesound [740836](https://freesound.org/s/740836/) "Rubbing Lotion or Sunscreen on Skin" by wolfmagpie (HQ preview) | **CC0 1.0**. No attribution required; credited here | Cleaned and cut into single movements by `tools/make-sounds.py` |
| Sound: lip gloss (`assets/sounds/gloss.mp3`) | Freesound [788343](https://freesound.org/s/788343/) "Applying Lip Gloss" by 9voltfan and [391887](https://freesound.org/s/391887/) "Gloss.wav" by laizgomes (HQ previews) | **CC0 1.0**. No attribution required; credited here | Cleaned and cut into single movements by `tools/make-sounds.py` |
| Sound: glass gems (`assets/sounds/gem-glass.mp3`) | Freesound [427389](https://freesound.org/s/427389/) "Glass Tap" by zembacraftworks (HQ preview) | **CC0 1.0**. No attribution required; credited here | Cleaned and cut into single movements by `tools/make-sounds.py` |
| Sound: pearl gems (`assets/sounds/gem-pearl.mp3`) | Freesound [607582](https://freesound.org/s/607582/) "Jewelry Box 13" by Dreadwolf910 (HQ preview) | **CC0 1.0**. No attribution required; credited here | Cleaned and cut into single movements by `tools/make-sounds.py` |
| Sound: metal gems (`assets/sounds/gem-metal.mp3`) | Freesound [607584](https://freesound.org/s/607584/) "Jewelry Box 15" by Dreadwolf910 (HQ preview) | **CC0 1.0**. No attribution required; credited here | Cleaned and cut into single movements by `tools/make-sounds.py` |
| Sound: lenses (`assets/sounds/lens.mp3`) | Freesound [533146](https://freesound.org/s/533146/) "Drop - Water" by mattfinarelli (HQ preview) | **CC0 1.0**. No attribution required; credited here | Cleaned and cut into single movements by `tools/make-sounds.py` |
| WebGL2 renderer (`src/gl/mini.js`) and everything else in `src/`, `tools/`, `tests/` | Written for this game (renderer API names follow Three.js; no Three.js code is included) | Studio-owned | — |

Notes:

- Only MakeHuman's **bundled** assets are used. Items from MakeHuman's community asset repositories carry their
  own licences and are not used.
- MakeHuman's program code (AGPL) is not used or distributed. `tools/makehuman/` only parses its data files.
- MakeHuman's three ethnic macro targets are used only in equal weight, to build one neutral reference head. They
  are not exposed as dimensions.
- Facial-anthropometry literature (for example Farkas et al. 2005, *J Craniofac Surg* 16:615–646) informed the
  direction of the profile tendencies in `src/face/profiles.js`. No measurements, figures or text were copied.
- Hair, cloth, skin and iris detail are procedural shaders, so no texture images ship.
- The tools' and taps' sounds are real recordings, each confirmed CC0 on its Freesound page when
  `tools/make-sounds.py` fetches it (the script stops if a page no longer says CC0). The small sounds of the
  controls and the finish chime are synthesised in `game/sound.js`. No music ships.
- The Monk Skin Tone Scale (CC BY 4.0) is not used in the runtime. If it is later used to check skin-tone
  coverage, credit Dr. Ellis Monk / Google per its licence.
