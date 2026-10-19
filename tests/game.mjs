// Fast checks of the game layer without a browser: the colour of the day, interstitial pacing, the game's
// rules (finish, next, replay, colours), the saved form, and the session's save/ad ordering against a fake host.
// Usage: node tests/game.mjs
import assert from 'node:assert/strict';
import { DAILY, PALETTE, colourById, coloursFor } from '../src/makeup/palette.js';
import { createMakeup, addStroke, setLens } from '../src/makeup/makeup.js';
import { dailyOffer, dayKey, timeLeft, DAILY_ORDER } from '../src/game/daily.js';
import { CADENCE, createCadence, atNext, addActive, countLook, rewarded } from '../src/game/cadence.js';
import * as G from '../src/game/game.js';
import { Session, PLACEMENTS } from '../src/game/session.js';

let n = 0;
const tests = [];
const test = (name, fn) => tests.push([name, fn]); // run in order at the end, one at a time
const waitFor = async (f) => { while (!f()) await new Promise((r) => setTimeout(r, 0)); };
const stroke = (m) => addStroke(m, { tool: 'brush', colour: 'brush-rose', segments: [[0, 0, 0]] });

test('colour of the day: same for everyone that day, never one already owned, tools take turns', () => {
  const days = Array.from({ length: 40 }, (_, i) => dayKey(new Date(2026, 9, 19 + i)));
  const offers = days.map((d) => dailyOffer(d, new Set()));
  assert.deepEqual(offers, days.map((d) => dailyOffer(d, new Set())), 'deterministic');
  offers.forEach((id, i) => {
    assert.ok(colourById(id).daily);
    if (i) assert.notEqual(colourById(id).target, colourById(offers[i - 1]).target, 'a different kind each day');
  });
  assert.deepEqual(new Set(offers.slice(0, 5).map((id) => colourById(id).target)), new Set(DAILY_ORDER));
  // owning today's colour moves the offer to another colour, never an owned one
  const day = days[0], first = dailyOffer(day, new Set()), owned = new Set([first]);
  assert.notEqual(dailyOffer(day, owned), first);
  const all = new Set(Object.values(DAILY).flat().map((c) => c.id));
  assert.equal(dailyOffer(day, all), null);
  // the base catalogue is never offered
  assert.ok(!offers.some((id) => Object.values(PALETTE).flat().some((c) => c.id === id)));
  const t = timeLeft(new Date(2026, 9, 19, 23, 59, 30));
  assert.equal(t.text, '0:30');
  assert.equal(timeLeft(new Date(2026, 9, 19, 12, 0, 0)).text, '12:00:00');
  // Haircut's colours: green, orange from 6 hours left, red from 2 hours; the last ten minutes alarm
  assert.deepEqual([9, 19, 23].map((h) => timeLeft(new Date(2026, 9, 19, h, 0, 0)).level), ['g', 'o', 'r']);
  assert.deepEqual([timeLeft(new Date(2026, 9, 19, 23, 49, 0)).last, timeLeft(new Date(2026, 9, 19, 23, 51, 0)).last], [false, true]);
});

test('interstitial pacing: every second finished look, at least a minute of making, never on an untouched look', () => {
  const at = (c, extra = {}) => atNext(c, { changed: true, now: 1e6, ...extra });
  let c = createCadence();
  c = addActive(c, 1000);
  assert.equal(at(countLook(c)), 'none', 'one look is not enough');
  c = countLook(countLook(c));
  assert.equal(at(c), 'none', 'two looks but under a minute of making');
  for (let i = 0; i < 70; i++) c = addActive(c, 1000);
  assert.equal(at(c), 'interstitial');
  assert.equal(at(c, { changed: false }), 'none', 'an untouched look never triggers the break');
  assert.equal(at(c, { lastRequestAt: 1e6 - 30000 }), 'none', 'a minute between requests');
  assert.equal(at(c, { lastRewardAt: 1e6 - 30000 }), 'none', 'a minute after a rewarded video');
  assert.equal(at(rewarded(c)), 'skip', 'a rewarded video stands in for the next break');
  assert.equal(addActive(c, 1e9).activeMs, c.activeMs + 1000, 'a stalled frame adds at most a second');
  assert.equal(CADENCE.looks, 2);
});

