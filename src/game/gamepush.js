// GamePush SDK adapter for distribution builds. Saves remain local; ads and readiness use GamePush.
const STORE_KEY = 'worksbien-makeup-gamepush-v1';

function store() {
  let memory = null, denied = false;
  return {
    get() { if (denied) return memory; try { return localStorage.getItem(STORE_KEY); } catch { denied = true; return memory; } },
    set(text) { memory = text; if (denied) return; try { localStorage.setItem(STORE_KEY, text); } catch { denied = true; } },
  };
}

export function createGamePushHost({ ready = globalThis.MAKEUP_GP } = {}) {
  if (!ready?.then) throw Object.assign(new Error('The GamePush SDK could not load'), { code: 'SDK_MISSING' });
  const saved = store(), reasons = new Set(), listeners = new Set(), cleanup = [];
  let adPending = false, started = false, disposed = false;
  const state = () => ({ paused: reasons.size > 0, hostPaused: reasons.has('host'), ad: reasons.has('ad'), audio: reasons.size === 0 });
  const publish = () => { for (const cb of [...listeners]) cb(state()); };
  const pause = (reason, on) => { if (on) reasons.add(reason); else reasons.delete(reason); publish(); };
  const whenResumed = () => (state().paused ? new Promise((resolve) => {
    const cb = (st) => { if (!st.paused || disposed) { listeners.delete(cb); resolve(); } };
    listeners.add(cb);
  }) : Promise.resolve());
  const sdk = Promise.resolve(ready).then(async (gp) => { await gp.player?.ready; return gp; });
  const visibility = () => { pause('host', document.hidden); if (document.hidden) host.onPause?.(); };
  document.addEventListener('visibilitychange', visibility);
  cleanup.push(() => document.removeEventListener('visibilitychange', visibility));

  const host = {
    environment: 'gamepush', rewardedSupported: true, interstitialSupported: true, onPause: null,
    state,
    whenResumed,
    onState(cb) { listeners.add(cb); cb(state()); return () => listeners.delete(cb); },
    async load() { await sdk; return saved.get(); },
    async save(text) { await sdk; saved.set(text); },
    async interstitial() {
      const gp = await sdk;
      if (adPending || reasons.has('host') || gp.ads?.isFullscreenAvailable === false) return false;
      adPending = true; pause('ad', true);
      try { await gp.ads.showFullscreen(); return true; } catch { return false; }
      finally { pause('ad', false); adPending = false; await whenResumed(); }
    },
    async rewarded() {
      const gp = await sdk;
      if (adPending || reasons.has('host') || gp.ads?.isRewardedAvailable === false) return false;
      adPending = true; pause('ad', true);
      try { return (await gp.ads.showRewardedVideo()) === true; } catch { return false; }
      finally { pause('ad', false); adPending = false; await whenResumed(); }
    },
    firstFrameReady() {},
    async gameReady() { const gp = await sdk; if (!started) { started = true; gp.gameStart?.(); } },
    async language() { return String(navigator.language || 'en').slice(0, 2).toLowerCase(); },
    destroy() { disposed = true; for (const off of cleanup) off(); publish(); listeners.clear(); },
  };
  visibility();
  return host;
}
