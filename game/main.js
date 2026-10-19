// The game: one screen. Create (four tools and the lenses, their colours, Done) → review (hold for the before,
// Redo for a video, Next) → the next customer. The colour of the day is behind the button at the top left.
// Rules and saving are in src/game; this file is the screen.
import { FaceView } from '../src/face/face-view.js';
import { attachInput } from '../src/makeup/input.js';
import { coloursFor, colourById } from '../src/makeup/palette.js';
import { createHost } from '../src/game/youtube.js';
import * as G from '../src/game/game.js';
import { Session } from '../src/game/session.js';
import { timeLeft } from '../src/game/daily.js';

const $ = (id) => document.getElementById(id);
const svg = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}><path d="${d}"/></svg>`;
const ICON = {
  brush: svg('M5 21c3 0 5-2 5-5l1-1 2 2-1 1c-3 0-5 2-7 3zM11 15l7-11 2 2-7 11'),
  pencil: svg('M4 20l1-4L16 5l3 3L8 19zM14 7l3 3'),
  mascara: svg('M4 20L15 9M13 5l6 6M15 4l5 5M11 7l6 6M12 4l1 2M18 10l2 1'),
  lip: svg('M9 21h6v-8H9zM10 13V7l4-3v9'),
  lens: svg('M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6'),
  check: svg('M5 12.5l4.5 4.5L19 7.5', ' stroke-width="2.6"'),
  next: svg('M5 12h13M13 6l6 6-6 6', ' stroke-width="2.4"'),
  redo: svg('M4 12a8 8 0 1 0 3-6.2M4 4v4h4', ' stroke-width="2.2"'),
  eye: svg('M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12zM12 10a2 2 0 1 0 0 4 2 2 0 1 0 0-4'),
  video: svg('M3 5.5h18v12H3zM10 9v5.5l4.6-2.7zM8 21h8'),
  clock: svg('M12 4.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 1 0 0-17M12 8.5V13l3 2'),
  close: svg('M6 6l12 12M18 6L6 18', ' stroke-width="2.6"'),
  gift: svg('M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7c-2-4-6-3-5 0M12 7c2-4 6-3 5 0'),
  star: '<svg class="star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5l2.2 7.3 7.3 2.2-7.3 2.2L12 20.5l-2.2-7.3L2.5 11l7.3-2.2z" fill="#ffe14d" stroke="#2b2522" stroke-width="1.6" stroke-linejoin="round"/></svg>',
};
const TOOLS = [['brush', 'Brush'], ['pencil', 'Pencil'], ['mascara', 'Mascara'], ['lip', 'Lips'], ['lens', 'Lenses']];
const TOOL_NAME = Object.fromEntries(TOOLS);
// a swatch's look: its colour, with a shine for gloss and sparkles for shimmer
const swatchBackground = (c) => (c.gloss
  ? `radial-gradient(circle at 35% 30%, #fffc 0 14%, #fff0 32%)${c.shimmer ? ', radial-gradient(circle at 66% 62%, #fff9 0 6%, #fff0 14%)' : ''}, ${c.hex}`
  : c.shimmer ? `radial-gradient(circle at 30% 30%, #fffb 0 7%, #fff0 16%), radial-gradient(circle at 66% 62%, #fff9 0 5%, #fff0 13%), ${c.hex}` : c.hex);

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
  const fit = () => [Math.min(stage.clientWidth, 900), stage.clientHeight];
  let [W, H] = fit();
  const canvas = document.createElement('canvas');
  canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
  stage.prepend(canvas);
  let view, raw;
  try {
    [view, raw] = await Promise.all([
      FaceView.load('head.bin.gz', { canvas, width: W, height: H, pixelRatio: Math.min(devicePixelRatio, 2) }),
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
      if (s.attempt.phase !== 'create' || panelOpen || paused || session.busy) return null;
      return { tool: s.selection.tool, colour: s.selection.colour[s.selection.tool] };
    },
    onChange: redraw,
    onCommit: () => session.applied(view.makeup.makeup),
  });
  host.onPause = () => { input.interrupt(); session.flush().catch(() => {}); }; // the final-save window
  host.onState((st) => {
    paused = st.paused;
    if (paused) input.interrupt();
    $('app').inert = paused;
    $('panel').inert = paused;
  });

  // ---- tools and colours ----
  const toolbar = $('toolbar'), swatches = $('swatches');
  for (const [id, label] of TOOLS) {
    const b = document.createElement('button');
    b.dataset.tool = id;
    b.innerHTML = `${ICON[id]}${label}`;
    b.onclick = () => session.select(id);
    toolbar.appendChild(b);
  }
  let shownSelection = '';
  const renderSwatches = () => {
    const s = session.state, tool = s.selection.tool, key = `${tool}:${s.selection.colour[tool]}:${s.owned.length}`;
    if (key === shownSelection) return;
    shownSelection = key;
    swatches.replaceChildren(...coloursFor(tool, s.owned).map((c) => {
      const b = document.createElement('button');
      b.style.background = swatchBackground(c);
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-label', c.daily ? `${c.name} (colour of the day)` : c.name);
      b.setAttribute('aria-checked', String(s.selection.colour[tool] === c.id));
      if (c.daily) b.insertAdjacentHTML('beforeend', ICON.star);
      b.onclick = () => session.select(tool, c.id);
      return b;
    }));
    swatches.querySelector('[aria-checked="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };

  // ---- create and review ----
  $('done').innerHTML = `Done ${ICON.check}`;
  $('next').innerHTML = `Next ${ICON.next}`;
  $('redo').innerHTML = `${ICON.redo} Redo <span class="badge">${ICON.video}</span>`;
  $('before').innerHTML = `${ICON.eye} Before`;
  $('done').onclick = () => { input.interrupt(); session.finish(); };
  // a request marks the session busy straight away, so the buttons are disabled while it runs
  $('next').onclick = async () => { input.interrupt(); const p = session.next(); render(); await p; sync(); render(); };
  $('redo').onclick = async () => {
    const p = session.reward('replay');
    render();
    if (!(await p)) nope($('redo'));
    sync(); render();
  };
  // hold to compare with the clean starting face (read-only)
  const before = $('before');
  const compare = (on) => { if (session.state.attempt.phase !== 'review') return; view.makeup.showBefore(on); before.setAttribute('aria-pressed', String(on)); redraw(); };
  before.addEventListener('pointerdown', (e) => { e.preventDefault(); before.setPointerCapture(e.pointerId); compare(true); });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) before.addEventListener(type, () => compare(false));
  before.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); compare(true); } });
  before.addEventListener('keyup', () => compare(false));
  before.addEventListener('contextmenu', (e) => e.preventDefault());
  const nope = (el) => { el.classList.remove('nope'); void el.offsetWidth; el.classList.add('nope'); };

  // ---- the colour of the day ----
  const daily = $('daily'), panel = $('panel'), card = panel.querySelector('.card');
  daily.innerHTML = `${ICON.gift}<span class="dot" hidden></span>`;
  daily.hidden = !host.rewardedSupported; // no rewarded videos here: nothing to offer
  card.querySelector('.x').innerHTML = ICON.close;
  let panelTimer = 0;
  const RING = 2 * Math.PI * 70;
  const renderPanel = () => {
    const s = session.state, pick = s.pick, c = pick && colourById(pick.colour), owned = c && s.owned.includes(c.id);
    const t = timeLeft();
    card.querySelector('.gem').innerHTML = c ? `<svg viewBox="0 0 150 150"><circle cx="75" cy="75" r="70" fill="none" stroke="#0001" stroke-width="7"/>
      <circle class="arc" cx="75" cy="75" r="70" fill="none" stroke="${t.ms < 2 * 3600e3 ? '#ff3b30' : t.ms < 6 * 3600e3 ? '#ff9f1c' : '#2fa35a'}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${(RING * t.frac).toFixed(1)} ${RING.toFixed(1)}"/></svg>
      <div class="sw" style="background:${swatchBackground(c)}"></div>${owned ? `<div class="tick">${ICON.check}</div>` : ''}` : '';
    card.querySelector('.name').innerHTML = c ? `${ICON[c.target]} ${c.name}` : 'You have every colour';
    card.querySelector('.what').textContent = c ? `${TOOL_NAME[c.target]}${owned ? ': yours to keep' : ' · yours to keep for one video'}` : 'New colours are coming.';
    const get = card.querySelector('.get');
    get.hidden = !c;
    get.disabled = session.busy; // once owned it reads "Use it now" and closes the panel
    get.innerHTML = owned ? `${ICON.check} Yours! Use it now` : `<span class="badge">${ICON.video}</span> Watch a video to get it`;
    card.querySelector('.time').innerHTML = `${ICON.clock} ${owned ? 'Next colour in' : 'Ends in'} ${t.text}`;
  };
  const openPanel = () => {
    input.interrupt();
    session.refreshDaily(); session.openedDaily();
    panelOpen = true; panel.hidden = false;
    renderPanel();
    clearInterval(panelTimer);
    panelTimer = setInterval(() => { if (!paused) { session.refreshDaily(); renderPanel(); } }, 1000); // midnight brings the next colour
    card.querySelector('.get').focus();
  };
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
    if (!(await p)) nope(get);
    render();
  };

  // ---- the screen follows the state ----
  function render() {
    const s = session.state, review = s.attempt.phase === 'review';
    $('create').hidden = review;
    $('review').hidden = !review;
    $('done').hidden = review;
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

  // the canvas fills the stage (window size, orientation, bars)
  new ResizeObserver(() => {
    const [w, h] = fit();
    if (w === W && h === H) return;
    input.interrupt(); // a resize ends the stroke; its applied part is kept
    [W, H] = [w, h];
    view.setSize(W, H);
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    redraw();
  }).observe(stage);

  // ---- ready ----
  session.refreshDaily();
  sync();
  render();
  view.render();
  $('cover').hidden = true;
  await host.gameReady();
  Object.assign(globalThis, { game: { session, view, host, input } }); // for tests and debugging
}

main().catch((e) => fail('START', e));