test('game rules: finish counts once, untouched looks count nothing, next brings the previewed face', () => {
  const s0 = G.newGame(42);
  assert.deepEqual(G.newGame(42), s0);
  assert.equal(s0.attempt.phase, 'create');
  const untouched = G.finish(s0);
  assert.equal(untouched.completions, 0);
  assert.equal(untouched.cadence.qualified, 0);
  let s = G.finish(G.setMakeup(s0, stroke(createMakeup())));
  assert.equal(s.completions, 1);
  assert.equal(G.finish(s), s, 'finishing again changes nothing');
  assert.equal(G.setMakeup(s, createMakeup()), s, 'review is read-only');
  const preview = s.next;
  s = G.next(s);
  assert.deepEqual(s.face, preview, 'the previewed customer comes next');
  assert.equal(s.attempt.id, 2);
  assert.equal(s.attempt.makeup.strokes.length, 0);
  assert.notDeepEqual(s.next, preview);
  assert.equal(G.next(s), s, 'Next only from review');
});

test('game rules: a lens that matches the natural iris is not a change', () => {
  // a face whose natural iris colour is also a lens colour
  let s0 = null;
  for (let seed = 1; !s0; seed++) { const g = G.newGame(seed); if (colourById(`lens-${g.face.eyes.iris}`)) s0 = g; }
  const same = `lens-${s0.face.eyes.iris}`, other = PALETTE.lens.find((c) => c.id !== same).id;
  assert.equal(G.finish(G.setMakeup(s0, setLens(createMakeup(), 'left', same))).completions, 0);
  assert.equal(G.finish(G.setMakeup(s0, setLens(createMakeup(), 'left', other))).completions, 1);
});

test('game rules: replay is the same face, clean, as a new attempt; colours of the day are kept for good', () => {
  let s = G.finish(G.setMakeup(G.newGame(3), stroke(createMakeup())));
  const r = G.replay(s);
  assert.deepEqual(r.face, s.face);
  assert.deepEqual(r.next, s.next, 'the queue is untouched');
  assert.equal(r.attempt.id, s.attempt.id + 1);
  assert.equal(r.attempt.makeup.strokes.length, 0);
  assert.equal(r.completions, 1, 'totals are kept');
  // colours of the day
  const day = '2026-10-19';
  s = G.withPick(s, day);
  const id = s.pick.colour, tool = colourById(id).target;
  assert.equal(G.canUse(s, id), false);
  assert.equal(G.select(s, tool, id), s, 'a colour not yet earned cannot be selected');
  s = G.grantDaily(s, id);
  assert.ok(G.canUse(s, id));
  assert.deepEqual(s.selection, { tool, colour: { ...s.selection.colour, [tool]: id } }, 'the new colour is ready to use');
  assert.ok(coloursFor(tool, s.owned).some((c) => c.id === id));
  assert.equal(G.grantDaily(s, id), s, 'granted once');
  assert.equal(G.grantDaily(s, 'brush-rose'), s, 'base colours are not granted');
  assert.equal(G.withPick(s, day), s, "the day's offer stays fixed");
  assert.notEqual(G.withPick(s, '2026-10-20').pick.colour, id);
});

