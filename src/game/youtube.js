// The host: the YouTube Playables SDK (contract §10–§11; the pattern of Haircut's direct YouTube client).
//   'youtube'       inside YouTube (ytgame.IN_PLAYABLES_ENV true): cloud saves, ads
//   'off-platform'  the real SDK outside YouTube: its own local saves, no ads
//   'dev'           the development page only, which asks for it explicitly: local saves, no ads
// In the YouTube build a missing SDK is an error that offers Retry, never a quiet fallback.
const MAX_SAVE = 3 * 1024 * 1024; // the platform's absolute save limit, in bytes
const REQUEST_GAP = 60000; // at least a minute between interstitial requests, even refused ones

// local saves for off-platform and dev pages (memory only where storage is denied)
function localStore(key) {
  let memory = null, denied = false;
  return {
    get() { if (denied) return memory; try { return localStorage.getItem(key); } catch { denied = true; return memory; } },
    set(text) { memory = text; if (denied) return; try { localStorage.setItem(key, text); } catch { denied = true; } },
  };
}
const bytes = (text) => new TextEncoder().encode(text).byteLength;

export function createHost({ sdk = globalThis.ytgame, dev = false } = {}) {
  if (!sdk?.game || !sdk.system) {
    if (dev) return devHost();
    throw Object.assign(new Error('The YouTube Playables SDK could not load'), { code: 'SDK_MISSING' });
  }
  const hosted = sdk.IN_PLAYABLES_ENV === true;
  const store = hosted ? null : localStore('worksbien-makeup-offplatform-v1');
  const reasons = new Set(), listeners = new Set(), cleanup = [];
  let adPending = false, lastRequest = -Infinity, framed = false, ready = false, disposed = false;
  let audio = (() => { try { return sdk.system.isAudioEnabled?.() !== false; } catch { return true; } })();
  // audio: the host allows sound and nothing pauses the game
  const state = () => ({ paused: reasons.size > 0, hostPaused: reasons.has('host'), ad: reasons.has('ad'), audio: audio && reasons.size === 0 });
  const publish = () => { for (const cb of [...listeners]) cb(state()); };
  const pause = (reason, on) => { if (on) reasons.add(reason); else reasons.delete(reason); publish(); };
  const report = () => { try { sdk.health?.logWarning?.(); } catch { /* reporting is best effort */ } };
  // resolves once nothing pauses the game (an ad result never clears a host pause)
  const whenResumed = () => (state().paused ? new Promise((resolve) => {
    const cb = (st) => { if (!st.paused || disposed) { listeners.delete(cb); resolve(); } };
    listeners.add(cb);
  }) : Promise.resolve());

  const host = {
    environment: hosted ? 'youtube' : 'off-platform',
    rewardedSupported: hosted && typeof sdk.ads?.requestRewardedAd === 'function',
    interstitialSupported: hosted && typeof sdk.ads?.requestInterstitialAd === 'function',
    onPause: null, // set by the game: end the gesture and save (the SDK's final-save window)
    state,
    whenResumed,
    onState(cb) { listeners.add(cb); cb(state()); return () => listeners.delete(cb); },
    async load() {
      await whenResumed();
      const raw = hosted ? await sdk.game.loadData() : store.get();
      await whenResumed();
      return raw;
    },
    async save(text) {
      if (bytes(text) >= MAX_SAVE) throw new Error('The save is over the platform limit');
      if (hosted) await sdk.game.saveData(text); else store.set(text);
    },
    // true when the request was accepted (the SDK does not confirm a shown ad)
    async interstitial() {
      if (!host.interstitialSupported || adPending || reasons.has('host') || performance.now() - lastRequest < REQUEST_GAP) return false;
      adPending = true; pause('ad', true);
      let accepted = false;
      try { lastRequest = performance.now(); await sdk.ads.requestInterstitialAd(); accepted = true; } catch { report(); }
      pause('ad', false); adPending = false;
      await whenResumed();
      return accepted;
    },
    // true only when the SDK reports the reward as earned
    async rewarded(placement) {
      if (!host.rewardedSupported || adPending || reasons.has('host')) return false;
      adPending = true; pause('ad', true);
      let earned = false;
      try { earned = (await sdk.ads.requestRewardedAd(placement)) === true; } catch { report(); }
      pause('ad', false); adPending = false;
      await whenResumed();
      return earned;
    },
    // the loading screen is on screen
    firstFrameReady() { if (!framed) { framed = true; try { sdk.game.firstFrameReady(); } catch { report(); } } },
    // the face is on screen and the player can play
    async gameReady() { await whenResumed(); if (!ready) { ready = true; sdk.game.gameReady(); } },
    async language() { try { return (await sdk.system.getLanguage()) || 'en'; } catch { report(); return 'en'; } },
    destroy() {
      disposed = true;
      for (const off of cleanup) if (typeof off === 'function') off();
      publish(); listeners.clear();
    },
  };
  // registered before anything asynchronous, so an early pause is not missed
  cleanup.push(sdk.system.onPause(() => { pause('host', true); host.onPause?.(); }));
  cleanup.push(sdk.system.onResume(() => pause('host', false)));
  cleanup.push(sdk.system.onAudioEnabledChange?.((on) => { audio = on !== false; publish(); }));
  return host;
}

function devHost() {
  const store = localStore('worksbien-makeup-dev-v1');
  const state = () => ({ paused: false, hostPaused: false, ad: false, audio: true });
  return {
    environment: 'dev', rewardedSupported: false, interstitialSupported: false, onPause: null, state,
    whenResumed: () => Promise.resolve(),
    onState(cb) { cb(state()); return () => {}; },
    load: async () => store.get(),
    save: async (text) => store.set(text),
    interstitial: async () => false,
    rewarded: async () => false,
    firstFrameReady() {}, gameReady: async () => {}, language: async () => 'en', destroy() {},
  };
}
