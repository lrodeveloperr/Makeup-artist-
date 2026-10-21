// TEST FIXTURE: a stand-in for the GamePush SDK, for the GamePush browser test (tests/gamepush-smoke.mjs). It is
// never part of an upload. It resolves globalThis.gpReady with an object shaped like the documented SDK:
//   gp.player: ready, get, set, sync          (the 'save' field kept in localStorage)
//   gp.ads: showFullscreen, showRewardedVideo, is*Available, on/off('start'|'close'), resolving at once
//   gp.on/off('pause'|'resume'), gp.sounds (isMuted, isSFXMuted, on/off), gp.language
//   gp.gameStart, gameplayStart, gameplayStop
// Automation: window.__fakeAds = { rewarded: true|false, fullscreen: true|false, noRewarded: true }; window.__gpLog
// records every call; window.__gp.__pause() / __resume() / __mute(on) play the host.
(function () {
  const KEY = 'fake-gamepush-save';
  const log = (globalThis.__gpLog = []);
  const opts = () => globalThis.__fakeAds || {};
  function emitter() {
    const map = new Map();
    return {
      on(e, fn) { if (!map.has(e)) map.set(e, new Set()); map.get(e).add(fn); },
      off(e, fn) { map.get(e)?.delete(fn); },
      emit(e, ...a) { for (const fn of [...(map.get(e) || [])]) fn(...a); },
    };
  }
  const core = emitter(), adEv = emitter(), soundEv = emitter();
  const sounds = { isMuted: false, isSFXMuted: false, on: soundEv.on, off: soundEv.off };
  const later = (v) => new Promise((r) => setTimeout(() => r(v), 30));
  async function show(kind, result) {
    log.push(kind);
    adEv.emit('start'); core.emit('pause');
    const v = await later(result);
    adEv.emit('close', v); core.emit('resume');
    return v;
  }
  const gp = {
    language: 'en', isPaused: false,
    on: core.on, off: core.off,
    sounds,
    player: {
      ready: later(true),
      get(field) { log.push('get:' + field); try { return field === 'save' ? localStorage.getItem(KEY) || '' : ''; } catch { return ''; } },
      set(field, v) { log.push('set:' + field); if (field === 'save') try { localStorage.setItem(KEY, v); } catch { /* */ } },
      async sync() { log.push('sync'); return true; },
    },
    ads: {
      get isRewardedAvailable() { return !opts().noRewarded; },
      isFullscreenAvailable: true,
      on: adEv.on, off: adEv.off,
      showFullscreen() { return show('fullscreen', opts().fullscreen !== false); },
      showRewardedVideo() { return show('rewarded', opts().rewarded !== false); },
    },
    gameStart() { log.push('gameStart'); },
    gameplayStart() { log.push('gameplayStart'); },
    gameplayStop() { log.push('gameplayStop'); },
    __pause() { gp.isPaused = true; core.emit('pause'); },
    __resume() { gp.isPaused = false; core.emit('resume'); },
    __mute(on) { sounds.isMuted = on; soundEv.emit(on ? 'mute' : 'unmute'); },
  };
  globalThis.__gp = gp;
  globalThis.gpReady = later(gp);
})();
