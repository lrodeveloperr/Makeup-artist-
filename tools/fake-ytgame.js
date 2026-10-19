// TEST FIXTURE: a stand-in for the YouTube Playables SDK (https://www.youtube.com/game_api/v1), for browser
// tests and the development page. It is never part of an upload. Ads are a labelled overlay:
//   interstitial: closes itself after a moment
//   rewarded:     "Skip" (not earned) or "Watch to the end" (earned)
// Automation: window.__fakeAds = { auto: true, rewarded: true|false, interstitialFails: false } answers without
// clicks; window.__adLog records every SDK call; window.ytgame.__pause() / __resume() play the host.
(function () {
  if (globalThis.ytgame) return;
  // on the development page the stand-in is opt-in: add ?testads to the address
  if (globalThis.MAKEUP_DEV && !/[?&]testads\b/.test(location.search)) return;
  const KEY = 'fake-ytgame-save';
  const log = (globalThis.__adLog = []);
  const opts = () => globalThis.__fakeAds || {};
  const pauseCbs = new Set(), resumeCbs = new Set();
  function overlay(title, buttons) {
    return new Promise((resolve) => {
      const el = document.createElement('div');
      el.setAttribute('data-test-ad', '');
      el.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;gap:16px;align-items:center;justify-content:center;background:#111d;color:#fff;font:600 20px system-ui,sans-serif';
      el.innerHTML = `<div>TEST AD</div><div style="font-size:14px;opacity:.8">${title}</div>`;
      const done = (v) => { el.remove(); resolve(v); };
      for (const [label, value] of buttons) {
        const b = document.createElement('button');
        b.textContent = label;
        b.style.cssText = 'font:inherit;padding:10px 18px;border-radius:22px;border:0';
        b.onclick = () => done(value);
        el.appendChild(b);
      }
      document.body.appendChild(el);
      if (opts().auto) setTimeout(() => done(buttons.at(-1)[1] === true ? opts().rewarded !== false : buttons.at(-1)[1]), 200);
    });
  }
  globalThis.ytgame = {
    IN_PLAYABLES_ENV: true,
    SDK_VERSION: 'test-fixture',
    game: {
      firstFrameReady() { log.push('firstFrameReady'); },
      gameReady() { log.push('gameReady'); },
      async loadData() { log.push('loadData'); return localStorage.getItem(KEY) ?? ''; },
      async saveData(data) { log.push('saveData'); localStorage.setItem(KEY, data); },
    },
    system: {
      isAudioEnabled: () => true,
      onAudioEnabledChange: () => () => {},
      onPause(cb) { pauseCbs.add(cb); return () => pauseCbs.delete(cb); },
      onResume(cb) { resumeCbs.add(cb); return () => resumeCbs.delete(cb); },
      getLanguage: async () => 'en',
    },
    engagement: { sendScore: async () => {} },
    health: { logError() {}, logWarning() {} },
    ads: {
      async requestInterstitialAd() {
        log.push('interstitial');
        if (opts().interstitialFails) throw new Error('no fill');
        await overlay('Interstitial', [['Close', undefined]]);
      },
      async requestRewardedAd(id) {
        log.push(`rewarded:${id}`);
        return overlay(`Rewarded: ${id}`, [['Skip', false], ['Watch to the end', true]]);
      },
    },
    __pause() { log.push('pause'); for (const cb of pauseCbs) cb(); },
    __resume() { log.push('resume'); for (const cb of resumeCbs) cb(); },
  };
})();
