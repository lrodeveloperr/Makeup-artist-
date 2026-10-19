// When an interstitial may play (contract §7, owner decisions 19 October 2026). The only place is the player's
// Next from review after a finished look that changed the face; then, systematically, one interstitial for every
// second finished look. The contract's guards stay: at least a minute of actual making since the last break, a
// minute between interstitial requests, and a minute after a rewarded video. A rewarded video also stands in for
// the next interstitial: that break is skipped and counting starts again.
//
// Persisted: { qualified (finished looks since the last break), activeMs (making time since then), rewardCredit }.
// The two timestamps (last interstitial request, last rewarded video) are runtime only, as in Haircut.
export const CADENCE = { looks: 2, activeMs: 60000, requestGapMs: 60000, rewardGapMs: 60000 };

export const createCadence = () => ({ qualified: 0, activeMs: 0, rewardCredit: false });

export const validCadence = (c) => !!c && Number.isSafeInteger(c.qualified) && c.qualified >= 0 &&
  Number.isSafeInteger(c.activeMs) && c.activeMs >= 0 && typeof c.rewardCredit === 'boolean';

// unpaused making time; a single step is bounded so a stalled frame or a resume never adds a jump
export const addActive = (c, ms) => ({ ...c, activeMs: Math.min(c.activeMs + Math.round(Math.min(Math.max(ms, 0), 1000)), 2 ** 40) });
// a finished look that changed the face (counted once per attempt by the game)
export const countLook = (c) => ({ ...c, qualified: Math.min(c.qualified + 1, 2 ** 40) });
// a rewarded video was earned
export const rewarded = (c) => ({ ...c, rewardCredit: true });
// a break happened (interstitial request accepted, or skipped for a rewarded video): count from zero again
export const afterBreak = () => createCadence();

// What to do at Next: 'interstitial' (request one), 'skip' (a rewarded video stands in for this break) or 'none'.
// changed: the look being left changed the face; now / lastRequestAt / lastRewardAt: milliseconds (runtime clock).
export function atNext(c, { changed, now, lastRequestAt = -Infinity, lastRewardAt = -Infinity }) {
  if (!changed || c.qualified < CADENCE.looks || c.activeMs < CADENCE.activeMs) return 'none';
  if (c.rewardCredit) return 'skip';
  if (now - lastRequestAt < CADENCE.requestGapMs || now - lastRewardAt < CADENCE.rewardGapMs) return 'none';
  return 'interstitial';
}
