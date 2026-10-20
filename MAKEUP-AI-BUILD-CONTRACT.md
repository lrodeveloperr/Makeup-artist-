# Freestyle makeup game: AI build contract

WorksBien Studios · version 1.0 · 18 October 2026

Repository: https://github.com/lrodeveloperr/Makeup-artist-

**Status:** settled owner product decisions plus explicitly identified engineering defaults and verification requirements. Prototypes of the face system ([docs/FACES.md](docs/FACES.md)), the makeup painting tools ([docs/MAKEUP.md](docs/MAKEUP.md)) and the single-screen game with saves and ads through the YouTube SDK ([docs/GAME.md](docs/GAME.md)) are built and locally verified against a test stand-in for the SDK; no passed acceptance suite on the real host, upload archive or certification is represented as complete.

**Graphics: owner-selected on 18 October 2026** (decision rows below; implementation and evidence in [docs/FACES.md](docs/FACES.md)). Art palette, final hair/garment art and effects beyond that decision remain open. Camera proximity, face orientation and stroke accuracy below are functional requirements.

## Authority and decision record

Use these labels throughout: **O** = owner-set decision in this conversation; **I** = inherited Haircut behavior specifically selected by the owner; **D** = engineering/planning default made concrete for the builder, not a claim of owner-selected numerical optimization; **P** = current platform obligation or recommendation, identified by source; **H** = untested commercial hypothesis.

The owner asked for minimalism with substantial creative agency, using Haircut as a base. The following corrections supersede the earlier research report, `makeup-game-final-product-plan-2026-10-18.txt`:

