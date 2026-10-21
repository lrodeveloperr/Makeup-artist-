// Select the release host without leaking platform checks into the game.
// YouTube remains the default so the existing Playables build is unchanged.
import { createHost as createYouTubeHost } from './youtube.js';
import { createMiniGameHost } from './minigame.js';
import { createGamePushHost } from './gamepush.js';

export function createHost(options = {}) {
  if (globalThis.MAKEUP_PLATFORM === 'minigame') return createMiniGameHost(options);
  if (globalThis.MAKEUP_PLATFORM === 'gamepush') return createGamePushHost(options);
  return createYouTubeHost(options);
}
