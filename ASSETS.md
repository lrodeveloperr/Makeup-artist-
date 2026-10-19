# Asset and code provenance

Every runtime asset in this repository is either CC0, MIT-licensed, or original work of the studio. No paid scans,
non-commercial research models, photographs of people, or AI-generated images are used.

| Item | Source | Licence | Where |
| --- | --- | --- | --- |
| Head and upper-body base mesh and 230 shape targets (`assets/head.bin.gz`) | [MakeHuman](https://github.com/makehumancommunity/makehuman) commit `a8bc2d54ff0ac92e78ff71431b1023eda42bf482`, `makehuman/data/3dobjs/base.obj` and `makehuman/data/targets/**` | **CC0 1.0** (bundled assets; see the repository's `LICENSE.md` §C–D). No attribution required | `licenses/makehuman-assets-CC0.md`. The SHA-256 of every source file read is recorded in `assets/head.manifest.json` (`source.files`) |
| fflate 0.8.3 (gunzip only, fallback where the browser lacks `DecompressionStream`) | npm `fflate` | MIT | `licenses/fflate-MIT.txt`; include it with any shipped build |
| Skin-tone anchors, iris colour stops, seeded PRNG | Studio's own Haircut code (`source/customers/people.js`) | Studio-owned | Adapted in `src/face/colors.js` and `src/face/rng.js` |
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
- The Monk Skin Tone Scale (CC BY 4.0) is not used in the runtime. If it is later used to check skin-tone
  coverage, credit Dr. Ellis Monk / Google per its licence.
