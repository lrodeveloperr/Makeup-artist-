// The game's durable state and its rules: one face at a time, created then reviewed; Next brings the previewed
// next customer; a rewarded replay restarts the same face clean; colours of the day are earned for good. Every
// function returns a new state and never mutates its input, so a state handed to saving cannot change under it.
// Ads and saving are driven by session.js; this module only decides what the state becomes.
//
// state: {
//   queue, face, next          customer queue state, the current face record and the fixed next one
//   attempt: { id, phase: 'create' | 'review', makeup, completed }   (completed: counted once at Finish)
//   attempts, completions      last attempt id, finished looks that changed the face
//   cadence                    interstitial pacing (cadence.js)
//   owned                      colours of the day the player has earned, in order
//   pick: { day, colour }      today's offer (kept for the day once chosen)
//   seen                       the day the player last opened the daily section (its dot)
//   selection: { tool, colour: { brush, pencil, mascara, lip, lens } }
// }
import { createQueueState, nextFace, RECENT, ROTATION } from '../face/queue.js';
import { generateFace, GENERATOR_VERSION } from '../face/generator.js';
import { PROFILES } from '../face/profiles.js';
import { createMakeup, isChanged, packMakeup, unpackMakeup } from '../makeup/makeup.js';
import { colourById, DAILY, DEFAULT_SELECTION } from '../makeup/palette.js';
import { createCadence, validCadence, addActive, countLook, rewarded, afterBreak } from './cadence.js';
import { dailyOffer, validDay } from './daily.js';

export const GAME_ID = 'worksbien-makeup';
export const SAVE_VERSION = 1;
const SELECT_TOOLS = ['brush', 'pencil', 'mascara', 'lip', 'lens'];
const DAILY_COUNT = Object.values(DAILY).flat().length;

const freshAttempt = (id) => ({ id, phase: 'create', makeup: createMakeup(), completed: false });

// a new player: the first two customers of a queue started from `seed`
export function newGame(seed) {
  const a = nextFace(createQueueState(seed)), b = nextFace(a.state);
  return {
    queue: b.state, face: a.face, next: b.face, attempt: freshAttempt(1), attempts: 1, completions: 0,
    cadence: createCadence(), owned: [], pick: null, seen: null,
    selection: { tool: DEFAULT_SELECTION.tool, colour: { ...DEFAULT_SELECTION.colour } },
  };
}

// may the player apply this colour? (base colours always; a colour of the day once earned)
export const canUse = (s, id) => { const c = colourById(id); return !!c && (!c.daily || s.owned.includes(id)); };

export function select(s, tool, colour) {
  if (!SELECT_TOOLS.includes(tool) || (colour !== undefined && (colourById(colour)?.target !== tool || !canUse(s, colour)))) return s;
  return { ...s, selection: { tool, colour: colour === undefined ? s.selection.colour : { ...s.selection.colour, [tool]: colour } } };
}

// the applied makeup changed (a stroke or a lens), during creation only
export const setMakeup = (s, makeup) => (s.attempt.phase === 'create' ? { ...s, attempt: { ...s.attempt, makeup } } : s);

// Finish: open review; a look that changed the face counts once per attempt
export function finish(s) {
  if (s.attempt.phase !== 'create') return s;
  const changed = !s.attempt.completed && isChanged(s.attempt.makeup, s.face.eyes.iris);
  return {
    ...s,
    attempt: { ...s.attempt, phase: 'review', completed: s.attempt.completed || changed },
    completions: s.completions + (changed ? 1 : 0),
    cadence: changed ? countLook(s.cadence) : s.cadence,
  };
}

// Next: the previewed customer becomes current and a new one is previewed (from review only)
export function next(s) {
  if (s.attempt.phase !== 'review') return s;
  const n = nextFace(s.queue);
  return { ...s, queue: n.state, face: s.next, next: n.face, attempt: freshAttempt(s.attempts + 1), attempts: s.attempts + 1 };
}

// rewarded replay: the same face again, clean, as a new attempt (queue, totals and colours unchanged)
export function replay(s) {
  if (s.attempt.phase !== 'review') return s;
  return { ...s, attempt: freshAttempt(s.attempts + 1), attempts: s.attempts + 1 };
}

// ---- pacing ----
export const addActiveTime = (s, ms) => ({ ...s, cadence: addActive(s.cadence, ms) });
export const breakTaken = (s) => ({ ...s, cadence: afterBreak() });
export const rewardEarned = (s) => ({ ...s, cadence: rewarded(s.cadence) });