test('saved form: round trip, empty saves, and protected unknown data', () => {
  let s = G.withPick(G.finish(G.setMakeup(G.newGame(11), stroke(createMakeup()))), '2026-10-19');
  s = G.grantDaily(s, s.pick.colour);
  const text = G.serialise(s);
  assert.deepEqual(G.parseSave(text).state, s);
  assert.ok(text.length < 12000, `${text.length} bytes`);
  for (const empty of [null, '', '  ', '{}']) assert.deepEqual(G.parseSave(empty), { state: null });
  const d = JSON.parse(text);
  const variant = (f) => { const x = JSON.parse(text); f(x); return JSON.stringify(x); };
  assert.equal(G.parseSave(variant((x) => { x.v = 2; })).error, 'too-new');
  assert.equal(G.parseSave(variant((x) => { x.game = 'skin-fade-studio'; })).error, 'other-game');
  assert.equal(G.parseSave('{"version":1,"slots":{}}').error, 'other-game');
  assert.equal(G.parseSave('not json').error, 'invalid');
  for (const f of [
    (x) => { x.state.face.shape.gender = 9; }, // a face the generator would not make
    (x) => { x.state.attempt.makeup.s = ['brush-rose:!!']; },
    (x) => { x.state.attempt.phase = 'done'; },
    (x) => { x.state.owned.push('brush-rose'); }, // a base colour is never "earned"
    (x) => { x.state.completions = -1; },
    (x) => { x.state.cadence.activeMs = 1.5; },
    (x) => { x.state.queue.bag.push('atlantis'); },
    (x) => { x.state.attempt.id = 99; },
  ]) assert.equal(G.parseSave(variant(f)).error, 'invalid', f.toString());
  // an unusable selected colour falls back to the default (a preference, not work)
  const sel = G.parseSave(variant((x) => { x.state.selection.colour.lip = 'lip-fuchsia'; x.state.owned = []; x.state.pick = null; }));
  assert.equal(sel.state.selection.colour.lip, 'lip-rose');
  assert.ok(d.state.attempt.makeup.s.length === 1);
});

// a host that records what it was asked to do
function fakeHost({ failSave = false, accept = true, earn = true } = {}) {
  return {
    calls: [], saved: null, failSave, accept, earn, interstitialSupported: true, rewardedSupported: true,
    async save(text) { this.calls.push('save'); await null; if (this.failSave) throw new Error('save failed'); this.saved = text; },
    async interstitial() { this.calls.push('interstitial'); return this.accept; },
    async rewarded(id) { this.calls.push(`rewarded:${id}`); return this.earn; },
  };
}
function session(host, seed = 5) {
  const clock = { t: 1e6 };
  const s = new Session(host, G.newGame(seed), { now: () => clock.t, today: () => clock.day || '2026-10-19' });
  s.clock = clock;
  s.look = async ({ changed = true, minutes = 1.1 } = {}) => {
    for (let i = 0; i < minutes * 60; i++) s.tick(1000);
    clock.t += minutes * 60000;
    if (changed) s.applied(stroke(s.state.attempt.makeup));
    s.finish();
    await s.next();
  };
  return s;
}

test('session: an interstitial on every second finished look, after the save is acknowledged', async () => {
  const h = fakeHost(), s = session(h);
  await s.look();
  assert.ok(!h.calls.includes('interstitial'), 'not after the first look');
  h.calls.length = 0;
  await s.look();
  const i = h.calls.indexOf('interstitial');
  assert.ok(i > 0 && h.calls[i - 1] === 'save', `saved before the ad: ${h.calls}`);
  assert.equal(h.calls.filter((c) => c === 'interstitial').length, 1);
  assert.equal(s.state.cadence.qualified, 0, 'counting starts again');
  h.calls.length = 0;
  await s.look();
  assert.ok(!h.calls.includes('interstitial'));
  await s.look();
  assert.ok(h.calls.includes('interstitial'), 'again after two more looks');
  // untouched looks never count
  h.calls.length = 0;
  for (let k = 0; k < 4; k++) await s.look({ changed: false });
  assert.ok(!h.calls.includes('interstitial'));
  assert.equal(s.state.completions, 4);
  await s.saving;
});

