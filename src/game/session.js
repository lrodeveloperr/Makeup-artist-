// Runs one game on a host (youtube.js, or a test double): saves, the natural-break interstitial at Next, and the
// two rewarded videos (contract §7–§9). The rules of the state are in game.js; this module decides when to save
// and how ads are requested.
//
// host: {
//   save(text): Promise (resolves when acknowledged)
//   interstitial(): Promise<boolean>   true when the request was accepted (not proof of a shown ad)
//   rewarded(placement): Promise<boolean>   strict true only when the reward was earned
//   rewardedSupported, interstitialSupported: booleans
// }
// Both ad calls resolve only after the host has resumed the game.
import * as G from './game.js';
import { atNext } from './cadence.js';
import { dayKey } from './daily.js';

// stable reward placements (contract §7: exactly two rewarded purposes)
export const PLACEMENTS = { replay: 'makeup-replay-face', daily: 'makeup-daily-colour' };
const COALESCE_MS = 1000; // longest a change waits before it is saved
const RETRY_MS = 5000; // a failed save is retried after this, and at the next change or flush

export class Session {
  constructor(host, state, { onChange = () => {}, now = () => performance.now(), today = () => dayKey() } = {}) {
    Object.assign(this, { host, state, onChange, now, today });
    this.busy = false; // one transition or ad request at a time (double taps do nothing)
    this.lastRequestAt = -Infinity; // runtime only, as in Haircut
    this.lastRewardAt = -Infinity;
    this.rev = 0; this.savedRev = 0; this.saving = Promise.resolve(); this.timer = null;
    this.saveFailed = false;
  }

  get dirty() { return this.savedRev < this.rev; }

  // adopt a new state; saves follow within COALESCE_MS, or now with flush
  update(next, { flush = false } = {}) {
    if (next === this.state) return false;
    this.state = next;
    this.rev++;
    this.onChange(next);
    if (flush) this.flush().catch(() => {});
    else this.schedule(COALESCE_MS);
    return true;
  }

  // the current state has not been saved yet (a new player's first state)
  touch() { this.rev++; this.schedule(0); }

  schedule(ms) {
    if (!this.timer) this.timer = setTimeout(() => { this.timer = null; this.flush().catch(() => {}); }, ms);
  }

  // Save the current state. Resolves once the host acknowledged a write that includes every change made before
  // the call; rejects if that write failed. Writes are serialised; a change made during a write stays dirty.
  flush() {
    clearTimeout(this.timer); this.timer = null;
    const run = async () => {
      if (!this.dirty) return;
      const rev = this.rev, text = G.serialise(this.state);
      try {
        await this.host.save(text);
      } catch (e) {
        this.saveFailed = true;
        this.onChange(this.state);
        this.schedule(RETRY_MS);
        throw e;
      }
      this.savedRev = Math.max(this.savedRev, rev);
      if (this.saveFailed) { this.saveFailed = false; this.onChange(this.state); }
    };
    this.saving = this.saving.catch(() => {}).then(run);
    return this.saving;
  }

  // ---- creation ----
  select(tool, colour) { this.update(G.select(this.state, tool, colour)); }
  // a stroke or lens change was committed (flushed: contract §8 checkpoints after a gesture and a lens change)
  applied(makeup) { this.update(G.setMakeup(this.state, makeup), { flush: true }); }
  // unpaused making time (kept in memory; saved with the next save)
  tick(ms) { if (this.state.attempt.phase === 'create' && !this.busy) this.state = G.addActiveTime(this.state, ms); }
  finish() { if (!this.busy) this.update(G.finish(this.state), { flush: true }); }

  // ---- Next: the natural break ----
  async next() {
    if (this.busy || this.state.attempt.phase !== 'review') return false;
    this.busy = true;
    try {
      const s = this.state;
      const decision = atNext(s.cadence, { changed: s.attempt.completed, now: this.now(), lastRequestAt: this.lastRequestAt, lastRewardAt: this.lastRewardAt });
      if (decision === 'skip') this.update(G.breakTaken(this.state)); // a rewarded video stood in for this break
      else if (decision === 'interstitial' && this.host.interstitialSupported) {
        // save first; if that fails, no ad call (the next face still comes, and saving retries)
        const saved = await this.flush().then(() => true, () => false);
        if (saved) {
          this.lastRequestAt = this.now();
          let accepted = false;
          try { accepted = (await this.host.interstitial()) === true; } catch { accepted = false; }
          // an accepted request starts the count again; a refused one keeps the progress for the next Next
          if (accepted) this.update(G.breakTaken(this.state));
        }
      }
      this.update(G.next(this.state), { flush: true });
      return true;
    } finally {
      this.busy = false;
    }
  }

  // ---- rewarded videos ----
  // purpose 'replay' (from review: the same face again, clean) or 'daily' (today's colour, kept for good).
  // Resolves true when the reward was earned and applied.
  async reward(purpose) {
    if (this.busy || !this.host.rewardedSupported) return false;
    const s0 = this.state;
    // the context is captured now: the reward applies to this attempt or this offer even if the day turns
    const ctx = purpose === 'replay' ? { attempt: s0.attempt.id } : { colour: s0.pick?.colour };
    if (purpose === 'replay' ? s0.attempt.phase !== 'review' : !ctx.colour || s0.owned.includes(ctx.colour)) return false;
    this.busy = true;
    try {
      // save first; if that fails, no ad (nothing would be safe to grant on)
      if (!(await this.flush().then(() => true, () => false))) return false;
      let earned = false;
      try { earned = (await this.host.rewarded(purpose === 'replay' ? PLACEMENTS.replay : PLACEMENTS.daily)) === true; } catch { earned = false; }
      if (!earned) return false;
      this.lastRewardAt = this.now();
      let s = G.rewardEarned(this.state);
      s = purpose === 'replay' ? (s.attempt.id === ctx.attempt ? G.replay(s) : s) : G.grantDaily(s, ctx.colour);
      this.update(s, { flush: true });
      return true;
    } finally {
      this.busy = false;
    }
  }

  // ---- colour of the day ----
  // today's offer (a new day brings a new one)
  refreshDaily() { this.update(G.withPick(this.state, this.today())); }
  openedDaily() { this.update(G.markSeen(this.state, this.today())); }
  // the dot on the daily button: once a day, while today's colour is waiting
  get dailyWaiting() {
    const s = this.state, day = this.today();
    return this.host.rewardedSupported && s.pick?.day === day && !s.owned.includes(s.pick.colour) && s.seen !== day;
  }
}
