// The colour of the day (owner decision, 19 October 2026; the pattern of Haircut's daily pick). Each day one
// special colour for one tool (or the lenses) is on offer, the same for every player that day, never one the
// player already has. One rewarded video adds it to that tool's colours for good. The offer runs out at the
// player's local midnight, when the next day's colour replaces it.
import { DAILY } from '../makeup/palette.js';

// the tools take turns, so the offer changes kind every day
export const DAILY_ORDER = ['brush', 'lip', 'pencil', 'lens', 'mascara'];

const two = (n) => String(n).padStart(2, '0');
// the player's local calendar day, 'YYYY-MM-DD'
export const dayKey = (date = new Date()) => `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
export const validDay = (day) => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day);
// whole days since 1970 for a day key (for the tool rotation)
const dayNumber = (day) => { const [y, m, d] = day.split('-').map(Number); return Math.floor(Date.UTC(y, m - 1, d) / 86400000); };
const hash = (str) => { let h = 2166136261; for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };

// today's colour id for a player who owns `owned` (a Set of colour ids), or null when they own them all
export function dailyOffer(day, owned) {
  const start = dayNumber(day);
  for (let k = 0; k < DAILY_ORDER.length; k++) {
    const tool = DAILY_ORDER[(start + k) % DAILY_ORDER.length], all = DAILY[tool];
    let i = hash(`${day}|${tool}`) % all.length;
    for (let j = 0; j < all.length; j++, i = (i + 1) % all.length) if (!owned.has(all[i].id)) return all[i].id;
  }
  return null;
}

// time left until local midnight: milliseconds, the fraction of the day left, and the countdown text
export function timeLeft(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()), end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const ms = Math.max(0, end - now), t = Math.floor(ms / 1000), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return { ms, frac: Math.min(1, ms / (end - start)), text: h ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}` };
}
