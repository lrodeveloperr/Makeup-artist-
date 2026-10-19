# Instructions for work in this repository

Read `MAKEUP-AI-BUILD-CONTRACT.md` before building, reviewing or changing this game. The owner's latest decisions recorded there override earlier makeup research proposals and Haircut-specific gameplay or Android rules.

## Preserve the settled product

- Four fixed makeup tools, all always available: soft brush, detail pencil, mascara wand and lip applicator. Contact lenses are a separate eye-colour selector, also freely available with base colours.
- Freestyle application in any order; the player's strokes determine the work. Front-facing, sufficiently close camera. No camera rotation, precision-zoom controls, size/intensity sliders, scoring rubric or required target.
- Finish opens a player-controlled review with before/after comparison. Next remains available. No free remover, eraser, undo, same-face reset or hidden restart bypass.
- Exactly two rewarded purposes: one completed rewarded ad for same-face replay, and one completed rewarded ad for the daily extra colour. The daily reward is exactly one colour for one specified tool or lens selector, offered until local midnight and kept for good once earned (owner, 19 October 2026). It never unlocks a tool or a whole palette.
- Interstitials only at Next, systematically after every second finished look, with the contract's guards; a rewarded video stands in for the next one (owner, 19 October 2026). Never add banners, tool-step ads or extra reward placements.
- Reuse Haircut's screen flow, queue, reward handling, protected saves, direct YouTube integration, lifecycle, cache-safe packaging and applicable QA patterns. Replace its cutting/customer domain with the makeup domain. Keep each game's data and release identity separate.
- Graphics are owner-selected: WebGL2 (own minimal renderer in `src/gl/mini.js`, chosen over Three.js for load time), one 3D head with a fixed front camera, MakeHuman CC0 face assets, procedural shading, young-adult women only, with feminine faces and long hair coherent with their ancestry (no vitiligo, albinism, dyed hair, short cuts, updos or head coverings), and ancestry profiles as tendencies (never race buttons, never shown to players). See `docs/FACES.md` and `ASSETS.md`; keep every new asset CC0, MIT or studio-owned and recorded in `ASSETS.md`. Keep the download within `tests/size-budget.mjs` (minimise loading time). Do not turn Haircut-specific graphics checks into makeup requirements.

## Authority and scope

The owner authorized preparing this contract and uploading it to GitHub. That does not claim that the game has been built or authorize a store/host submission or publication.

Preserve already approved behavior when implementation is requested. Before implementing a material change to gameplay, monetization, audience, public metadata or release scope, explain the concrete change and its gameplay/revenue effect and obtain any genuinely missing owner approval. Do not ask again for an action already authorized in the conversation. Routine reversible implementation choices within the contract do not require a new product-approval round.

Do not copy Haircut's Android two-video daily policy into this game: the owner explicitly settled one ad for one tool-colour daily reward here. Do not import Haircut's male-only customer logic, clipper guards, rotating camera, wardrobe ownership or identifiers.

## Evidence and delivery

Use the immutable Haircut reference and current official YouTube sources listed in the contract. Do not modify Haircut as part of this game. Record any deliberate adapter changes and their tests.

Use only the official host ad path and permitted test inventory; never test live monetized ads. Test fixtures belong in excluded QA code, not the uploaded runtime. Keep hosted release, real-SDK off-platform preview and standalone preview separate. A missing production SDK is an error, not permission to fabricate it.

Track source, exact release ZIP hash, test evidence and unresolved items. Planned checks start NOT RUN. Local/CI checks, physical-device checks, McPlay acceptance and publication are distinct states. Never transfer Haircut's PASS counts or certification to this game.