// ---- colour of the day ----
// today's offer, fixed for the day once chosen
export function withPick(s, day) {
  if (s.pick?.day === day) return s;
  const colour = dailyOffer(day, new Set(s.owned));
  return { ...s, pick: colour ? { day, colour } : null };
}
// the earned colour joins its tool for good and is selected, ready to use
export function grantDaily(s, colour) {
  const c = colourById(colour);
  if (!c?.daily || s.owned.includes(colour)) return s;
  const owned = [...s.owned, colour];
  return { ...s, owned, selection: { tool: c.target, colour: { ...s.selection.colour, [c.target]: colour } } };
}
export const markSeen = (s, day) => (s.seen === day ? s : { ...s, seen: day });

// ---- saved form ----
export function serialise(s) {
  return JSON.stringify({
    game: GAME_ID, v: SAVE_VERSION, generator: GENERATOR_VERSION,
    state: { ...s, attempt: { ...s.attempt, makeup: packMakeup(s.attempt.makeup) } },
  });
}

const HERITAGES = new Set([...Object.keys(PROFILES), 'blend']);
const isInt = (v, min = 0) => Number.isSafeInteger(v) && v >= min;
const validQueue = (q) => !!q && q.version === GENERATOR_VERSION && Number.isSafeInteger(q.cursor) && q.cursor >= 0 && q.cursor < 2 ** 32 &&
  Array.isArray(q.recent) && q.recent.length <= RECENT && q.recent.every((r) => typeof r === 'string' && r.length < 400) &&
  Array.isArray(q.bag) && q.bag.length <= ROTATION && q.bag.every((h) => HERITAGES.has(h)) && (q.last === undefined || HERITAGES.has(q.last));
// a face record is valid when the current generator makes exactly it from its seed
const validFace = (f) => !!f && f.version === GENERATOR_VERSION && Number.isSafeInteger(f.seed) && f.seed >= 0 && f.seed < 2 ** 32 &&
  JSON.stringify(generateFace(f.seed)) === JSON.stringify(f);

// Read a saved text. Returns { state } for a valid save, { state: null } for a recognised empty save, or
// { error } ('too-new', 'invalid', 'other-game') for anything else, which must be protected, never overwritten.
export function parseSave(text) {
  if (text == null || (typeof text === 'string' && text.trim() === '')) return { state: null };
  let d;
  try { d = typeof text === 'string' ? JSON.parse(text) : text; } catch { return { error: 'invalid' }; }
  if (d && typeof d === 'object' && !Array.isArray(d) && Object.keys(d).length === 0) return { state: null };
  if (!d || typeof d !== 'object' || d.game !== GAME_ID) return { error: 'other-game' };
  if (Number.isSafeInteger(d.v) && d.v > SAVE_VERSION) return { error: 'too-new' };
  const s = d.state;
  if (d.v !== SAVE_VERSION || d.generator !== GENERATOR_VERSION || !s || typeof s !== 'object') return { error: 'invalid' };
  const a = s.attempt;
  const makeup = a && unpackMakeup(a.makeup);
  const ok = validQueue(s.queue) && validFace(s.face) && validFace(s.next) && makeup &&
    isInt(a.id, 1) && a.id <= s.attempts && isInt(s.attempts, 1) && (a.phase === 'create' || a.phase === 'review') && typeof a.completed === 'boolean' &&
    isInt(s.completions) && validCadence(s.cadence) &&
    Array.isArray(s.owned) && s.owned.length <= DAILY_COUNT && new Set(s.owned).size === s.owned.length && s.owned.every((id) => colourById(id)?.daily) &&
    (s.pick === null || (validDay(s.pick?.day) && colourById(s.pick.colour)?.daily)) && (s.seen === null || validDay(s.seen)) &&
    s.selection && SELECT_TOOLS.includes(s.selection.tool) && s.selection.colour && typeof s.selection.colour === 'object';
  if (!ok) return { error: 'invalid' };
  const state = {
    queue: s.queue, face: s.face, next: s.next, attempt: { id: a.id, phase: a.phase, makeup, completed: a.completed },
    attempts: s.attempts, completions: s.completions, cadence: { ...s.cadence }, owned: [...s.owned],
    pick: s.pick && { day: s.pick.day, colour: s.pick.colour }, seen: s.seen, selection: null,
  };
  // the selected colours: kept where still usable, otherwise the defaults (a preference, not the player's work)
  const colour = {};
  for (const t of SELECT_TOOLS) {
    const id = s.selection.colour[t];
    colour[t] = colourById(id)?.target === t && canUse(state, id) ? id : DEFAULT_SELECTION.colour[t];
  }
  state.selection = { tool: s.selection.tool, colour };
  return { state };
}
