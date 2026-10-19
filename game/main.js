// The game: one screen. Create (seven tools and the lenses, their colours, Done) → the finish (a chime and a burst
// of sparkles) → review, as in Haircut (Retry for a video, the next customer pictured beside Next) → the next
// customer. The colour of the day is behind the button at the top left.
// Rules and saving are in src/game; this file is the screen.
import { FaceView } from '../src/face/face-view.js';
import { attachInput } from '../src/makeup/input.js';
import { isChanged } from '../src/makeup/makeup.js';
import { coloursFor, colourById } from '../src/makeup/palette.js';
import { chime, hush, setEnabled, stroke, tap, ui, stats as sounds } from './sound.js';
import { productShot } from './reward.js';
import { createHost } from '../src/game/youtube.js';
import * as G from '../src/game/game.js';
import { Session } from '../src/game/session.js';
import { timeLeft } from '../src/game/daily.js';

const $ = (id) => document.getElementById(id);
const svg = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}><path d="${d}"/></svg>`;
const ICON = {
  brush: svg('M4.5 19.5l6.2-6.2M10.7 13.3c-.6-3.6 2.4-8.6 8.3-9.8.6 5.8-4.6 9.3-8.3 9.8zM3.5 20.5l2-1'),
  glow: svg('M4.5 10.5A8 8 0 0 1 19.5 10.5L12 16zM12 16v6M12 16L8.8 5.2M12 16l3.2-10.8M20.5 1.5v3.4M18.8 3.2h3.4'), // a fan brush and a glint
  pencil: svg('M4 20l1.4-4.6L16 4.8l3.2 3.2L8.6 18.6zM14.2 6.6l3.2 3.2M5.4 15.4l3.2 3.2'),
  liner: svg('M2.5 15.5q8.5 3.5 16.5-3l2.5-4-6 2.5M17 2.5l2.5 2.5-7 7-3.2.7.7-3.2z'), // a wing and the pen's tip
  gem: svg('M6.5 4h11l4 5.5L12 21 2.5 9.5zM2.5 9.5h19M8 9.5l4 11.5 4-11.5M9 4l3 5.5L15 4'),
  mascara: svg('M3.5 20.5l8-8M11 13l6.5-6.5M12.6 9.2l2.2 2.2M14.4 7.4l2.2 2.2M16.2 5.6l2.2 2.2M10.8 11l2.2 2.2'),
  lip: svg('M8 21h8v-7.5H8zM9.2 13.5V9.5h5.6v4M10.2 9.5V5.2L13.8 3v6.5'),
  lens: svg('M2 12s4-6.5 10-6.5S22 12 22 12s-4 6.5-10 6.5S2 12 2 12zM12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 1 0 0-6.8', ' fill="none"'),
  check: svg('M5 12.5l4.5 4.5L19 7.5', ' stroke-width="3.6"'),
  next: svg('M5 12h13M12.5 5.5L19 12l-6.5 6.5', ' stroke-width="3.2"'),
  chev: svg('M9 6l6 6-6 6', ' stroke-width="3.4"'), // Haircut's hint between the next customer and Next
  redo: svg('M4.5 12a7.5 7.5 0 1 0 2.6-5.7M4.5 4.2v4.6h4.6', ' stroke-width="3"'),
  video: svg('M3.5 5.5h17v11h-17zM10.2 8.6v5.2l4.4-2.6zM8 20h8', ' stroke-width="2.4"'),
  clock: svg('M12 4.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 1 0 0-17M12 8.5V13l3 2M9.5 2.5h5', ' stroke-width="2.6"'), // Haircut's stopwatch
  close: svg('M6.5 6.5l11 11M17.5 6.5l-11 11', ' stroke-width="3.2"'),
  cloud: svg('M7 18.5h10a4 4 0 0 0 .6-8 6 6 0 0 0-11.5 1.6A3.4 3.4 0 0 0 7 18.5zM4 4l16 16', ' stroke-width="2.4"'),
  oops: svg('M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18M12 7.5v6M12 16.6v.4', ' stroke-width="2.8"'),
  gift: svg('M4 10.5h16V21H4zM2.8 7h18.4v3.5H2.8zM12 7v14M12 7c-1.6-4.2-6.2-3.6-5.2-.4M12 7c1.6-4.2 6.2-3.6 5.2-.4', ' stroke-width="2.3"'),
  star: '<svg class="star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5l2.2 7.3 7.3 2.2-7.3 2.2L12 20.5l-2.2-7.3L2.5 11l7.3-2.2z" fill="#ffe14d" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
};
// Haircut's rosette for Done: a scalloped seal
const SEAL = `<svg class="seal" viewBox="-50 -50 100 100" aria-hidden="true"><polygon points="${Array.from({ length: 32 }, (_, k) => { const a = (k / 32) * 2 * Math.PI, r = k % 2 ? 41 : 48; return `${(r * Math.sin(a)).toFixed(1)},${(-r * Math.cos(a)).toFixed(1)}`; }).join(' ')}"/></svg>`;
const BADGE = `<span class="vbadge">${ICON.video}</span>`;
const TOOLS = [['brush', 'Brush'], ['glow', 'Highlighter'], ['pencil', 'Pencil'], ['liner', 'Liquid liner'], ['mascara', 'Mascara'], ['lip', 'Lips'], ['gem', 'Face gems'], ['lens', 'Lenses']];
const TOOL_NAME = Object.fromEntries(TOOLS);
// a swatch's look: its colour, with a shine for gloss and sparkles for shimmer
const swatchBackground = (c) => (c.gloss
  ? `radial-gradient(circle at 35% 30%, #fffc 0 14%, #fff0 32%)${c.shimmer ? ', radial-gradient(circle at 66% 62%, #fff9 0 6%, #fff0 14%)' : ''}, ${c.hex}`
  : c.shimmer || c.glow ? `radial-gradient(circle at 30% 30%, #fffb 0 7%, #fff0 16%), radial-gradient(circle at 66% 62%, #fff9 0 5%, #fff0 13%), ${c.hex}` : c.hex);
