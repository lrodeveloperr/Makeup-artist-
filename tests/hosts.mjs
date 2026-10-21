// Fast contract checks for the MiniGame and GamePush release adapters.
import assert from 'node:assert/strict';

const events = new EventTarget();
globalThis.document = {
  hidden: false,
  addEventListener: (...args) => events.addEventListener(...args),
  removeEventListener: (...args) => events.removeEventListener(...args),
};
globalThis.localStorage = (() => {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
})();
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { language: 'en-CA' } });

const { createMiniGameHost } = await import('../src/game/minigame.js');
const { createGamePushHost } = await import('../src/game/gamepush.js');

{
  const calls = [], data = {};
  const sdk = {
    player: {
      async getDataAsync(keys) { calls.push(`load:${keys.join(',')}`); return data; },
      async setDataAsync(next) { calls.push('save'); Object.assign(data, next); },
    },
    async initializeAsync() { calls.push('initialize'); },
    async startGameAsync() { calls.push('start'); },
    async setGameReadyAsync() { calls.push('ready'); },
    setLoadingProgress(value) { calls.push(`progress:${value}`); },
  };
  const ads = {
    async showInterstitial() { calls.push('interstitial'); },
    async showRewardedVideo() { calls.push('rewarded'); return true; },
  };
  const host = createMiniGameHost({ sdk, ads });
  assert.equal(await host.load(), null);
  await host.save('state');
  assert.equal(await host.load(), 'state');
  assert.equal(await host.interstitial(), true);
  assert.equal(await host.rewarded(), true);
  host.firstFrameReady();
  await host.gameReady();
  assert.deepEqual(calls, ['initialize', 'load:worksbienMakeupSaveV1', 'save', 'load:worksbienMakeupSaveV1', 'interstitial', 'rewarded', 'progress:5', 'progress:100', 'start', 'ready']);
  host.destroy();
}

{
  const calls = [];
  const gp = {
    player: { ready: Promise.resolve() },
    ads: {
      isFullscreenAvailable: true,
      isRewardedAvailable: true,
      async showFullscreen() { calls.push('interstitial'); },
      async showRewardedVideo() { calls.push('rewarded'); return true; },
    },
    gameStart() { calls.push('start'); },
  };
  const host = createGamePushHost({ ready: Promise.resolve(gp) });
  assert.equal(await host.load(), null);
  await host.save('state');
  assert.equal(await host.load(), 'state');
  assert.equal(await host.interstitial(), true);
  assert.equal(await host.rewarded(), true);
  await host.gameReady();
  assert.deepEqual(calls, ['interstitial', 'rewarded', 'start']);
  host.destroy();
}

console.log('2 platform host checks passed');