test('session: a refused or failed interstitial keeps the progress; a failed save means no ad', async () => {
  const h = fakeHost({ accept: false }), s = session(h);
  await s.look(); await s.look();
  assert.equal(s.state.cadence.qualified, 2, 'refused: progress kept');
  const faces = s.state.attempt.id;
  h.accept = true; h.failSave = true; h.calls.length = 0;
  await s.look();
  assert.ok(!h.calls.includes('interstitial'), 'no ad without an acknowledged save');
  assert.equal(s.state.attempt.id, faces + 1, 'the next face still comes');
  assert.ok(s.saveFailed);
  h.failSave = false;
  await s.flush();
  assert.ok(!s.saveFailed && !s.dirty);
  clearTimeout(s.timer);
});

test('session: rewarded replay and colour of the day, granted only on true, once, with the captured offer', async () => {
  const h = fakeHost({ earn: false }), s = session(h);
  s.applied(stroke(s.state.attempt.makeup)); s.finish();
  const id = s.state.attempt.id, face = s.state.face;
  assert.equal(await s.reward('replay'), false);
  assert.equal(s.state.attempt.id, id, 'not earned: nothing happens');
  h.earn = true; h.calls.length = 0;
  s.select('lip', 'lip-red'); // an unsaved change: it is saved before the ad
  assert.equal(await s.reward('replay'), true);
  assert.deepEqual(h.calls.slice(0, 2), ['save', `rewarded:${PLACEMENTS.replay}`]);
  assert.deepEqual(s.state.face, face);
  assert.equal(s.state.attempt.id, id + 1);
  assert.equal(s.state.attempt.phase, 'create');
  assert.equal(await s.reward('replay'), false, 'replay only from review');
  // a rewarded video stands in for the next break
  s.applied(stroke(s.state.attempt.makeup)); s.finish(); await s.next();
  await s.look();
  assert.ok(!h.calls.includes('interstitial'), 'skipped after a rewarded video');
  assert.equal(s.state.cadence.rewardCredit, false);
  // colour of the day: the offer captured at the request is the one granted, even if the day turns meanwhile
  s.refreshDaily();
  const offer = s.state.pick.colour;
  assert.ok(s.dailyWaiting);
  h.rewarded = async (placement) => { h.calls.push(`rewarded:${placement}`); s.clock.day = '2026-10-20'; s.refreshDaily(); return true; };
  assert.equal(await s.reward('daily'), true);
  assert.ok(s.state.owned.includes(offer));
  assert.equal(s.state.selection.colour[colourById(offer).target], offer);
  h.calls.length = 0;
  s.clock.day = '2026-10-19'; s.state = { ...s.state, pick: { day: '2026-10-19', colour: offer } };
  assert.equal(await s.reward('daily'), false, 'an owned colour is not offered again');
  assert.ok(!h.calls.some((c) => c.startsWith('rewarded')), 'and no video is requested');
  await s.saving;
});

test('session: double taps do nothing twice; a change made during a write stays unsaved until the next one', async () => {
  const h = fakeHost(), s = session(h);
  s.finish();
  const [a, b] = await Promise.all([s.next(), s.next()]);
  assert.deepEqual([a, b], [true, false]);
  assert.equal(s.state.attempt.id, 2);
  await s.saving; // earlier writes settle before the slow host is swapped in
  let release;
  h.save = function (text) { this.calls.push('save'); this.saved = text; return new Promise((r) => { release = r; }); };
  s.select('lip', 'lip-red');
  const first = s.flush();
  await waitFor(() => release);
  s.select('lip', 'lip-coral'); // during the write
  release(); release = null; await first;
  assert.ok(s.dirty, 'the later change is still dirty');
  const second = s.flush();
  await waitFor(() => release);
  release(); await second;
  clearTimeout(s.timer);
  assert.ok(!s.dirty);
  assert.equal(G.parseSave(h.saved).state.selection.colour.lip, 'lip-coral');
});

for (const [name, fn] of tests) { if (process.env.TRACE) console.log('..', name); await fn(); n++; console.log('ok -', name); }
console.log(`${n} game checks passed`);