// a gem's swatch: its shape in its colour and material
const GEM_PATH = {
  stone: 'M12 2.5l6.7 2.8 2.8 6.7-2.8 6.7-6.7 2.8-6.7-2.8L2.5 12l2.8-6.7z',
  drop: 'M12 2C9.2 6.6 6 10.3 6 14.4a6 6 0 0 0 12 0C18 10.3 14.8 6.6 12 2z',
  heart: 'M12 21s-8.5-5-8.5-11A4.6 4.6 0 0 1 12 7.2 4.6 4.6 0 0 1 20.5 10c0 6-8.5 11-8.5 11z',
  star: 'M12 1.5l3 7.3 7.5.6-5.7 5 1.8 7.6L12 18l-6.6 4 1.8-7.6-5.7-5 7.5-.6z',
};
// five round petals about the centre
const petals = Array.from({ length: 5 }, (_, k) => { const a = (k / 5) * 2 * Math.PI - Math.PI / 2; return [12 + 5.4 * Math.cos(a), 12.4 + 5.4 * Math.sin(a)]; });
const gemSwatch = (c) => {
  const id = `g-${c.id}`, rim = c.look === 'iris' ? '<stop offset=".45" stop-color="#ffd6f4"/><stop offset=".7" stop-color="#c9f2ff"/>' : '';
  const fill = `<defs><radialGradient id="${id}" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/>${rim}<stop offset="${c.look === 'pearl' ? '.55' : '.4'}" stop-color="${c.hex}"/><stop offset="1" stop-color="${c.hex}" stop-opacity=".85"/></radialGradient></defs>`;
  const paint = ` fill="url(#${id})" stroke="var(--ink)" stroke-width="1.6" stroke-linejoin="round"/>`;
  const body = c.shape === 'pearl' ? `<circle cx="12" cy="12" r="8.5"${paint}`
    : c.shape === 'flower' ? `${petals.map(([x, y]) => `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="4.4"${paint}`).join('')}<circle cx="12" cy="12.4" r="3.4"${paint}`
    : `<path d="${GEM_PATH[c.shape]}"${paint}`;
  const facets = c.shape === 'stone' ? '<path d="M8.6 8.6h6.8v6.8H8.6zM12 2.5v6.1M21.5 12h-6.1M12 21.5v-6.1M2.5 12h6.1" fill="none" stroke="#fff" stroke-width=".9" opacity=".7"/>' : '';
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${fill}${body}${facets}</svg>`;
};

// visible text is none: the error screen and the save notice are icons too (their words are spoken labels)
document.querySelector('#error .oops').innerHTML = ICON.oops;
$('retry').innerHTML = ICON.redo;
$('notice').innerHTML = ICON.cloud;

function fail(code, error) {
  $('cover').hidden = true;
  $('error').hidden = false;
  $('error-code').textContent = code;
  if (error) console.error(error);
}
$('retry').onclick = () => location.reload(); // reloads the page and the SDK; the save is never touched

async function main() {
  let host;
  try { host = createHost({ dev: globalThis.MAKEUP_DEV === true }); } catch (e) { return fail(e.code || 'SDK', e); }
  host.firstFrameReady(); // the loading screen is showing

  const stage = $('stage');
  // the canvas fills the stage, as on phones; on tall, narrow screens it can be as narrow as 0.4 × its height, where
  // she fills the width like a close-up (her hair runs off the sides), and no narrower
  const fit = () => { const w = Math.min(stage.clientWidth, 1200); return [w, Math.min(stage.clientHeight, Math.round(w / 0.4))]; };
  let [W, H] = fit();
  const canvas = document.createElement('canvas');
  canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
  stage.prepend(canvas);
  let view, raw;
  try {
    [view, raw] = await Promise.all([
      FaceView.load('head.bin.gz', { canvas, width: W, height: H, pixelRatio: Math.min(devicePixelRatio, 2), transparent: true }),
      host.load(),
    ]);
  } catch (e) { return fail('LOAD', e); }
  const parsed = G.parseSave(raw);
  // unknown, damaged or newer saves are protected: the game stops rather than overwrite them
  if (parsed.error) return fail(`SAVE-${parsed.error.toUpperCase()}`);

  // ---- state ----
  let panelOpen = false, paused = false, frame = 0;
  const redraw = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; view.render(); }); };
  const session = new Session(host, parsed.state || G.newGame(crypto.getRandomValues(new Uint32Array(1))[0]), { onChange: () => render() });
  if (!parsed.state) session.touch(); // a new player's first state is saved straight away
  view.makeup.allowed = (id) => G.canUse(session.state, id);
  let shown = { attempt: 0, seed: -1 };
  // show the current attempt's face and makeup (a new face, a replay, or the saved work at startup)
  const sync = () => {
    const s = session.state;
    if (shown.attempt === s.attempt.id) return;
    if (shown.seed !== s.face.seed) view.setFace(s.face); else view.makeup.reset(s.face);
    const m = s.attempt.makeup;
    if (m.strokes.length || m.lenses.left || m.lenses.right) view.makeup.restore(m);
    shown = { attempt: s.attempt.id, seed: s.face.seed };
    redraw();
  };

  // ---- input on the face ----
  const input = attachInput(canvas, view.makeup, {
    selection: () => {
      const s = session.state;
      if (s.attempt.phase !== 'create' || panelOpen || paused || session.busy || finishing) return null;
      return { tool: s.selection.tool, colour: s.selection.colour[s.selection.tool] };
    },
    onChange: redraw,
    onCommit: (change) => {
      session.applied(view.makeup.makeup);
      if (change.lens) tap('lens');
      else if (change.stroke?.tool === 'gem') tap('gem', colourById(change.stroke.colour));
    },
    feedback: {
      // each stroke's sound follows the hand, in decimetres a second on the face (the same on every screen)
      down(sel) { this.voice = stroke(sel.tool, colourById(sel.colour)); this.last = null; },
      move(x, y, contact) {
        const t = performance.now() / 1000, P = view.makeup.picker;
        if (this.voice && this.last) {
          const [ax] = P.project([0, 0, 0.5]), [bx] = P.project([0.1, 0, 0.5]);
          this.voice.move(Math.hypot(x - this.last[0], y - this.last[1]) / (Math.abs(bx - ax) * 10), t - this.last[2], contact);
        }
        this.last = [x, y, t];
      },
      up() { this.voice?.end(); this.voice = null; },
    },
  });
  host.onPause = () => { input.interrupt(); session.flush().catch(() => {}); }; // the final-save window
  let audio = false;
  host.onState((st) => {
    paused = st.paused;
    audio = st.audio;
    setEnabled(audio);
    if (paused) input.interrupt();
    hush(!audio);
    $('app').inert = paused;
    $('panel').inert = paused;
  });

  // ---- tools and colours ----
  const toolbar = $('toolbar'), swatches = $('swatches');
  for (const [id, label] of TOOLS) {
    const b = document.createElement('button');
    b.dataset.tool = id;
    b.className = 'ctl';
    b.setAttribute('aria-label', label);
    b.innerHTML = ICON[id];
    b.onclick = () => { if (session.state.selection.tool !== id) ui('tool'); session.select(id); };
    toolbar.appendChild(b);
  }
  let shownSelection = '';
  const renderSwatches = () => {
    const s = session.state, tool = s.selection.tool, key = `${tool}:${s.selection.colour[tool]}:${s.owned.length}`;
    if (key === shownSelection) return;
    shownSelection = key;
    swatches.replaceChildren(...coloursFor(tool, s.owned).map((c) => {
      const b = document.createElement('button');
      if (c.shape) { b.className = 'gem'; b.innerHTML = gemSwatch(c); } else b.style.background = swatchBackground(c);
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-label', c.daily ? `${c.name} (colour of the day)` : c.name);
      b.setAttribute('aria-checked', String(s.selection.colour[tool] === c.id));
      if (c.daily) b.insertAdjacentHTML('beforeend', ICON.star);
      b.onclick = () => { if (session.state.selection.colour[tool] !== c.id) ui('colour'); session.select(tool, c.id); };
      return b;
    }));
    swatches.querySelector('[aria-checked="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };

  // ---- the next customer's picture (a small second view that only draws faces) ----
  const thumbs = new Map(); // seed -> a copy of the render (a few at a time)
  let side = null;
  const thumb = (face) => {
    if (thumbs.has(face.seed)) return thumbs.get(face.seed);
    if (!side) {
      side = new FaceView({ canvas: document.createElement('canvas'), width: 168, height: 168, pixelRatio: Math.min(devicePixelRatio, 2), transparent: true, makeup: false });
      side.init(view.head);
      side.zoom(1.75, 0.08); // the head
    }
    side.setFace(face);
    side.render();
    const src = side.renderer.domElement, copy = document.createElement('canvas');
    copy.width = src.width; copy.height = src.height;
    copy.getContext('2d').drawImage(src, 0, 0);
    thumbs.set(face.seed, copy);
    if (thumbs.size > 4) thumbs.delete(thumbs.keys().next().value);
    return copy;
  };
  // drawn while the player works on the current face, so review shows it at once
  const prepare = () => {
    const next = session.state.next;
    (globalThis.requestIdleCallback || ((f) => setTimeout(f, 300)))(() => { if (session.state.next === next) thumb(next); });
  };

  // ---- create, the finish, and review ----
  $('done').innerHTML = `${SEAL}${ICON.check}`;
  $('next').querySelector('.go').innerHTML = ICON.next;
  $('next').querySelector('.hint').innerHTML = ICON.chev;
  // Retry sits on the counter level with Next, or in the top-left corner in landscape and on screens too narrow
  // for both (the page's scale script decides: html.redo-top)
  // a tall counter (tall, narrow screens, where the counter takes the height the face can't use) holds bigger
  // controls; it is tall once it has room for them (360 px at the UI scale)
  const tallCounter = () => {
    const root = document.documentElement, s = parseFloat(getComputedStyle(root).getPropertyValue('--s')) || 1;
    const foot = document.querySelector('footer:not([hidden])');
    root.classList.toggle('tall', !root.classList.contains('land') && !!foot && foot.getBoundingClientRect().height / s >= 360);
  };
  tallCounter();
  const placeRedo = () => {
    const root = document.documentElement, home = root.classList.contains('redo-top') && !root.classList.contains('tall') ? $('top') : $('review'), redo = $('redo');
    if (redo.parentElement !== home) home.prepend(redo);
  };
  placeRedo();
  $('redo').innerHTML = `${ICON.redo}${BADGE}`;
  // sparkles burst from the face (positions in the stage, in pixels)
  const burst = () => {
    const fx = $('fx'), w = stage.clientWidth, h = stage.clientHeight;
    const colours = ['#ff7aa8', '#ffd166', '#fff6e6', '#7ce3cf', '#c39bff', '#ffb627'];
    const star = 'polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%)';
    const bits = [];
    for (let k = 0; k < 34; k++) {
      const a = (k / 34) * 2 * Math.PI + Math.random() * 0.3, d = (0.28 + Math.random() * 0.32) * Math.min(w, h);
      const i = document.createElement('i'), s = 10 + Math.random() * 14, kind = k % 3;
      i.style.cssText = `--x:${w / 2}px;--y:${h * 0.42}px;--s:${s}px;--c:${colours[k % colours.length]};--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d + 40}px;` +
        `--rot:${Math.random() * 540 - 270}deg;--t:${0.9 + Math.random() * 0.5}s;--r:${kind === 1 ? '50%' : '3px'};${kind === 0 ? `--clip:${star};border:0;` : ''}`;
      bits.push(i);
    }
    const glow = document.createElement('div');
    glow.className = 'glow';
    fx.replaceChildren(glow, ...bits);
    setTimeout(() => fx.replaceChildren(), 1600);
  };
  let finishing = false;
  $('done').onclick = () => {
    if (finishing || session.busy) return;
    input.interrupt();
    const s = session.state, changed = isChanged(s.attempt.makeup, s.face.eyes.iris);
    chime(changed);
    if (!changed) { session.finish(); return; } // an untouched look: straight to review, quietly
    // a finished look: the seal pops, a chime, sparkles; then review rises onto the counter
    finishing = true;
    $('done').classList.add('pop');
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) burst();
    setTimeout(() => { finishing = false; $('done').classList.remove('pop'); session.finish(); }, 380);
  };
  // a request marks the session busy straight away, so the buttons are disabled while it runs
  $('next').onclick = async () => { input.interrupt(); const p = session.next(); render(); await p; sync(); render(); prepare(); ui('next'); };
  $('redo').onclick = async () => {
    const p = session.reward('replay');
    render();
    if (await p) ui('next'); else nope($('redo'));
    sync(); render();
  };
  const nope = (el) => { el.classList.remove('nope'); void el.offsetWidth; el.classList.add('nope'); ui('nope'); };

  // ---- the colour of the day ----
  const daily = $('daily'), panel = $('panel'), card = panel.querySelector('.card');
  daily.innerHTML = `${ICON.gift}<span class="dot" hidden></span>`;
  daily.hidden = !host.rewardedSupported; // no rewarded videos here: nothing to offer
  card.querySelector('.x').innerHTML = ICON.close;
  let panelTimer = 0;
  const RING_C = 2 * Math.PI * 62;
  const RING = '<svg class="ring" viewBox="0 0 140 140" aria-hidden="true"><circle class="trk" cx="70" cy="70" r="62"/><g transform="rotate(-90 70 70) translate(0 140) scale(1 -1)"><circle class="arc out" cx="70" cy="70" r="62"/><circle class="arc col" cx="70" cy="70" r="62"/></g></svg>';
  // minimal: the product in today's colour; one button (a video, or a tick once it is yours); the time left
  const renderPanel = () => {
    const s = session.state, pick = s.pick, c = pick && colourById(pick.colour), owned = !!c && s.owned.includes(c.id);
    const t = timeLeft(), art = card.querySelector('.art'), get = card.querySelector('.get'), time = card.querySelector('.time');
    if (art.dataset.colour !== `${c?.id}:${owned}`) {
      art.dataset.colour = `${c?.id}:${owned}`;
      art.innerHTML = `${c && !owned ? RING : ''}${c ? `<span class="pic">${productShot(c)}</span>` : ''}${owned || !c ? `<span class="tick">${ICON.check}</span>` : ''}`;
    }
    // the countdown, as Haircut's: what is left of the day as an arc emptying anticlockwise towards the top
    const live = !!c && !owned, len = Math.max(t.frac * RING_C, t.frac > 0 ? 4 : 0);
    for (const a of art.querySelectorAll('.ring .arc')) a.setAttribute('stroke-dasharray', `${len.toFixed(1)} ${RING_C.toFixed(1)}`);
    for (const l of ['g', 'o', 'r']) { card.classList.toggle(l, live && t.level === l); time.classList.toggle(l, live && t.level === l); }
    card.classList.toggle('last', live && t.last);
    art.setAttribute('aria-label', c ? `${TOOL_NAME[c.target]} in ${c.name}` : 'You have every colour');
    get.hidden = !c;
    get.disabled = session.busy; // once owned it is a tick that closes the panel (the colour is already selected)
    get.classList.toggle('owned', owned);
    get.innerHTML = owned ? ICON.check : `<span class="vb">${ICON.video}</span>`;
    get.setAttribute('aria-label', owned ? 'Yours. Use it now' : 'Watch one video to keep this colour for good');
    time.hidden = !c;
    time.innerHTML = `${ICON.clock} ${t.text}`;
    time.setAttribute('aria-label', `${owned ? 'Next colour in' : 'Ends in'} ${t.text}`);
  };
  const openPanel = () => {
    input.interrupt();
    ui('panel');
    session.refreshDaily(); session.openedDaily();
    panelOpen = true; panel.hidden = false;
    renderPanel();
    clearInterval(panelTimer);
    panelTimer = setInterval(() => { if (!paused) { session.refreshDaily(); renderPanel(); } }, 1000); // midnight brings the next colour
    fitCard();
    card.querySelector('.get').focus();
  };
  // the card shrinks below the UI scale when the screen is too short for it
  const fitCard = () => {
    if (!panelOpen) return;
    card.style.zoom = '';
    const h = card.getBoundingClientRect().height, room = innerHeight - 28;
    if (h > room) card.style.zoom = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--s')) * room / h).toFixed(3);
  };
  addEventListener('resize', fitCard);
  const closePanel = () => { panelOpen = false; panel.hidden = true; clearInterval(panelTimer); render(); daily.focus(); };
  daily.onclick = openPanel;
  card.querySelector('.x').onclick = closePanel;
  panel.addEventListener('click', (e) => { if (e.target === panel) closePanel(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && panelOpen) closePanel(); });
  card.querySelector('.get').onclick = async () => {
    const get = card.querySelector('.get');
    if (session.state.owned.includes(session.state.pick?.colour)) { closePanel(); return; } // "use it now": it is selected
    const p = session.reward('daily');
    renderPanel();
    if (await p) ui('reward'); else nope(get);
    render();
  };

  // ---- the screen follows the state ----
  function render() {
    const s = session.state, review = s.attempt.phase === 'review';
    document.body.classList.toggle('review', review);
    $('create').hidden = review;
    $('review').hidden = !review;
    if (review) { const slot = $('next').querySelector('.pic'), pic = thumb(s.next); if (slot.firstChild !== pic) slot.replaceChildren(pic); }
    $('redo').hidden = !host.rewardedSupported;
    for (const b of [$('next'), $('redo'), $('done')]) b.disabled = session.busy;
    for (const b of toolbar.children) b.setAttribute('aria-pressed', String(b.dataset.tool === s.selection.tool));
    renderSwatches();
    daily.querySelector('.dot').hidden = !session.dailyWaiting;
    $('notice').hidden = !session.saveFailed;
    if (panelOpen) renderPanel();
  }

  // making time for the ad pacing: only while creating, unpaused, with no panel open
  let last = performance.now();
  const tick = (t) => {
    const dt = Math.min(t - last, 250);
    last = t;
    if (!paused && !panelOpen && document.visibilityState === 'visible') session.tick(dt);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  setInterval(() => { if (!paused) { session.refreshDaily(); render(); } }, 60000); // the daily dot at midnight

  // the salon mirror hangs behind her head, sized from her: its box in the face's space (decimetres, a little
  // behind her), projected to the screen. It keeps its size beside her on every screen: on a phone the camera is
  // closer, so the arch shows above her head and the sides run off the edges, as in a close-up photo.
  const mirror = document.querySelector('#backdrop .mirror'), MW = 2.6, MH = 4.2; // its size in decimetres
  // The bulbs: evenly spaced along the frame, up the left side, round the arch and down the right side (the arch
  // is CSS's border-radius 50% / 30%: half an ellipse across the whole width, 30 % of the height tall). Each is
  // placed as a fraction of the mirror, so the lights are the same, in the same places, on every screen; where a
  // screen crops the mirror, the arch above her head still carries its run of bulbs.
  {
    const on = 0.07, a = MW / 2 - on, b = 0.3 * MH - on, cy = 0.3 * MH, foot = 0.94 * MH, path = [];
    for (let k = 0; k <= 60; k++) path.push([on, foot + (cy - foot) * (k / 60)]);
    for (let k = 1; k <= 240; k++) { const t = Math.PI * (1 - k / 240); path.push([MW / 2 + a * Math.cos(t), cy - b * Math.sin(t)]); }
    for (let k = 1; k <= 60; k++) path.push([MW - on, cy + (foot - cy) * (k / 60)]);
    const at = [0];
    for (let k = 1; k < path.length; k++) at.push(at[k - 1] + Math.hypot(path[k][0] - path[k - 1][0], path[k][1] - path[k - 1][1]));
    const length = at.at(-1), count = Math.round(length / 0.5), bulbs = [];
    for (let n = 0, k = 1; n < count; n++) {
      const s = (length * (n + 0.5)) / count;
      while (at[k] < s) k++;
      const f = (s - at[k - 1]) / (at[k] - at[k - 1]), x = path[k - 1][0] + (path[k][0] - path[k - 1][0]) * f, y = path[k - 1][1] + (path[k][1] - path[k - 1][1]) * f;
      const i = document.createElement('i');
      i.style.cssText = `left:${((x / MW) * 100).toFixed(3)}%;top:${((y / MH) * 100).toFixed(3)}%`;
      bulbs.push(i);
    }
    mirror.querySelector('.bulbs').replaceChildren(...bulbs);
  }
  const placeMirror = () => {
    const P = view.makeup.picker, c = canvas.getBoundingClientRect(), z = -0.8;
    const [x0, y0] = P.project([-MW / 2, 1.6, z]), [x1, y1] = P.project([MW / 2, 1.6 - MH, z]);
    Object.assign(mirror.style, { left: `${c.left + x0}px`, top: `${c.top + y0}px`, width: `${x1 - x0}px`, height: `${y1 - y0}px` });
    mirror.style.setProperty('--u', `${(x1 - x0) / MW}px`);
    mirror.classList.add('placed');
  };

  // the canvas fills the stage (window size, orientation, bars)
  new ResizeObserver(() => {
    const [w, h] = fit();
    if (w !== W || h !== H) {
      input.interrupt(); // a resize ends the stroke; its applied part is kept
      [W, H] = [w, h];
      view.setSize(W, H);
      canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
      redraw();
    }
    placeMirror(); // the canvas may also have moved
    tallCounter();
    placeRedo();
  }).observe(stage);

  // ---- ready ----
  session.refreshDaily();
  sync();
  render();
  view.render();
  placeMirror();
  $('cover').hidden = true;
  prepare();
  await host.gameReady();
  Object.assign(globalThis, { game: { session, view, host, input, sounds } }); // for tests and debugging
}

main().catch((e) => fail('START', e));
