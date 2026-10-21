// The host for the GamePush build (gamepush.com: one SDK in front of CrazyGames, GameDistribution, GamePix, Y8,
// Yandex, VK and other portals). The same interface as youtube.js, so the game and its rules do not change:
//   load/save              the player's 'save' field (a string field declared in the GamePush panel), synced
//   interstitial()         gp.ads.showFullscreen(): at Next only, under the game's own cadence (session.js); the SDK
//                          adds its own frequency timer, so a refused request is normal and keeps the cadence
//   rewarded(placement)    gp.ads.showRewardedVideo(): strict true only when the reward was earned
//   pause / audio          GamePush pause/resume, its ad start/close and its sound mute events
//   gameReady()            gp.gameStart() then gp.gameplayStart(); gameplayStop/Start follow pauses and ads
// No banner (sticky) and no preloader ad: the owner's ad rules allow only the two rewarded videos and the
// interstitial at Next (contract §7).
// The SDK is loaded by the page (game/index.html, the GAMEPUSH host block), which resolves globalThis.gpReady.
const MAX_SAVE = 900 * 1024; // GamePush keeps a player's whole profile under 1 MB
const SDK_WAIT = 20000; // a GamePush SDK that has not started by then is missing
const FIELD = 'save';

const bytes = (text) => new TextEncoder().encode(text).byteLength;

export function createHost({ ready = globalThis.gpReady } = {}) {
  if (!ready || typeof ready.then !== 'function') throw Object.assign(new Error('The GamePush SDK loader is missing'), { code: 'SDK_MISSING' });
  const reasons = new Set(), listeners = new Set(), cleanup = [];
  let gp = null, adPending = false, ready_ = false, disposed = false, playing = false, muted = false;
  const state = () => ({ paused: reasons.size > 0, hostPaused: reasons.has('host'), ad: reasons.has('ad'), audio: !muted && reasons.size === 0 });
  const gameplay = () => {
    if (!gp || !ready_) return;
    const want = reasons.size === 0;
    if (want === playing) return;
    playing = want;
    try { if (want) gp.gameplayStart(); else gp.gameplayStop(); } catch { /* reporting is best effort */ }
  };
  const publish = () => { gameplay(); for (const cb of [...listeners]) cb(state()); };
  const pause = (reason, on) => { if (on) reasons.add(reason); else reasons.delete(reason); publish(); };
  const whenResumed = () => (state().paused ? new Promise((resolve) => {
    const cb = (st) => { if (!st.paused || disposed) { listeners.delete(cb); resolve(); } };
    listeners.add(cb);
  }) : Promise.resolve());
  const on = (emitter, event, fn) => { try { emitter.on(event, fn); cleanup.push(() => { try { emitter.off?.(event, fn); } catch { /* */ } }); } catch { /* an SDK without this event */ } };

  // the SDK, with its player synced; registered on the SDK before the game can read or write anything
  const sdk = Promise.race([
    ready,
    new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error('The GamePush SDK did not start'), { code: 'SDK_MISSING' })), SDK_WAIT)),
  ]).then(async (instance) => {
    if (!instance?.ads || !instance.player) throw Object.assign(new Error('The GamePush SDK is incomplete'), { code: 'SDK_MISSING' });
    gp = instance;
    muted = sfxMuted(gp);
    on(gp, 'pause', () => { pause('host', true); host.onPause?.(); });
    on(gp, 'resume', () => pause('host', false));
    on(gp.ads, 'start', () => pause('ad', true));
    on(gp.ads, 'close', () => { if (!adPending) pause('ad', false); });
    for (const e of ['mute', 'unmute', 'mute:sfx', 'unmute:sfx']) on(gp.sounds || {}, e, () => { muted = sfxMuted(gp); publish(); });
    if (gp.isPaused) pause('host', true);
    await gp.player.ready;
    return gp;
  });

  const host = {
    environment: 'gamepush',
    // read when the screens render, after load(): GamePush knows by then what this portal offers
    get rewardedSupported() { return !!gp && gp.ads.isRewardedAvailable !== false; },
    get interstitialSupported() { return !!gp && gp.ads.isFullscreenAvailable !== false; },
    onPause: null,
    state,
    whenResumed,
    onState(cb) { listeners.add(cb); cb(state()); return () => listeners.delete(cb); },
    async load() {
      await sdk;
      await whenResumed();
      const raw = gp.player.get(FIELD);
      return typeof raw === 'string' ? raw : null;
    },
    async save(text) {
      if (bytes(text) >= MAX_SAVE) throw new Error('The save is over the platform limit');
      await sdk;
      gp.player.set(FIELD, text);
      const ok = await gp.player.sync();
      if (ok === false) throw new Error('GamePush did not sync the save');
    },
    async interstitial() {
      if (!host.interstitialSupported || adPending || reasons.has('host')) return false;
      adPending = true; pause('ad', true);
      let accepted = false;
      try { accepted = (await gp.ads.showFullscreen()) !== false; } catch { accepted = false; }
      pause('ad', false); adPending = false;
      await whenResumed();
      return accepted;
    },
    async rewarded() {
      if (!host.rewardedSupported || adPending || reasons.has('host')) return false;
      adPending = true; pause('ad', true);
      let earned = false;
      try { earned = (await gp.ads.showRewardedVideo()) === true; } catch { earned = false; }
      pause('ad', false); adPending = false;
      await whenResumed();
      return earned;
    },
    firstFrameReady() {},
    async gameReady() {
      await sdk;
      await whenResumed();
      if (ready_) return;
      ready_ = true;
      try { gp.gameStart(); } catch { /* not every portal needs it */ }
      publish();
    },
    async language() { try { await sdk; return gp.language || 'en'; } catch { return 'en'; } },
    destroy() {
      disposed = true;
      for (const off of cleanup) off();
      publish(); listeners.clear();
    },
  };
  return host;
}

function sfxMuted(gp) {
  try { return gp.sounds?.isMuted === true || gp.sounds?.isSFXMuted === true; } catch { return false; }
}
