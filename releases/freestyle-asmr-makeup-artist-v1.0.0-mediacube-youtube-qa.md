# QA ledger: freestyle-asmr-makeup-artist-v1.0.0-mediacube-youtube

- Archive SHA-256: `1ae570ffbafd9cbaace7fed01581c7e44f28f202a1f332c450369612b8f85a7e`
- Source commit: `931927363a9622a89d3740f89ede9cc31df289e8`
- Ran: 2026-10-21T05:05:16.580Z, GitHub Actions run 39543566017, Node v22.23.3, linux x64, headless Chromium (Playwright)
- Result: **13/13 PASS**

| ID | Suite | Covers | Result | Checks | Time |
| --- | --- | --- | --- | --- | --- |
| UNIT | Face system unit tests | face generator, geometry, saves of faces | PASS | 9 | 5.4s |
| MAKEUP | Makeup domain | G01–G05, G07 | PASS | 18 | 0.5s |
| GAME | Game logic: lifecycle, daily colour, cadence, saves | FLOW01–03, R01–R06, AD01–AD06, SAVE01–SAVE05, METRIC01 | PASS | 12 | 0.3s |
| CONTENT01 | Face audit, 2,000 faces | CONTENT01 | PASS | 0 | 26s |
| SIZE | Download size budget | §14 budgets | PASS | 0 | 0.2s |
| PACK01 | Rebuilt ZIP is byte-identical | PACK01 | PASS | 1 | 0s |
| PACK-EXTRACT | Extracted ZIP matches the manifest file by file | PACK01 | PASS | 1 | 0s |
| GAME-BROWSER | Full game flow in the browser (SDK stand-in injected) | FLOW01–03, R01–R02, AD03, AD05, AD07, SAVE03, BOOT01, LIFE01–02, UI02 (textless) | PASS | 8 | 786.1s |
| UI01 | Layout on 30 screens, portrait and landscape | UI01 | PASS | 0 | 217.5s |
| INPUTS | Every tool by finger, mouse and pen | G01–G06 | PASS | 72 | 379.8s |
| ZONES | Touch zones of every tool | G01–G05 (assisted touch) | PASS | 18 | 1035.1s |
| SOUND | Sounds keep time with the hand | LIFE02 (audio paths) | PASS | 0 | 1.3s |
| RENDER | Faces and tools render; touch and patch redraws | RECOVERY01 (render), CONTENT01 (visual) | PASS | 0 | 158.2s |

## Not run

- BROWSER01 (Firefox, WebKit, Edge): NOT RUN: the suites run in Chromium only
- DEVICE01 (physical Android/iOS in the YouTube app): NOT RUN here: owner play-through on a phone is recorded in README, not as evidence for these bytes
- PERF01 (cold/warm first playable on a named device): NOT RUN
- SOAK01 (50 transitions, 10 active minutes): NOT RUN
- HOST01 (McPlay pre-flight on these bytes): NOT RUN at ledger time
- HOST02 (real host saves and test-inventory ads): NOT RUN
- HOST03 (listing answers): see the McPlay listing record
