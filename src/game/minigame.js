// MiniGame's JavaScript SDK adapter. Core gameplay only sees the common host interface.
const SAVE_KEY = 'worksbienMakeupSaveV1';

const bytes = (text) => new TextEncoder().encode(text).byteLength;

export function createMiniGameHost({ sdk = globalThis.minigame, ads = globalThis.MiniGameAds } = {}) {
  if (!sdk?.initializeAsync || !sdk?.startGameAsync || !sdk?.player) {
    throw Object.assign(new Error('The MiniGame SDK could not load'), { code: 'SDK_MISSING' });
  }
  const reasons = new Set(), listeners = new Set(), cleanup = [];
  let adPending = false, started = false, disposed = false;
  const state = () => ({ paused: reasons.size > 0, hostPaused: reasons.has('host'), ad: reasons.has('ad'), audio: reasons.size === 0 });
  const publish = () => { for (const cb of [...listeners]) cb(state()); };
  const pause = (reason, on) => { if (on) reasons.add(reason); else reasons.delete(reason); publish(); };
  const whenResumed = () => (state().paused ? new Promise((resolve) => {
    const cb = (st) => { if (!st.paused || disposed) { listeners.delete(cb); resolve(); } };
    listeners.add(cb);
  }) : Promise.resolve());
  const initialized = Promise.resolve().then(() => sdk.initializeAsync());
  const visibility = () => { pause('host', document.hidden); if (document.hidden) host.onPause?.(); };
  document.addEventListener('visibilitychange', visibility);
  cleanup.push(() => document.removeEventListener('visibilitychange', visibility));

  const host = {
    environment: 'minigame',
    rewardedSupported: typeof ads?.showRewardedVideo === 'function',
    interstitialSupported: typeof ads?.showInterstitial === 'function',
    onPause: null,
    state,
    whenResumed,
    onState(cb) { listeners.add(cb); cb(state()); return () => listeners.delete(cb); },
    async load() {
      await initialized;
      const data = await sdk.player.getDataAsync([SAVE_KEY]);
      return typeof data?.[SAVE_KEY] === 'string' ? data[SAVE_KEY] : null;
    },
    async save(text) {
      if (bytes(text) >= 1024 * 1024) throw new Error('The save is over the platform limit');
      await initialized;
      await sdk.player.setDataAsync({ [SAVE_KEY]: text });
    },
    async interstitial() {
      if (!host.interstitialSupported || adPending || reasons.has('host')) return false;
      adPending = true; pause('ad', true);
      try { await ads.showInterstitial(); return true; } catch { return false; }
      finally { pause('ad', false); adPending = false; await whenResumed(); }
    },
    async rewarded() {
      if (!host.rewardedSupported || adPending || reasons.has('host')) return false;
      adPending = true; pause('ad', true);
      try { return (await ads.showRewardedVideo()) === true; } catch { return false; }
      finally { pause('ad', false); adPending = false; await whenResumed(); }
    },
    firstFrameReady() { try { sdk.setLoadingProgress?.(5); } catch { /* best effort */ } },
    async gameReady() {
      await initialized;
      if (!started) {
        started = true;
        sdk.setLoadingProgress?.(100);
        await sdk.startGameAsync();
        await sdk.setGameReadyAsync?.();
      }
    },
    async language() {
      const value = globalThis.MiniGameSDK?.getLocale?.() || navigator.language || 'en';
      return String(value).slice(0, 2).toLowerCase();
    },
    destroy() { disposed = true; for (const off of cleanup) off(); publish(); listeners.clear(); },
  };
  visibility();
  return host;
}
