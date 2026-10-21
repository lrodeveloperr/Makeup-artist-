# App icon

Option A, "Glam close-up" (owner's pick, 21 October 2026): the icon players tap to open the game on iOS, Android and
game portals. It is a real render from the game: one of its customers in full glam (magenta shimmer lids, winged
liner, aqua lenses, heart gems, glossy hot-pink lips) with the game's lipstick touching her lip, on the logo's rose
glow with gold and white sparkles.

| File | Use |
|------|-----|
| `freestyle-asmr-makeup-artist-icon-1024.png` | iOS App Store and the master: 1024 × 1024, opaque, square corners (iOS rounds them) |
| `freestyle-asmr-makeup-artist-icon-512.png` | Google Play: 512 × 512, opaque |
| `android/ic_launcher_foreground.png` | Android adaptive icon foreground: 432 × 432 (108 dp at xxxhdpi), transparent |
| `android/ic_launcher_background.png` | Android adaptive icon background: 432 × 432, the rose glow |

- **Android layers:** the 1024 design fills the 72 dp viewport. The layers carry 18 dp of bleed on every side (her
  shoulders, dress and the glow), so circle, squircle and teardrop masks and the parallax shift never show an edge.
  Her eyes and lips sit inside the 66 dp safe zone.
- **Checked** at 180, 120, 76, 60 and 48 px, under the iOS mask and the Android circle, on light and dark screens.
  The face, lenses and lips read at every size; the gems drop out below about 60 px.
- **Colours:** the logo's rose (`#ffd3e3` to `#e5487f`), gold `#ffb627` and white.