| Decision | Governing value | Authority | Consequence / acceptance |
| --- | --- | --- | --- |
| Makeup tools | Seven fixed tools, all available immediately (owner, 19 October 2026: highlighter, liquid liner and face gems joined the original four) | O | No progression/tool gate; G01–G04; fixed footprints/rates documented and tested in [docs/MAKEUP.md](docs/MAKEUP.md) |
| Eye colour | Add contact lenses as a simple selector | O | Independent iris colours possible; G05 |
| Camera | Front-facing and already close enough; no 360 or precision zoom control | O | Functional accuracy at ordinary framing; G06, UI01 |
| Application controls | Player strokes and repeated passes determine the result; no size/intensity sliders | O | No settings work before creating; G01–G04, UI01 |
| Finish | Review the actual result (no before/after comparison: owner decision, 19 October 2026). Done is a seal the size of the other top buttons; a finished look plays Haircut's chime and a sparkle burst, then review shows Retry (video) and Next with the next customer pictured, as Haircut's completion | O, 19 Oct 2026 | Payoff precedes Next/ad; FLOW01 |
| Replay | Remains rewarded: one earned video restarts the same clean face | O/I | Optional correction/retry; R01 |
| Daily unlock | One colour of the day for one specified tool (or the lenses); one earned video adds it to that tool's colours for good. The offer runs to the player's local midnight with a countdown, in a daily section like Haircut's daily pick | O, 19 Oct 2026 (replaces the 24-hour entitlement) | Replaces all-tool sets and two-video proposal; `src/game/daily.js`; R02–R06 |
| Lens reward | A lens colour can occupy that same single daily slot | Accepted scope from the lens discussion; D scheduling | No additional placement; R02 |
| Ordinary Next | Available regardless of rewarded-ad availability | O/I | Continued base play; FLOW02, AD07 |
| Interstitials | Systematic: at Next after every second finished look, with the inherited Haircut guards (60 s active creation, 60 s between requests, 60 s after a rewarded video). A rewarded video also stands in for the next interstitial | O/I, 19 Oct 2026 | Exact rules in §7; `src/game/cadence.js`; AD01–AD03 |
| Reuse | Screen structure, customer queue, Next, rewards and platform foundation | O | Rebuild only domain-specific behavior; architecture below |
| Graphics engine | WebGL2; one 3D head shown by a fixed front camera; procedural skin/hair/cloth shading, no photo textures | O, 18 Oct 2026 | No Unity/Godot web build; [docs/FACES.md](docs/FACES.md) |
| Renderer library | Own minimal WebGL2 renderer instead of Three.js | D under the owner's load-time priority (18 Oct 2026) | Same shaders; bundle 558 KB → 95 KB |
| Download budget | Whole game ≤ 1 MB initial download; face system ≤ 400 KB; every file < 512 KiB | O priority / D values | `tests/size-budget.mjs` in CI |
| Face assets | MakeHuman CC0 base mesh and targets at a pinned commit; no paid scans, non-commercial research models, MetaHuman, photographs or AI-generated faces | O, 18 Oct 2026 | Provenance in [ASSETS.md](ASSETS.md) |
| Face diversity | All ancestries, including groups Haircut lacked, via MakeHuman's sculpted female base heads and profile *tendencies* over individual feature controls; named blends common. Face shape, eyelids, skin and natural hair texture/colour stay coherent with the ancestry. The queue rotates through every heritage: each run of 20 faces meets all 15 | O, 18–19 Oct 2026 | CONTENT01 audit in [docs/FACE-AUDIT.md](docs/FACE-AUDIT.md) |
| Face age | Young adults only (18–30) | O, 18 Oct 2026 | Generator bound; audited |
| Customers | Every face is a young woman with a clearly feminine face and head shape; no vitiligo, albinism or dyed hair (subtle natural highlights only) | O, 18 Oct 2026 (replaces the earlier mixed-presentation default) | Generator; the audit fails on anything else |
| Hair length | Always long and visible: long straight, layered, wavy, silk press, long curls, box braids, locs or cornrow braids, chosen to suit the natural texture. No short cuts, updos or head coverings, because players prefer long hair | O, 18 Oct 2026 | `src/face/hair-styles.js`; audited |
| Hair colour | Natural shades only, drawn from a per-ancestry colour table (17 shades, jet black to platinum blonde, plus auburn, copper, strawberry blonde) | O, 19 Oct 2026 | `hair` weights in `src/face/profiles.js`; audited |
| Outfits | Each customer wears a blouse or a dress that looks worn on her body (built from the body's own shoulders and upper chest, with anatomical necklines, drape, folds and a hem; the fixed camera frames down to the upper chest), flat or patterned (two-tone, stripes, dots, florals, gingham, geometric), in colours that flatter her complexion and go together; never close to her skin colour, and never black or very dark shades on deeper skin. The outfit colours inform the player's makeup choices but are never a required target | O, 19 Oct 2026 | `src/face/outfit.js`; audited in [docs/FACE-AUDIT.md](docs/FACE-AUDIT.md) |

One daily slot means one offered tool–colour pair, not one offer for every tool. The tool itself is never the reward. The earlier daily-video-count ambiguity is resolved: **one video**, with no 1/2 credit system. Haircut's Android policy is not authoritative for this makeup game.

This task authorizes preparing and committing the contract. Later implementation/release work must follow its own user instruction. Do not reopen settled decisions merely because a reference game differs.

## Reusable architecture and immutable reference

Haircut repository: https://github.com/lrodeveloperr/Haircut

Inspected reference revision: `ed50f09c8b3fed4dda3c5a4f7ab0fc6f9006520c`.

Direct MediaCube/YouTube candidate: `releases/asmr-barber-fade-master-v3.101-mediacube-youtube.zip`.

Reference archive SHA-256: `3a482e55e6317ad34260938daa65642c8b68367447f02fbfbaaf907e582558e0`.

Its recorded ZIP/expanded sizes are 410,921 / 1,089,471 bytes, for Haircut only. The reference records local/CI evidence; actual host acceptance and physical-device checks remain pending. None of those results are a pass for makeup.

| Reuse or adapt | Replace with makeup-specific behavior | Boundary |
| --- | --- | --- |
| Single-screen creation → Finish → next customer | Makeup application and result review | Keep familiar flow; no extra home-screen round trip |
| Persisted customer queue / deterministic generation | Inclusive face profiles and makeup-relevant feature variation | No Haircut demographic gates or hair geometry |
| Reward section, pending lock and earned callbacks | One colour of the day, kept for good (owner, 19 Oct 2026); same-clean-face replay | No wardrobe items or two-video credits |
| Completion/ad cadence coordinator | Changed-face completion predicate | No clipper stroke fields or score target |
| Protected shared cloud load, merged writes and acknowledgement | New schema, compact application state and lens colours | Never reuse Haircut data keys/envelope identity |
| Official YouTube client, startup, pause/mute and recovery pattern | Bind makeup domain operations and truthful progress | No Playgama/Android SDK in direct YouTube target |
| Deterministic packager, runtime hashing, cache-update and exact-ZIP QA pattern | New filenames, identity and makeup acceptance suites | No historical PASS transfer or graphics prescriptions |

Relevant immutable paths are linked in the source register. `source/youtube/build.py` changes behavior from the source runtime; inspect the built target and applicable tests rather than copying an unpatched minified source fragment. Before importing code, confirm rights/licenses and record the exact copied revision and deliberate changes.

Keep the domain independent of the UI, host SDK and persistence adapter. A small domain API should support selecting a tool/colour, applying a stroke/lens, finishing, accepting Next, applying an earned reward and restoring a validated state. This is a boundary, not a requirement for a new framework, service or abstraction hierarchy. Reuse working infrastructure and change only what this domain needs.

## 1. Promise, audience and commercial objective

**O:** A freestyle makeup activity: choose a tool and colour, apply it yourself, review what you made, then try another generated face. Players can make conventional, asymmetric, exaggerated or experimental looks. The game does not grade taste or require matching an example.

The reusable Haircut structure reduces navigation and integration work. The differentiated action is intentional colour application to faces with varied brows, lids, lashes and lips. The whole promise must be playable through touch or mouse without a login, purchase or ad.

**D:** Target the selected general-audience YouTube route, with current suitability checked before release. Do not infer a child-targeted audience from Toca or copy its commercial model. The public title is not locked; use the descriptive working label “freestyle makeup game” until naming/listing work is authorized. No search ranking or distribution guarantee is made.

**H:** Engagement comes from authorship, visible consequence, trying colour combinations on a different face, appreciating the finished work and returning for a desirable daily colour. Rewarded replay and colour variety support these motives. Reviews and cross-platform demand support testing this hypothesis; they do not establish optimal revenue or expected plays/day.

| Funnel step | Intended experience | Main friction to prevent | Observable measure if available |
| --- | --- | --- | --- |
| Entry | Immediately understand “apply your own makeup” | Misleading guided-makeover promise | Listing-to-launch rate |
| Startup | Resume exact work or reach a usable clean face | Loading/recovery abandonment | First playable / failure rate |
| First action | One stroke produces its intended change | Finger occlusion or preset-reveal behavior | Native-task success / first-action time |
| Continue | Review, then anticipate the next face | Repetition, a forced detour or premature ad | Second/third-face reach |
| Return | Work is preserved; today's offer is understandable | Lost work or a trivial reward | D1/D7 if true cohorts exist |
| Monetize | Deliberate reward choice and natural breaks | Interrupted creation or missing reward | Served ads, take-up, net receipts |

## 2. Exact mechanics and invariants

### Seven fixed makeup tools

**Owner decision, 19 October 2026:** the highlighter, the liquid liner and face gems join the original four tools, to finish a look the way a makeup artist does (glow, a crisp wing, gems). Foundation, concealer, false lashes, primer and setting spray were considered and not added.

| Tool | Actions and valid regions | Agency requirement |
| --- | --- | --- |
| Soft brush | Broad face colour, blush, eyeshadow and shading on the face surface | The actual path determines coverage; repeated passes build the effect |
| Detail pencil | Brows, eyeliner and freely placed fine marks / face art | Not restricted to a preset eyebrow or eyeliner template |
| Mascara wand | Apply selected colour to lashes actually touched | Left/right lash state remains independent; untouched lashes stay unchanged |
| Lip applicator | Apply lip colour with the shared lipstick/gloss interaction | Same tool, colour choices; no separate lipstick/gloss tool or mandatory finish panel. Lipstick and gloss mix the same whichever goes on first: lipstick is the colour, a gloss a clear tinted coat over it (owner, 19 October 2026) |
| Highlighter | A sheer glow on the high points (cheekbones, nose, brow bone, cupid's bow) | The path determines where the light catches; passes build the glow |
| Liquid liner | Crisp, opaque lines, wings and flicks that taper to a point at both ends | Not restricted to a preset wing or eyeliner template |
| Face gems | Stick one gem (stone, drop, heart, star, flower or pearl) where the player taps the skin | One tap, one gem, wherever the player taps (on a phone: aimed at the tool's tip, placed where the finger lifts); no preset positions or patterns |

**O:** Each tool is always available. Select a colour, then apply. No size, opacity, intensity or pressure settings are required or exposed; use fixed, suitable tool behavior. Repeated passes and where/how the player moves determine the result. A basic touch device and mouse must both provide the full mechanic: pressure-sensitive hardware is not required.

**D:** For brush, highlighter, pencil, liner and lip application, and for gems, valid placement is on the face surface; do not enforce “correct” cheek/eye/lip regions. Allow intentional off-lip or asymmetric marks. Outside the face surface, the gesture has no domain effect. Mascara affects lashes; a miss is harmless and does not auto-complete all lashes. Do not paint the eyeball with a surface brush. The lens selector owns iris colour.

Stroke order is consequential. Later application affects the touched area in a deterministic order; repeated application is bounded, finite and stable. Overlaying one colour does not recolour every prior mark from that tool. Saturated/no-op strokes do not create unbounded domain history or progress. Internally fixed footprints/rates must be documented and tested before the prototype is accepted, without adding sliders to expose them.

The player can revisit any tool and use any available colour in any order. Both sides remain independent. Do not add forced symmetry, a mirroring toggle, templates, stencils, feature checklists or “paint to reveal” presets. Colour selection changes subsequent application, not the entire existing look.

### Contact lenses

**O:** Eye colour is an additional simple selector, not a fifth drawing brush. Base lens colours are available normally.

**D functional interaction:** Select a lens colour and tap either iris to apply it there; repeat on the other iris for matching eyes. Each eye can differ. A tap elsewhere does nothing. Changing lens colour changes only that iris and preserves all makeup. No lens shop, fitting task or additional adjustment controls. A lens change counts as a real makeover change when it differs from that attempt's starting state.

### Input contract

- A face stays stable throughout an active gesture. Blinks or incidental movement cannot move the target under the pointer. No orbit/360 control or user-operated precision zoom.
- Map input to persistent face-relative coordinates. Reflow changes screen layout, not the stored marks. Interpolate fast movement so it does not leave unintended gaps or jump across the opposite side.
- One captured primary pointer applies at a time. Additional fingers do not add marks or transform the camera. Ignore non-primary mouse buttons.
- **Owner, 19 October 2026: the tool in hand.** The selected tool is drawn where it works as a 3D model matching the face's graphics (her lighting, perspective and scale). A mouse or pen holds it in place of the cursor, its tip at the pointer, from the moment it is over the face. A finger covers what it touches, so on touch the tool works at its tip, a little above the finger (as Haircut's clipper), its handle running down to the finger; a gem or lens is aimed at the tip and goes on where the finger lifts. The tools are drawn at real size (owner, 20 October 2026). On touch (owner, 20 October 2026) the tip is held close above the finger, a touch first aims without painting, a slide paints from where the tip was, a touch that lifts without sliding leaves one dab, and painting stays smooth on a phone. The highlighter is a fan brush held with its fan along the cheekbone, its handle running down and away from the middle of her face on either side. The lipstick is wound up only as far as a woman winds it to use.
- Tool/colour changes occur between gestures. A tool or colour captured at pointer-down remains the gesture's tool/colour; an expiry or UI event does not change it mid-stroke.
- Pointer-up commits; cancellation, lost capture, host pause or resize ends the gesture at the last valid applied sample. Preserve that valid work, discard unapplied input, release capture and require a fresh pointer-down after resuming.
- **Owner, 19–20 October 2026: the colours.** No colour is ever cut off, on any screen and however many colours are owned. At most six colours show at a time: the newest earned first, then the base colours. With more than six, quiet arrows (less prominent than the colours) turn to the next or previous six; a swipe, drag or wheel flick does the same.
- UI taps, palette gestures and swatch previews never draw on the face. The tap that closes an overlay or activates Next cannot become a stroke on the surface beneath it.
- Invalid numbers, malformed paths and out-of-range coordinates cannot mutate state. Domain values are bounded and validated independently of UI checks.

**O:** No free remover, eraser, undo, clear-face button or same-face reset. Do not introduce any of these as an accessibility shortcut or recovery fallback. A new customer through normal Next is a new face; resetting this same face is the rewarded replay promise.

## 3. Round lifecycle, completion and review

On a new save, create the first valid generated face with the soft brush and an available base colour selected. Show a brief application hint only if useful; dismiss it after the first successful input. Do not put tool selection, a tutorial form or an ad in front of the first action.

On return, restore the exact face, makeup, eye colours, selected tool/colour where still available, current creation/review state and upcoming customer. Never substitute a stock finished face.

**Finish:** End the current gesture and open review. Show the actual final work. **Owner decision, 19 October 2026:** review has no before/after comparison (the hold-to-see-before eye was removed); the finished look stays on screen. No mandatory spin, 360 camera, rating, client request, percentage coverage or wait timer. The player can inspect for as long as desired.

**Completion predicate (D):** A meaningful completion requires a persistent makeup or iris difference from the clean starting state. Tool/colour selection, touching an invalid area or returning a lens to its starting colour with no other change is not sufficient. Commit one completion per attempt ID at Finish. Reopening review, reloading or double tapping cannot count it twice.

**Untouched Finish/skip:** Still permits ordinary Next, but awards no completion, no ad credit and no score. No minimum stroke count, minimum drawn area or mandatory use of all tools is added.

**Next:** The previewed upcoming customer is already fixed. Save and resolve any eligible natural-break interstitial once, then advance to that exact customer. Preserve the previous result until the transition commits; an ad/save error cannot silently delete it. Do not reroll the next face after the preview or after replay. No back catalogue or free return to a finished face is part of launch.

**Rewarded replay:** Offered in review. One earned ad clears this attempt's makeup and lens changes, restoring the same original face and natural starting eye colours. Preserve face identity, the upcoming queue, prior completion totals, colour entitlements and ad-cadence history. Create a fresh attempt ID. A genuinely changed replay may earn one new completion when finished; replay itself earns none. Replaying a replay works under the same one-ad rule.

There is no failure/game-over state, finite energy, session cap or forced wait. Generation/deck exhaustion reshuffles valid content while preserving the no-immediate-repeat rule. Ordinary play continues without a served ad.

## 4. Generated content, bounds and repeat scheduling

**O:** Generated faces across demographics are ordinary content. No face, skin tone, age range, facial structure or gender presentation is an ad reward or level gate. All tools work across the supported faces.

Vary application-relevant features: face outline, skin tone, eyelid/eye area, brow shape/density, lash baseline, lip shape and natural iris colour. Use valid dependencies so a generated face has usable targets; demographic labels must not determine capability, difficulty, score or a stereotyped makeup request. No player photo upload, camera permission or real identity is required.

**D:** Persist generator version, seed and resolved current/next profile data. Shuffled scheduling should avoid an identical complete face immediately repeating, including across a deck boundary. Track the last four profile signatures to reduce obvious short repeats when the catalogue supports it; validity takes precedence over a soft diversity preference. Never stall waiting for a novel combination.

Before accepting the generator, enumerate its actual bounded catalogue/configuration rules in a data manifest and audit at least 1,000 deterministic profiles. Report invalid combinations, target reachability, marginal coverage and the actual count or defensible lower bound of application-relevant configurations. Do not multiply seeds, palette entries and accessories into a fictional “millions of levels” claim. Exact geometric/catalogue values are implementation data, not a graphics prescription in this contract.

Colour catalogues use stable IDs, valid per-tool availability and stable saved applied values. The builder must enumerate usable base choices for every tool and lenses, plus the daily rotation, before palette acceptance. Base choices must allow a satisfying complete look on their own; rewards provide variety. No universal free RGB picker or cross-tool colour transfer that nullifies the specific tool–colour entitlement. Actual art colours are left unspecified here.

## 5. Ownership, daily variety and time

All seven tools, the lens selector, base colours and ordinary generated faces are available from the start. Completion totals measure activity; there is no launch currency, shop, XP gate, forced challenge, streak penalty or wardrobe. Colours of the day the player earns stay in their tool's colours (owner decision, 19 October 2026).

The daily offer previews **one exact colour for one exact target**: brush, highlighter, pencil, liquid liner, mascara, lip applicator, face gems or lens selector. The player sees the target, swatch, one-ad cost and that the colour is kept for good before opting in. The reward is not random after viewing and does not supply the colour to every tool.

**Scheduling (owner, 19 October 2026: as Haircut's daily pick):** One offered pair per local calendar day, the same for every player who does not own it yet and never one the player owns, with a countdown to local midnight. The schedule is deterministic and bundled (no live-operations backend): 365 colours of the day (a year of daily offers), every coherent colour each tool can carry beyond the basic base, and the target families take turns day by day. The base catalogue holds the basic colours only, a starter kit that suits every complexion and matches every natural hair and eye colour (35: brush 6, highlighter 4, pencil 5, liquid liner 2, mascara 2, lip 7, face gems 4, lenses 5; the lip kit includes a clear gloss, owner, 20 October 2026, so every player can try gloss from the start); every other colour is a colour of the day (owner, 19 October 2026). Once a player owns every colour of the day, the daily button disappears (owner, 19 October 2026). The offer shows a product shot of the colour (owner's choice, 19 October 2026) (`src/game/daily.js`, tested in `tests/game.mjs`). **Owner, 20 October 2026: the gift.** The offer is a gift box tied in the colour, with the product shown once, on the video button. Its clock ticks until the box is opened. After the video, a satisfying sound and screen effect reveal the colour in the box and the clock stops; a continue arrow returns to the game with the colour selected. The pop-up is centred and scaled by one rule on every screen.

**One earned video:** Adds that pair to its tool's colours for good, on every face. No daily 0/2 or partial-credit counter. One successful claim per colour; an owned colour is never offered again.

Freeze the advertised offer identity when a request begins. If midnight passes during that request, success grants the pair actually advertised. Do not silently grant the newly rotated pair instead. A declined, failed or unavailable request does not consume the daily claim.

Earned colours do not expire. Applied makeup and lenses always keep their colours. If a catalogue colour is ever retired, applied work keeps it, and a selected colour that is no longer usable falls back to an available base colour without modifying the face or opening an ad.

The day comes from the device clock (no trusted host clock is used). Changing the clock can show another day's offer; each colour still costs one video and can never be granted twice. Do not claim tamper-proof timing or add a backend/account to enforce it. Protect existing work if time is invalid; recover the daily panel without blocking the base game.

Retain current work and the current/most-recent review result, not an unbounded look gallery. No external sharing flow is part of launch.

## 6. Functional screens and state transitions

Keep Haircut's reusable placement/flow structure where it fits. Creation exposes the face, four tool controls, the selected tool's colours, contact lenses, Finish and the existing reward-section affordance. Contact lenses use the same compact colour-selection pattern. No additional camera or application-adjustment panel.

| State | Allowed actions / exit | Durable changes and save | Ad eligibility |
| --- | --- | --- | --- |
| BOOT / RESTORE | Wait or Retry after a failure | Read/validate before mutation; never erase unknown data | None |
| CREATE | Select tool/colour; apply; Finish; open daily offer | Applied samples/committed gestures and selected state checkpoint | Explicit daily request only |
| DAILY OFFER | Inspect promised pair; dismiss; request one ad | Offer/request identity; no grant for opening panel | One explicit daily request |
| REVIEW | The finished look; Next; rewarded Replay; inspect daily offer | Completion once; exact final/before/next state checkpoint | Explicit replay/daily; interstitial only after Next |
| AD PENDING | Await request outcome; block conflicting Next/draw/second ad | Pre-ad acknowledged snapshot and request identity | Existing request only |
| NEXT COMMIT | Advance once after eligibility/save/ad handling | New attempt + exact queued face + next queue atomically | At most one eligible interstitial |
| RECOVERY | Read usable explanation and Retry | Preserve unread/dirty/acknowledged data as appropriate | None |

Host pause can suspend every state. It does not change the domain state into “new game.” Menu pause stops creation while the offer/menu remains usable; host pause stops both. A reward callback may record pending outcome data, but cannot restart execution while the host is paused.

Opening/closing panels, orientation changes and app interruptions preserve the face and work. Input ownership and one transition lock prevent duplicate grants/completions, pointer leakage or skipped customers. Primary actions must remain reachable at small embeds and extreme aspect ratios; reflow is automatic and does not introduce user zoom.

## 7. Exact advertising contract

### Inherited interstitial control

These are game-specific inherited values, **not Google-mandated or empirically optimal thresholds**.

| Parameter | Value / meaning |
| --- | --- |
| First opportunity | At least 2 meaningful completed attempts **and** at least 60,000 ms active creation accumulated |
| Later opportunities | Same thresholds, accumulating since the last accepted interstitial request |
| Natural transition | Explicit Next from review, after the player can see the finished result |
| Adapter attempt cooldown | At least 60,000 ms since the previous actual interstitial SDK invocation, even if it rejects |
| Recent-reward suppression | Skip interstitial request while fewer than 60,000 ms have elapsed since a rewarded success is delivered. A rewarded video earned since the last break also stands in for the next interstitial: that opportunity is skipped and counting restarts (owner, 19 Oct 2026) |
| Cadence reset | Successful/accepted interstitial request clears qualified count and active-time accumulation; not proof of a served impression |
| Failed/suppressed opportunity | Keep cadence progress; advance normally; no immediate retry or deferred popup |
| Ordinary/replayed attempt | Each genuinely changed Finish can qualify once |
| Untouched skip / panel / reward / reload | Does not itself add a completion |

Active time means unpaused CREATE time, matching the reference's gameplay-state clock; it does not require continuous pointer movement. Exclude review, loading, offer/menu, pending ad and host pause. Reset frame timestamps on resume; do not add background elapsed time or a giant delayed-frame delta. Keep the reference's bounded frame-delta approach.

Persist qualified count and accumulated active milliseconds. **Reference restart semantics:** attempt cooldown and recent-reward timestamps are runtime-only in Haircut; a full reload begins fresh runtime timers while retaining saved cadence progress. Adopt that behavior rather than silently inventing persisted suppression. A reload does not itself call an ad: another explicit eligible Next is required. Any proposal to change this timing must be documented as a monetization change.

An untouched current attempt must not be used as the Next trigger for accumulated interstitial eligibility. A changed Finish is the natural break. No ad during a stroke, on tool/colour selection, between facial features, on panel opening, on replay grant or automatically on return.

### Exactly two rewarded purposes

| Purpose | Stable placement ID default | Videos | Grant scope | Entry |
| --- | --- | --- | --- | --- |
| Replay this face | `makeup-replay-face` | 1 confirmed earned result | Same clean face, new attempt; preserve queue/entitlements | Explicit review action |
| Daily extra colour | `makeup-daily-colour` | 1 confirmed earned result | Exactly the advertised target–colour pair, kept for good, on every face | Explicit daily-offer action |

IDs are makeup-specific engineering defaults. If publisher configuration requires different strings, record a one-to-one mapping without adding placements or putting user data in IDs. The content/offer ID belongs in the grant record; do not create a different SDK reward type for every player/date.

### Request, grant and recovery ordering

1. Capture immutable context: request nonce, purpose, exact offer or face/attempt ID. Acquire the shared in-flight lock and safely finish the active gesture.
2. Flush the full protected state and await acknowledgement. If it fails, do not call the ad SDK; retain work and a usable retry/continue route.
3. Recheck disposed/host-pause/request context, then invoke only the official host ad function. Interstitial attempt time starts at actual invocation, not opening an offer or beginning a save.
4. Only `requestRewardedAd(...)` yielding strict `true` earns the reward. `false`, `undefined`, thrown/rejected errors, cancellation, no fill and an unavailable API grant nothing and consume no daily claim. No optimistic grant from an intent or a video overlay closing.
5. Do not release a host pause when the Promise settles. Wait for authorized resume before applying/continuing domain execution. Keep a received successful outcome pending if necessary; no additional ad is needed to retry saving a known earned outcome.
6. Apply once using the captured context. Replay must still refer to its exact face; a daily grant must retain the advertised pair. Mark the nonce consumed and persist reward + resulting domain state together. A failed post-grant save retains dirty earned state for retry instead of rerunning the video.
7. Release request/menu ownership safely, return to the correct usable state and suppress subsequent interstitial requests for the selected runtime interval. No automatic second placement.

The SDK does not promise a durable recoverable receipt for a process killed between its success and the game's acknowledged save. Document that crash window; test every recoverable boundary without claiming impossible exactly-once cross-process delivery. Pending intent restored after a crash grants nothing by itself.

Use no banners or third-party ad SDK. YouTube owns pre-roll; never request it manually. Ordinary Next and the free tools/colours stay usable without supported inventory. If an interstitial pre-save fails, make no ad call; preserve the result and allow a clear retry or an explicitly unsynced in-memory continuation rather than pretending a save succeeded. No request loop or forced wait for inventory. Monetization access, fill and publisher terms must be confirmed separately from integration.

## 8. Durable save inventory and checkpoints

Use one makeup-owned versioned envelope through the host adapter, with separate domain versions where needed. Do not use Haircut's game IDs, preview keys, fields or existing cloud envelope as makeup's identity.

| Field group | Required durable information |
| --- | --- |
| Identity | Envelope/domain/generator/catalogue version; revision; game identity |
| Current attempt | Stable attempt ID, face identity/seed/resolved profile, CREATE or REVIEW, original baseline |
| Makeup | Ordered/bounded applied state, lashes, independent iris colours; applied values remain resolvable if a colour is retired |
| Selection | Tool and available selected colour; no zoom, size or intensity setting |
| Review | Exact final and matching before state; completion-committed flag / idempotency record |
| Upcoming content | Fixed next face, seed/deck cursor and bounded recent profile signatures |
| Progress | Safe-integer meaningful completion total; current cadence qualified/active values |
| Daily | Today's offer (day, colour), the colours of the day the player has earned (permanent), the day the daily section was last opened |
| Reward transaction | Bounded known outcome/nonce/consumed state needed for idempotent retries; no fake receipt |
| Preferences | First-use hint state; declared local settings only; host language/audio are not overridden by cloud preferences |

Bound everything: one current face, one next face, one latest result, four recent signatures and only live entitlements plus the minimal latest claim/idempotency records. Expired selectability records can be pruned while retaining applied colour values. Never store every completed customer or an unbounded stroke/event log.

**D checkpoints:** Coalesce continuous application saves with a maximum 1,000 ms interval during active creation, while tracking all unsaved changes in memory. Flush after gesture end, lens change, Finish, Next and an earned reward; serialize overlapping requests. Use the host's allowed final-save opportunity, but never depend on it alone. Acknowledgement is the durable boundary; a queued call is not “saved.”

The builder chooses a compact canonical representation with documented limits. Lossless coalescing/checkpointing must preserve the actual work and layer order. A storage cap may not silently drop old marks, simplify away differences, stop normal strokes or sell a reset. Measure a maximum-work session and redesign the representation before accepting a bound that interferes with ordinary play. Normal save target is below 65,536 UTF-8 bytes; official absolute bounds are distinct (§14).

## 9. Data integrity, migration and recovery

Inherit the reference's single shared load Promise, validate-before-write guard, deep-copy isolation, merged serialized writes and acknowledgement. Independent initialization modules must not each load and overwrite their own snapshot. Mutations arriving while a write is in flight remain dirty until an acknowledged later revision includes them; do not clear newer dirty state after an older write completes.

Recognize documented canonical empty forms deliberately. A failed read, malformed nonempty value, unsupported future envelope or wrong game identity is not an empty account. Protect it from overwrite and show recovery. Retry must reload/validate without deleting progress. Hosted load failure never silently falls back to local player data.

First makeup release starts at schema v1; no Haircut or Playgama migration is implied. Every later shipped schema needs a deterministic tested migration retaining the player's application, entitlements and queue. Removed catalogue entries must still decode existing applied colours; removed selectable reward entries need a safe mapping consistent with the original promise.

Validate safe integers, finite ranges, identifiers, array sizes, depth and decoded sizes before allocation. If packing/compression is used, bound expansion and reject malformed payloads. In-memory snapshots passed to saving cannot be mutated by later strokes. Derived caches are disposable and separate from authoritative progress; cache errors cannot wipe work or block first interaction.

No player account, studio backend, PII, external analytics or tracking identity is introduced. Cloud saving through the platform is required for this resumable game; the owner's local-first native-app pattern must not replace YouTube cloud storage.

## 10. Startup, readiness and Retry

For the direct MediaCube/YouTube target, load the unmodified official `https://www.youtube.com/game_api/v1` SDK before game code and never overwrite `ytgame`. Register host pause/resume and audio callbacks before asynchronous initialization can miss them. Display genuine loading and report first-frame readiness once that loading is actually presented.

Use one protected cloud read. Language lookup and required data loading may proceed concurrently when the host permits execution. Restore the current work/queue/entitlements before input readiness. Optional thumbnails, derived caches or nonessential warm-up cannot hold the startup critical path. An initial host pause defers execution, reads and input until resume.

Call `gameReady` once the required state is loaded, the usable scene has actually been presented and blocking loading is removed. Do not report readiness to hide an initialization failure or while a noninteractive cover remains. A zero-size viewport waits for valid layout without generating a different face; reflow then starts the same state.

Missing/blocked SDK, domain initialization or protected save errors reach a concise recovery state with Retry and a safe diagnostic code/build identity. No save content or sensitive URL belongs in diagnostics. Retry tears down the failed instance, subscriptions, audio resources, pointers and pending timers before a clean reinitialization. Never reset a save to make Retry work.

Three environments remain distinct: production hosted SDK; real-SDK off-platform mode when its explicit environment flag is false; and a separately identified standalone development preview. Off-platform previews have separate local/in-memory data and unavailable host rewards, not fabricated ad/cloud success. Denied preview storage must not later overwrite disk state it failed to read. Production SDK absence never enables preview implicitly.

## 11. Host lifecycle, pause ownership and audio

Retain explicit host, menu and ad-request ownership. Creation is paused if any applicable owner requires it. Closing a menu or receiving an ad result cannot clear a host pause. With only menu ownership, the panel remains usable; with host ownership, no game-owned UI interaction, frame work, timer advancement, sound or ordinary network work continues. Use only the permitted final-save exception and reset the active clock on resume.

The direct YouTube target uses SDK pause/resume rather than Page Visibility or multi-tab pause ownership. Interruption safely ends a current gesture as defined in §2. Resume restores the same applied state and requires new drawing input. Timers for daily display are recomputed from time; they do not expire paint or award progress while paused.

**Owner decisions, 19 October 2026:** no music; satisfying, true-to-the-tool ASMR sounds: real CC0 recordings for every tool and tap on the face (credited in ASSETS.md), synthesised sounds for the controls, each stroke following the hand's speed ([docs/GAME.md](docs/GAME.md)). Every audio path follows initial and changed host audio enablement plus device/system restrictions. No sound is required to understand an action. Follow YouTube's preference for host-level overall mute rather than cloning an unnecessary global mute control. Any separate music/effects setting must still obey host mute. Resource teardown is bounded across repeated Retry/mount cycles.

## 12. Language, access and platform boundaries

**O, 19 October 2026: the visible interface is textless** (Blush Studio look, on Haircut's controls): icons, pictures and numbers only, as in Haircut. Words live in the spoken labels. Use mostly direct, nonverbal manipulation. English is required for those labels; essential notices (shown as icons) include one-ad cost, exact reward target, that the colour is kept, unavailable inventory, unsaved/retry state and the distinction between Next and same-face Replay. Localize all essential labels/messages in every declared locale, including accessible tool/colour/action labels.

Use the host language API with a documented mapping/fallback to English. Do not use browser language APIs or restore a cloud language that overrides the current host. The final declared locale list remains a pre-release deliverable; do not claim 27 languages because Haircut contains them.

Every action works via touch and mouse. Action buttons/swatches should have at least a 44-by-44 CSS-pixel effective touch area where the viewport permits (D usability target), with usable reflow in tiny embeds. Keep the face sufficiently close for ordinary placement without adding zoom controls. Never stretch input mapping when aspect ratio changes. Preserve work across orientation/resize and never lock orientation.

Native keyboard focus should operate buttons; verify any broader keyboard/accessibility claim before listing it. Escape may dismiss a modal without preventing its default behavior. Do not require audio, colour names alone or a hover gesture to identify the selected tool/action. Haptics are not required; if implemented, provide their required disabling option.

The direct Playables game has no login, personal-data form, external links/sharing, exit button, QR workaround, extra agreement or external service call other than required platform integration. Keep Android's external privacy-shield pattern out of this target; complete required portal disclosures. Presentation assets and generated face components need cleared rights. Listing language must match actual freehand controls and optional rewards.

## 13. Progress reporting and commercial measurement

No beauty score, customer star rating or quality leaderboard. **D:** If the selected publisher needs progress reporting, use one truthful dimension: the acknowledged saved total of meaningful completed makeup attempts. That includes a genuinely changed replay once, excludes untouched skips and is not an attractiveness rating. `sendScore` is optional under current Google integration rules; never emit dummy zero solely to satisfy a scanner.

Report only after game readiness, successful save acknowledgement and host resume. A pending/failed score report cannot block loading, saving or play; retry on a later legitimate event. Use safe integers and ensure reported progress matches the acknowledged snapshot. Record whether reporting is enabled in the release manifest; disabled means no calls.

Commercial objective: sustainable daily developer-net receipts, supported by meaningful play and repeat visits. Where real cohorts are supplied, measure net revenue per first-time player over a declared seven-day window. Secondary metrics are meaningful completions/session, second/third-face reach, replay/daily take-up, served impressions by format and D1/D7.

Define publisher “play,” “launch,” “session” and “player” before comparing them. A cumulative catalogue total is not today's traffic; Roblox visits, Poki votes and Android installs are different units. D1/D7 need the original cohort and explicit return windows, not returning-user share. Distinguish ad opportunity, request, accepted request, served impression, completed video and earned grant.

Use permitted publisher/host aggregate reports. Do not ship external analytics to obtain missing metrics. If cohort reporting is unavailable, use net revenue per 1,000 launches or sessions with its actual denominator and state the limitation. Availability of publisher fill, geography, retention, revenue share and currency is to be confirmed before projections.

Revenue arithmetic uses actual served impressions by format divided by 1,000 and multiplied by the matching eCPM. If eCPM is already developer-net, do not deduct a share again. Use consistent periods/currencies; requests alone are not revenue. No numerical traffic/revenue forecast is justified by this contract.

**D validation plan:** First observe 8–12 unfamiliar adult testers using phones: can they start within five seconds of input readiness, intentionally use every tool/lenses, create asymmetry, review, decline rewards and understand replay? This is a usability sample, not retention proof. Investigate control failures within the settled close-camera/no-slider interaction before adding UI.

After launch, collect an initial 14-day observation window where available and wait for complete seven-day return windows before interpreting D7. Keep this approved design as the control. Future material ad/content changes need a concrete authorized proposal with one hypothesis, outcome, pre-agreed continuation/retention guardrail, exposure requirement, uncertainty and rollback. Do not invent a universal sample size or causal result from a tiny before/after cohort. Roll back an authorized experiment to its recorded control if its agreed guardrail is breached; otherwise label insufficient evidence inconclusive.

## 14. Performance, package and reproducibility budgets

The following tighter targets are studio engineering defaults; they are not achieved measurements or promises about host/pre-roll latency.

| Item | Budget / method | Authority |
| --- | --- | --- |
| Release ZIP | Less than 5,000,000 bytes | I studio limit |
| Expanded bundled runtime | Less than 5,000,000 bytes | I studio limit |
| Initial game-content transfer | Less than 5,000,000 bytes; report compression and SDK separately | D, stricter studio target |
| Normal maximum-work cloud payload | Less than 65,536 UTF-8 bytes, including envelope | D / final-save operational target |
| Individual file | Prefer below 524,288 bytes; every file below 31,457,280 bytes | P SHOULD / MUST, stability source |
| File count | At most 8,000 | P MUST |
| First playable, cold | p95 below 5 s on named mid-range Android at 10 Mbps / 100 ms RTT, 20 runs | D test target |
| First playable, warm | p95 below 2 s on same named device/network, 20 runs | D test target |
| Input response | p95 below 100 ms during a ten-minute native-input session | D test target |
| Memory | Peak JavaScript heap below 256,000,000 bytes studio target; no sustained resource growth in soak | D; stricter than platform ceiling |
| Soak | At least 50 customer/replay transitions and ten active minutes | I studio reference floor |

For comparison, the checked English stability body requires initial content below 30 MiB, total bundle below 250 MiB, every file below 30 MiB and saves below 3 MiB. It recommends initial below 15 MiB, files below 512 KiB, saves below 500 KiB and interaction under five seconds. It specifies a 512 MB peak JavaScript heap ceiling; retain its stated unit, while the studio target above is exact bytes. Prefer the normative body over conflicting generated page summaries.

Measure both end-to-end first-playable latency and attributable game startup. Record SDK delivery, host/pre-roll delay, cache state, device/browser/OS and throttling. Do not subtract host delay and call the result end-to-end loading. Warm/cold and emulated/physical evidence are distinct. Failure to meet a target needs explanation and a corrective proposal; do not quietly reduce the game's approved behavior or visual fidelity to hit it.

The upload ZIP has `index.html` at root, safe relative dependencies, valid filenames, complete local dependency closure and licenses. Exclude credentials, source-only research, test fixtures/mocks, alternate publisher SDKs, external analytics and debug inventory. Keep production code reviewable. Use local content-hashed runtime assets and hash transitive imports/runtime fetches, not only entry filenames.

Do not put optional cache reads on the loading critical path. Cache release A, then load B with its old saved work; verify no mixed modules, wrong schema or Retry loop. The actual current host response-header CSP must be used in local exact-artifact testing; an HTML meta approximation is insufficient.

Build immutable versioned ZIPs, refuse silent overwrite, and rebuild twice byte-for-byte. Extract the exact upload bytes for all release acceptance suites. Record source commit, archive SHA-256, ZIP/expanded/initial sizes, largest file, file count, runtime hashes, schema/catalogue versions and enabled reporting in a release manifest. No release archive exists at contract time.

## 15. Acceptance matrix and release handoff

Every case below starts **NOT RUN**. Implement named procedures or executable tests, using the actual domain plus native browser/device input. A documented requirement is not an executed test. Result records need ID, stimulus, expected outcome, method/environment, source/ZIP hash, PASS/FAIL/NOT RUN and evidence path or URL. Justified N/A is permitted only for an inapplicable implementation feature, not for an inconvenient core rule.

| ID | Stimulus | Required outcome | Method |
| --- | --- | --- | --- |
| G01 | Brush through cheeks/lids, overlap colours, repeat passes | Path-specific bounded application; free order; no slider | Domain + native touch/mouse |
| G02 | Pencil brows, liner and intentional face art | Actual fine marks beyond a preset path; no forced symmetry | Domain + native input |
| G03 | Touch some lashes and miss others | Only touched lashes change; independent sides; bounded repeats | Domain + native input |
| G04 | Lip application inside and deliberately outside lip area | Shared applicator; stroke follows input; no preset reveal | Domain + native input |
| G05 | Lens colour on left/right and invalid area | Independent iris change; no paint loss; miss is no-op | Domain + native tap |
| G06 | Fast strokes, face motion, pointer cancel, resize, lost capture | Continuous valid work retained; stable target; no accidental resumed stroke | Native input + fault injection |
| G07 | Invalid paths/numbers, max work, saturated/no-op application | Validation; finite bounded state; no silent work loss | Domain/property tests |
| FLOW01 | Finish, reopen/reload review | Actual result; completion at most once | Domain + browser |
| FLOW02 | Untouched Finish/Next; repeated Next double tap | Skip allowed, zero completion/ad progress; one customer advance | Domain + browser |
| FLOW03 | Changed completion, Next, then replay and reload | Previewed queue stays fixed; new attempt IDs; no free reset | Domain + browser |
| CONTENT01 | Audit 1,000 seeded generated profiles / deck exhaustion | Valid targets; coverage report; reproducibility; no adjacent identical full face | Generator audit |
| CONTENT02 | Reload with current/next and recent schedule state | Exact profiles/queue retained; no demographic/tool gates | Domain + save |
| R01 | Replay true vs false/error; repeat same completed attempt | True clears same face only; queue preserved; each new changed replay qualifies once | Domain + injected SDK |
| R02 | Daily claim for each target family | One ad, one exact target–colour pair; no tool/all-palette unlock | Domain + injected SDK |
| R03 | Claim near midnight / offer rotates while request pending | The advertised pair is granted; next-day offer independent | Controlled clock + SDK |
| R04 | Retire a selected/applied colour while creating/reviewing/reloading | Applied work persists; captured stroke finishes; future selection valid | Catalogue + browser |
| R05 | Claim twice/double tap/duplicate completion callback | One request and grant; no duplicate extension or 1/2 counter | Domain + delayed SDK |
| R06 | Colours earned over many days, clock changes, maximum payload | Every earned colour retained; no duplicate claim; documented clock limit | Clock + save tests |
| AD01 | 1 vs 2 completions; 59,999 vs 60,000 active ms; threshold cross in review | AND thresholds; only changed-review Next invokes | Controlled clock/domain |
| AD02 | Attempt at 59,999/60,000 ms; reward suppression boundary; full reload | Correct cooldown/anchor/runtime reset; durable cadence; no popup retry | Clock + browser |
| AD03 | Accepted vs rejected interstitial; suppressed opportunity | Accepted resets pacing, rejection/suppression retains; Next continues | Injected SDK + domain |
| AD04 | Delay/fail pre-ad acknowledgement; host pauses meanwhile | No premature SDK call; preserve work; one in-flight lock | Save faults + SDK |
| AD05 | Reward true/false/undefined/rejection/no fill; delayed host resume | Strict true-only grant; no premature resume or lost context | Injected SDK + lifecycle |
| AD06 | Known reward then save fails/reloads; crash before acknowledgement | Idempotent recoverable retry; no second ad; document unavoidable receipt gap | Transaction/save faults |
| AD07 | SDK ads unsupported; off-platform preview; decline offer | Base tools and normal Next usable; no fake success | Browser/environment |
| AD08 | Compare calls with recorded publisher events | Requests/acceptance distinct from served/completed/earned | Hosted report review |
| SAVE01 | Read failure, canonical empty, malformed nonempty, future/wrong-game state | Only recognized empty initializes; unknown/unread data protected | Adapter tests |
| SAVE02 | Delay/interleave/reject writes while applying/rewarding | Single load; merged serialized writes; copy isolation; dirty retry | Adapter race tests |
| SAVE03 | Native strokes/lenses → acknowledged save → reload | Exact face, work, queue, review, rewards and selections restored | Native browser/host |
| SAVE04 | Every shipped old schema / removed colour entry | Valid migration; old applied work intact; no Haircut migration | Fixture tests when applicable |
| SAVE05 | Maximum normal state, hostile sizes/numbers/depth/packing | Payload bound; bounded allocation/decoding; no truncation | Boundary/fault tests |
| SAVE06 | Interrupt between checkpoints / final-save opportunity | Durable guarantees match acknowledgement; measured loss window | Browser/physical device |
| BOOT01 | Block official SDK or fail initialization | Usable protected Retry; no mocked SDK/preview fallback or write | Browser network faults |
| BOOT02 | Slow language/cloud, initial pause, zero viewport | Early callbacks, one read, safe concurrency, correct once-only readiness | Browser + SDK fixture |
| BOOT03 | Repeated initialization failure/Retry | Same work; no duplicate listeners/timers/resources | Browser repeat test |
| LIFE01 | Pause/resume during boot/stroke/review/menu/ad | Execution/input/audio/network stop; no elapsed-time jump | Browser + host procedure |
| LIFE02 | Ad/menu completes while host still paused; initial/changed mute | Host ownership authoritative; every audio path silent as required | Injected SDK + actual host |
| LIFE03 | Destroy/retry repeatedly; inspect production pause APIs | Bounded resources; no Page Visibility/multi-tab owner | Static + browser |
| UI01 | Phone/tablet/desktop, tiny/extreme viewports, resize | Close usable framing; controls reachable; no zoom/sliders; work retained | Native layout matrix |
| UI02 | Essential notices / each declared locale / keyboard and Escape | Truthful reward/access labels; complete declared text; host UI respected | Locale/access review |
| METRIC01 | Acknowledged vs pending completion save; score disabled/enabled | Exact truthful integer only when enabled/ready/resumed; no dummy score | Adapter tests |
| METRIC02 | Score rejects or is delayed | Saving/play/readiness continue; event-based safe retry | SDK faults |
| PACK01 | Build twice and inspect/extract exact ZIP | Same bytes; root entry; legal names/count/sizes/references/licenses | Packaging automation |
| PACK02 | Scan runtime and capture all requests | No mocks/credentials/analytics/alternate SDK; dependency closure | Static + network audit |
| PACK03 | Mutate transitive runtime payload / cache A then serve B | Content hash detects change; no mixed release or lost work | Cache/network test |
| PACK04 | Exact archive under current header CSP; separate real-SDK run | No required runtime CSP failure; fixture not shipped | Browser + SDK test suite |
| BROWSER01 | Creation/save/ad/error flow in Chromium, Firefox, WebKit and relevant Edge | Native usable flow; declared differences resolved | Browser suite |
| DEVICE01 | Physical Android/iOS YouTube app: touch/cancel/audio/rotation/interruption/return | Same valid work and lifecycle; actual-device evidence | Named manual device procedure |
| SOAK01 | 50 transitions and ten active minutes with replay/menus | No stuck state, duplicate grants, error or unbounded resources | Scripted + observed soak |
| PERF01 | Named cold/warm network/device runs and maximum-work session | §14 budgets measured with host/SDK delay reported | Timed benchmark |
| RECOVERY01 | Applicable runtime resource loss/reinitialization | Work retained or protected Retry; no silent restart | Implementation-specific fault test |
| HOST01 | Authorized exact-hash McPlay pre-flight upload | Every warning/failure disposition recorded | Future portal procedure |
| HOST02 | Actual host saves, earned/cancelled/unavailable rewards and natural interstitial | Correct behavior on permitted test inventory | Future authorized host test |
| HOST03 | Listing, audience, rights, languages and QA answers | Match actual code, release bytes and current requirements | Release review |
| MEASURE01 | Available publisher reports and first observation window | Definitions/denominators/gaps recorded; no fabricated metrics | Commercial review |
| MEASURE02 | Any later authorized variant | Preregistered outcome/guardrails/exposure/uncertainty/rollback | Future experiment record |

Acceptance suites must collect nonzero tests and run all required selected cases. Browser fixtures are test-runner injections excluded from the upload. Physical checks and actual host checks cannot be replaced by emulation. Reuse valid identical-byte evidence instead of indiscriminately rerunning everything; changed domain/adapter/release bytes need affected checks again.

### Builder handoff and remaining data decisions

Build the core using the selected reusable foundation, then native-input validation, protected saves and exact ad-boundary tests. Complete prototype acceptance before expanding scope. Record implementation status honestly; tests in the table are requirements to implement, not scripts supplied by this documentation task.

The following are remaining engineering/content/release data, not unresolved core product choices:

1. Enumerated face-generator bounds, valid configurations, tool application constants and base/daily colour catalogues. Make them finite, testable and consistent with this contract; no new player settings.
2. Final art pass for procedural hair and the outfits. The base face assets (CC0), customer presentation, long-hair direction and outfit colour rules are chosen (decision record above).
3. Final public title, declared locales and portal listing, after the implemented behavior can support the claims.
4. Verified publisher monetization access, reporting fields, inventory test route and commercial terms.
5. Named physical devices, exact runtime representation and release performance/evidence results.

Nothing in this list reopens one-ad daily rewards, same-face replay, the seven tools/lenses, close camera, no sliders, review or the selected interstitial control. Any proposed material departure needs the concrete owner-approved change process in `AGENTS.md`.

Before shipping, produce the source revision, immutable ZIP, manifest, test result ledger, device evidence, McPlay warning dispositions and matching portal answers. Separate **specified**, **implemented**, **locally verified**, **CI verified**, **physical-device verified**, **host accepted** and **published**. This contract upload changes documentation only and does not authorize publication.

## Research basis and source register

Research was conducted on 18 October 2026 across 16 titles. The full earlier report informed this contract; its superseded proposals are excluded by the decision record above. Feature/review observations are evidence, not proof of causal retention or optimal monetization. Historical reviews remain historical.

| Comparator group | Observed evidence / scope | Design inference, not a measured effect |
| --- | --- | --- |
| Playables: Makeup Stylist, Makeover Stylist, Makeup Kit, Skincare Time | Destination-platform makeup/satisfying activity demand; cumulative catalogue counts | Validate testing this activity; no forecast from totals |
| Android: HDuo Makeup Stylist, Makeup Kit, DIY Makeup | Listing/review samples include colour choice, direct activity, repetition and intrusive step ads | Start at application and keep ads away from tool steps |
| iOS Makeup Artist; Toca Hair Salon 4 across mobile | Free-art/representation requests; Toca open-ended face paint; a 2026 Android review objects to moving targets | Preserve authorship and stable input; zoom suggestion was rejected by owner |
| Super Stylist; Project Makeover | Broad client/result systems and different puzzle/fashion loops | Borrow the payoff/next-client anticipation without their extra systems |
| Roblox Makeup Mania; Paint Me Pretty; Dress To Impress | Freehand and social styling descriptions; Paint Me Pretty is a feature analogue without verified hit metrics | Expression and appreciation transfer more directly than voting/economy |
| Poki Diva Makeup Studio / Diamond Makeup; CrazyGames Makeup Studio Glam Diva | Browser beauty/colour/decorating listings; Diva opening palette observed, full round not verified | Clear transformation and choice; mixing/decorating not required here |

Playables catalogue metrics are third-party rounded cumulative plays, not unique players or current plays/day. Android downloads are cumulative worldwide thresholds, iOS ratings use named storefronts, Poki values are votes and Roblox tracker visits are not unique people. No mobile apps or Roblox experiences were installed for this research. Direct Makeup Stylist YouTube access encountered a sign-in wall, so its freehand mechanics were not verified by playing. Do not equate Astrasen's Playables Makeup Stylist with HDuo's Android title.

### Primary and catalogue sources

All checked/retrieved 18 October 2026, except where historical publication/review dates are explicitly identified. Requirement claims use current English operative bodies, not generated summaries. Recheck before any release/compliance claim.

- [Playables Makeup Stylist](https://playables.games/games/makeup-stylist/), [Makeover Stylist](https://playables.games/games/makeover-stylist/), [Makeup Kit](https://playables.games/games/makeup-kit-color-mixing/), [Skincare Time](https://playables.games/games/skincare-time-makeover-asmr/): independent catalogue, not official analytics.
- [MediaCube mechanics article](https://mediacube.io/en/blog/youtube-playables-game-mechanics): September 2026 publication/update; its early-September average-play metric is cumulative plays divided by days, not today's velocity.
- [HDuo Makeup Stylist Android](https://play.google.com/store/apps/details?id=diy.makeup.master.artist.stylist&hl=en_US), [French review sample](https://play.google.com/store/apps/details?id=diy.makeup.master.artist.stylist&hl=fr).
- [Makeup Kit Android](https://play.google.com/store/apps/details?id=com.apetrus.makeup&hl=en_US), [Brazilian review sample](https://play.google.com/store/apps/details?id=com.apetrus.makeup&hl=pt_BR), [DIY Makeup](https://play.google.com/store/apps/details?id=com.crazylabs.diy.make.up&hl=en_US).
- [Makeup Artist iOS US](https://apps.apple.com/us/app/makeup-artist-makeup-games/id1561923965), [historical review page](https://apps.apple.com/us/app/makeup-artist-makeup-games/id1561923965?see-all=reviews).
- [Toca Hair Salon 4 Android](https://play.google.com/store/apps/details?id=com.tocaboca.tocahairsalon4&hl=en_US), [iOS Canada](https://apps.apple.com/ca/app/toca-boca-hair-salon-4/id1485387513).
- [Super Stylist Android](https://play.google.com/store/apps/details?id=com.cocoplay.fashion.style&hl=en_US), [Project Makeover Android](https://play.google.com/store/apps/details?id=com.bgg.jump&hl=en_US).
- [Makeup Mania official Roblox](https://www.roblox.com/games/117935850321807/Makeup-Mania-BETA), [Rolimon's third-party tracker](https://www.rolimons.com/game/117935850321807), [Paint Me Pretty](https://www.roblox.com/games/96044186988317/Paint-Me-Pretty-Makeup), [Dress To Impress](https://www.roblox.com/games/15101393044/Dress-To-Impress), [Roblox December 2025 creative-search report](https://about.roblox.com/newsroom/2025/12/roblox-replay-decoded-search-style).
- [Diva Makeup Studio](https://poki.com/en/g/diva-makeup-studio), [Diamond Makeup](https://poki.com/en/g/diamond-makeup), [Makeup Studio Glam Diva](https://www.crazygames.com/game/makeup-studio-glam-diva).

### Platform sources rechecked for this contract

- [YouTube monetization](https://developers.google.com/youtube/gaming/playables/reference/monetization): host pre-roll, natural-break/optional rewarded formats, availability and fallback. Selected ad pacing is the owner's game decision.
- [Integration](https://developers.google.com/youtube/gaming/playables/certification/requirements_integration): readiness, cloud save, host pause/audio; optional progress reporting. Protective adapter safeguards beyond these requirements are inherited studio behavior.
- [SDK reference](https://developers.google.com/youtube/gaming/playables/reference/sdk): SDK identity, environment mode, ad result/placement semantics and API signatures.
- [Design](https://developers.google.com/youtube/gaming/playables/certification/requirements_design): input, responsive retained state and host UI boundaries.
- [Stability](https://developers.google.com/youtube/gaming/playables/certification/requirements_stability): numerical official bundle/save/file/memory requirements and recommendations, distinguished from studio targets.
- [Privacy/data](https://developers.google.com/youtube/gaming/playables/certification/requirements_privacydata): external access, personal information, reviewability and single-page requirement.
- [Localization](https://developers.google.com/youtube/gaming/playables/certification/requirements_i18n_l10n): host locale and English support.
- [SDK test suite / response-header CSP](https://developers.google.com/youtube/gaming/playables/reference/test_suite_guide): apply the current published policy during testing; host acceptance remains separate.

### Immutable Haircut files inspected / reuse map

Use revision `ed50f09c8b3fed4dda3c5a4f7ab0fc6f9006520c` for every path below:

- [MediaCube README](https://github.com/lrodeveloperr/Haircut/blob/ed50f09c8b3fed4dda3c5a4f7ab0fc6f9006520c/mediacube/README.md) and [BUILD-v3.101.json](https://github.com/lrodeveloperr/Haircut/blob/ed50f09c8b3fed4dda3c5a4f7ab0fc6f9006520c/mediacube/BUILD-v3.101.json): route, exact reference archive and evidence limits.
- [YouTube client](https://github.com/lrodeveloperr/Haircut/blob/ed50f09c8b3fed4dda3c5a4f7ab0fc6f9006520c/source/youtube/client.js), [loader](https://github.com/lrodeveloperr/Haircut/blob/ed50f09c8b3fed4dda3c5a4f7ab0fc6f9006520c/source/youtube/loader.js), [build transformation](https://github.com/lrodeveloperr/Haircut/blob/ed50f09c8b3fed4dda3c5a4f7ab0fc6f9006520c/source/youtube/build.py), [packager](https://github.com/lrodeveloperr/Haircut/blob/ed50f09c8b3fed4dda3c5a4f7ab0fc6f9006520c/source/youtube/package.py): protection, request ordering, readiness and reproducibility patterns.
- [Customer metadata](https://github.com/lrodeveloperr/Haircut/blob/ed50f09c8b3fed4dda3c5a4f7ab0fc6f9006520c/source/customers/meta.js), [completion/replay hub](https://github.com/lrodeveloperr/Haircut/blob/ed50f09c8b3fed4dda3c5a4f7ab0fc6f9006520c/source/customers/hub.js), [wardrobe/reward adapter](https://github.com/lrodeveloperr/Haircut/blob/ed50f09c8b3fed4dda3c5a4f7ab0fc6f9006520c/source/customers/wardrobe.js): reusable orchestration, not makeup content/ownership rules.
- [Release workflow](https://github.com/lrodeveloperr/Haircut/blob/ed50f09c8b3fed4dda3c5a4f7ab0fc6f9006520c/.github/workflows/youtube-release.yml): exact extracted-archive CI pattern. Builder must inspect and adapt `qa/youtube-contracts.cjs`, `qa/youtube-browser.cjs` and `qa/youtube-cache-urls.py`; those are reference tests, not supplied/passed makeup tests.
- [Haircut AGENTS.md](https://github.com/lrodeveloperr/Haircut/blob/ed50f09c8b3fed4dda3c5a4f7ab0fc6f9006520c/AGENTS.md): preserves that repository's owner constraints. Its Android two-video rule does not override the later makeup-specific one-video decision recorded here.
