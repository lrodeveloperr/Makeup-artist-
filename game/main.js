// The game: one screen. Create (seven tools and the lenses, their colours, Done) → the finish (a chime and a burst
// of sparkles) → review, as in Haircut (Retry for a video, the next customer pictured beside Next) → the next
// customer. The colour of the day is behind the button at the top left.
// Rules and saving are in src/game; this file is the screen.
import { FaceView } from '../src/face/face-view.js';
import { attachInput } from '../src/makeup/input.js';
import { ToolView } from '../src/makeup/tools3d.js';
import { zoneAt, assist, regionsAt, toLashes, ZoneGlow } from './zones.js';
import { evalPoint } from '../src/face/surface.js';
import { isChanged } from '../src/makeup/makeup.js';
import { coloursFor, colourById } from '../src/makeup/palette.js';
import { chime, hush, setEnabled, stroke, tap, ui, preload, logUnits, stats as sounds } from './sound.js';
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
  chev: svg('M9 6l6 6-6 6', ' stroke-width="3.4"'), // Haircut's hint between the next customer and Next; the colours' next page
  back: svg('M15 6l-6 6 6 6', ' stroke-width="3.4"'), // the colours' page before
  redo: svg('M4.5 12a7.5 7.5 0 1 0 2.6-5.7M4.5 4.2v4.6h4.6', ' stroke-width="3"'),
  video: svg('M3.5 5.5h17v11h-17zM10.2 8.6v5.2l4.4-2.6zM8 20h8', ' stroke-width="2.4"'),
  clock: svg('M12 4.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 1 0 0-17M12 8.5V13l3 2M9.5 2.5h5', ' stroke-width="2.6"'), // Haircut's stopwatch
  // the gift's clock: a stopwatch whose hand the second ticks round
  watch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 1 0 0-17M9.5 2.5h5"/><path class="hand" d="M12 13V8.2"/></svg>',
  forever: svg('M7 8.5c-2.2 0-3.8 1.6-3.8 3.5S4.8 15.5 7 15.5c3 0 7-7 10-7 2.2 0 3.8 1.6 3.8 3.5s-1.6 3.5-3.8 3.5c-3 0-7-7-10-7z', ' stroke-width="2.8"'),
  close: svg('M6.5 6.5l11 11M17.5 6.5l-11 11', ' stroke-width="3.2"'),
  cloud: svg('M7 18.5h10a4 4 0 0 0 .6-8 6 6 0 0 0-11.5 1.6A3.4 3.4 0 0 0 7 18.5zM4 4l16 16', ' stroke-width="2.4"'),
  oops: svg('M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18M12 7.5v6M12 16.6v.4', ' stroke-width="2.8"'),
  gift: svg('M4 10.5h16V21H4zM2.8 7h18.4v3.5H2.8zM12 7v14M12 7c-1.6-4.2-6.2-3.6-5.2-.4M12 7c1.6-4.2 6.2-3.6 5.2-.4', ' stroke-width="2.3"'),
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

// the loading screen's compact: it fills and empties in a loop until the game can measure its loading (the face's
// download, where its size is known); then it fills with it, never backwards: the download (10 to 85 %), the face set
// up (95 %), and it completes as the game starts, measured or not
let filled = 0, measured = false;
const loading = (p, measure = false) => {
  measured ||= measure;
  if (!measured || p <= filled) return;
  filled = p;
  const cover = $('cover');
  cover.classList.remove('wait');
  cover.style.setProperty('--p', p);
  cover.firstChild.setAttribute('aria-valuenow', Math.round(p * 100));
};

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
  preload(); // the tools' recordings load with the face

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
      FaceView.load('head.bin.gz', { canvas, width: W, height: H, pixelRatio: Math.min(devicePixelRatio, 2), transparent: true }, (f) => loading(0.1 + 0.75 * f, true), typeof HEAD_BYTES === 'number' ? HEAD_BYTES : 0),
      host.load(),
    ]);
  } catch (e) { return fail('LOAD', e); }
  loading(0.95);
  const parsed = G.parseSave(raw);
  // unknown, damaged or newer saves are protected: the game stops rather than overwrite them
  if (parsed.error) return fail(`SAVE-${parsed.error.toUpperCase()}`);

  // ---- state ----
  let panelOpen = false, paused = false, frame = 0;
  // The next frame draws the whole picture again, or, while painting, only the patch round the stroke (CSS pixels:
  // [x0, y0, x1, y1]): on a phone the face is millions of shaded pixels, the stroke a few thousand
  let dirty = null; // null: nothing to draw; 'all'; or the patch
  const draw = () => { frame = 0; const d = dirty; dirty = null; view.render(d === 'all' ? null : [d[0], d[1], d[2] - d[0], d[3] - d[1]]); };
  const redraw = () => { dirty = 'all'; if (!frame) frame = requestAnimationFrame(draw); };
  const redrawPatch = (x0, y0, x1, y1) => {
    if (dirty !== 'all') dirty = dirty ? [Math.min(dirty[0], x0), Math.min(dirty[1], y0), Math.max(dirty[2], x1), Math.max(dirty[3], y1)] : [x0, y0, x1, y1];
    if (!frame) frame = requestAnimationFrame(draw);
  };
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
  // ---- the tool in hand (owner, 19 October 2026) ----
  // The selected tool is drawn in 3D where it works, lit like her and at her scale (makeup/tools3d.js): a mouse or a
  // pen holds it in place of the cursor, its tip at the pointer, from the moment it is over her face; a finger holds
  // it while it is down, its tip a little above the finger (input.js) and its handle running down to the finger.
  // A phone may take a page's graphics away (a backgrounded tab, memory pressure) and give them back: every GPU
  // resource is made again when next drawn, and `after` repaints what lived only on the GPU
  const revive = (renderer, after) => {
    renderer.domElement.addEventListener('webglcontextlost', (e) => e.preventDefault());
    renderer.domElement.addEventListener('webglcontextrestored', () => {
      const gl = renderer.gl;
      for (const m of [renderer.programs, renderer.buffers, renderer.vaos, renderer.textures]) m.clear();
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.frontFace(gl.CCW);
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      after();
    });
  };
  // the face: its paint is replayed from the look
  revive(view.renderer, () => { const m = view.makeup.makeup; view.makeup.reset(view.profile); view.makeup.restore(m); redraw(); });
  const hand = $('hand'), tools = new ToolView();
  revive(tools.renderer, () => { handFor = ''; });
  hand.append(tools.canvas);
  let handFor = '', tip = [0, 0];
  // draw the tool for a selection and a grip (unless it is drawn already): a pen-like angle under a mouse; under a
  // finger, the handle runs down to it, leaning right. Under a mouse the highlighter's fan brush sweeps along her
  // cheekbone, which rises outwards, so its fan lies along it: the handle runs down and out, away from the middle of her
  // face, on whichever side (out: -1 left of her middle, 1 right)
  const holdTool = (sel, kind, out) => {
    const P = view.makeup.picker, [ax] = P.project([0, 0, 0.5]), [bx] = P.project([0.1, 0, 0.5]), k = Math.abs(bx - ax) * 10; // pixels a decimetre
    const fan = sel.tool === 'glow';
    const dir = kind === 'touch' ? [0.28, 1] : fan ? [0.5 * out, 1] : [1, 1.15]; // a finger: every tool leans right alike
    const dpr = Math.min(devicePixelRatio, 2), key = `${sel.tool}:${sel.colour}:${kind}:${fan && kind !== 'touch' ? out : ''}:${k.toFixed(1)}:${dpr}`;
    if (handFor !== key) {
      handFor = key;
      ({ tip } = tools.draw(sel.tool, colourById(sel.colour), { dir }, k, dpr));
      hand.dataset.tip = tip.map((v) => v.toFixed(1)).join(','); // where its tip is in its picture (for tests)
    }
  };
  // on a touch screen the tool is drawn as soon as it (or its colour) is picked, so it is in hand the moment a finger
  // lands
  const touchFirst = matchMedia('(pointer: coarse)').matches;
  const readyTool = () => {
    const s = session.state, sel = { tool: s.selection.tool, colour: s.selection.colour[s.selection.tool] };
    if (touchFirst && hand.hidden && s.attempt.phase === 'create' && view.makeup.picker.camera) holdTool(sel, 'touch', 1);
  };
  // assisted touch (zones.js): under a finger each tool works only in its zones, which light up faintly while it is down
  const mouth = view.head.header.landmarks.mouth, glow = new ZoneGlow(view);
  const guide = (hit) => toLashes(hit, view.makeup.picker, view.eyes);
  const lift = (x, y, z) => { const h = view.sampler.locate(x, y, z); return h && [evalPoint(h, view.headGeometry.refSub, []), evalPoint(h, view.headGeometry.subPos, [])]; };
  view.makeup.zones = (tool, hit, locked) => {
    const z = assist(tool, hit, regionsAt(view.headGeometry.geometry, hit.at), view.profile.brows, mouth, locked, guide, lift);
    // guided or captured paint lands away from the finger (up to about 11 mm): the patch redrawn covers where it went
    if (z !== null && tool !== 'gem') { const [x, y] = view.makeup.picker.project(hit.pos); grow(x, y, x, y, tool); }
    return z;
  };
  const showZones = (tool) => {
    const was = glow.mesh.visible;
    glow.show(tool === 'lens' || tool === 'mascara' ? null : tool, view.profile.brows, mouth);
    if (glow.mesh.visible !== was) redraw();
  };
  const aim = (x, y, sel, kind) => {
    if (x === null) { hand.hidden = true; canvas.style.cursor = ''; showZones(null); return; }
    if (kind === 'touch') showZones(sel.tool);
    const [ax] = view.makeup.picker.project([0, 0, 0.5]);
    holdTool(sel, kind, x < ax ? -1 : 1);
    const r = canvas.getBoundingClientRect();
    hand.style.transform = `translate(${(r.left + x - tip[0]).toFixed(1)}px, ${(r.top + y - tip[1]).toFixed(1)}px)`;
    hand.hidden = false;
    canvas.style.cursor = kind === 'touch' ? '' : 'none'; // the tool is the cursor
  };
  // how far a stroke can change the face from a painted point (decimetres): the tool's radius and its dabs' soft
  // edge, and the mascara's wand with the lashes it lengthens
  // (the liner's: its taper's tail too, drawn as a guided line leaves its zone)
  const REACH = { brush: 0.2, glow: 0.13, pencil: 0.05, liner: 0.1, lip: 0.08, mascara: 0.3 };
  let patch = null;
  // add a box (CSS pixels) and the tool's reach round it to the patch
  const grow = (x0, y0, x1, y1, tool) => {
    const P = view.makeup.picker, [px] = P.project([0, 0, 0.5]), [qx] = P.project([0.1, 0, 0.5]), r = (REACH[tool] ?? 0.2) * Math.abs(qx - px) * 10 + 14;
    const b = [x0 - r, y0 - r, x1 + r, y1 + r];
    patch = patch ? [Math.min(patch[0], b[0]), Math.min(patch[1], b[1]), Math.max(patch[2], b[2]), Math.max(patch[3], b[3])] : b;
  };
  // under a finger every tool leans right as it is drawn (holdTool; owner, 20 October 2026: the highlighter too, as
  // leaning left upset the alignment), so its tip is set back across the finger, 1.5 times its lean (the owner's pick
  // on a phone of B1 to B2): the tool shows over the finger, not beside it
  const lean = () => 1.5 * 0.28;
  // a contact lens is held nearer the finger than the other tools (owner, 20 October 2026: it was too high)
  const LENS_REACH = 0.85; // (the owner's pick on a phone)
  const reach = (sel) => (sel.tool === 'lens' ? LENS_REACH : 1);
  const input = attachInput(canvas, view.makeup, {
    aim, lean, reach,
    selection: () => {
      const s = session.state;
      if (s.attempt.phase !== 'create' || panelOpen || paused || session.busy || finishing) return null;
      return { tool: s.selection.tool, colour: s.selection.colour[s.selection.tool] };
    },
    // a stroke changes the face only round the points it painted (the tool's reach, and a little more for the
    // dabs a step behind); anything else (a gem, a lens) redraws the whole face
    onChange: () => { if (patch) { redrawPatch(...patch); patch = null; } else redraw(); },
    onCommit: (change) => {
      // a lens or a gem changes more than a stroke's patch: the whole face is drawn again
      if (change.lens || change.stroke?.tool === 'gem') { patch = null; redraw(); }
      session.applied(view.makeup.makeup);
      if (change.lens) tap('lens');
      else if (change.stroke?.tool === 'gem') tap('gem', colourById(change.stroke.colour));
    },
    feedback: {
      // each stroke's sound follows the hand, in decimetres a second on the face (the same on every screen)
      down(sel) { this.voice = stroke(sel.tool, colourById(sel.colour)); this.last = null; this.tool = sel.tool; patch = null; },
      move(x, y, contact, time) {
        const t = (time ?? performance.now()) / 1000, P = view.makeup.picker;
        // the patch this sample may change, from the last sample to this one
        const [lx, ly] = this.last || [x, y];
        grow(Math.min(x, lx), Math.min(y, ly), Math.max(x, lx), Math.max(y, ly), this.tool);
        if (this.voice && this.last) {
          const [ax] = P.project([0, 0, 0.5]), [bx] = P.project([0.1, 0, 0.5]);
          const dx = x - this.last[0], dy = y - this.last[1];
          this.voice.move(Math.hypot(dx, dy) / (Math.abs(bx - ax) * 10), t - this.last[2], contact, dx, dy);
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
  // The colours (owner, 19 October 2026: at most six at a time, nothing cut off, on every screen): a tool's colours
  // six to a page, its newest colours of the day first (the one just earned is on the first page), then its base
  // colours. With more than six, quiet arrows turn the pages: either side of the row in portrait, a pair below the
  // two rows of three at the side and on a tall counter. The one with nowhere to go fades out; a finger can also swipe
  // the page, a mouse drag it or flick its wheel. A tool opens on the page with its picked colour. Nothing scrolls, so no colour is ever
  // half shown, and there are no badges: the colours alone.
  const back = $('back'), more = $('more'), root = document.documentElement;
  back.innerHTML = ICON.back; more.innerHTML = ICON.chev; // (Haircut's chevron, as the hint by Next)
  let shownSelection = '', list = [], page = 0, perPage = 6;
  const pages = () => Math.max(1, Math.ceil(list.length / perPage));
  const swatch = (c, tool, picked) => {
    const b = document.createElement('button');
    if (c.shape) { b.className = 'gem'; b.innerHTML = gemSwatch(c); } else b.style.background = swatchBackground(c);
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-label', c.daily ? `${c.name} (colour of the day)` : c.name);
    b.setAttribute('aria-checked', String(picked));
    b.onclick = () => { if (session.state.selection.colour[tool] !== c.id) ui('colour'); session.select(tool, c.id); };
    return b;
  };
  // the page on show, and its arrows
  const showPage = (dir = 0) => {
    const s = session.state, tool = s.selection.tool, n = pages();
    page = Math.min(Math.max(page, 0), n - 1);
    swatches.replaceChildren(...list.slice(page * perPage, (page + 1) * perPage).map((c) => swatch(c, tool, s.selection.colour[tool] === c.id)));
    $('colours').classList.toggle('paged', n > 1);
    back.disabled = page === 0;
    more.disabled = page === n - 1;
    // in a portrait row every page is a full page wide, so the arrows stay put (a short last page starts at the left)
    const row = n > 1 && !root.classList.contains('land') && !root.classList.contains('tall');
    swatches.style.width = row ? `${perPage * 50 - 2}px` : ''; // 40 px colours 10 px apart, 4 px each side
    swatches.style.justifyContent = row ? 'flex-start' : '';
    if (dir) { swatches.style.setProperty('--dir', String(dir)); swatches.classList.remove('turn'); void swatches.offsetWidth; swatches.classList.add('turn'); }
  };
  const turn = (to) => {
    to = Math.min(Math.max(to, 0), pages() - 1);
    if (to === page) return;
    const dir = Math.sign(to - page);
    page = to;
    ui('page');
    showPage(dir);
  };
  back.onclick = () => turn(page - 1);
  more.onclick = () => turn(page + 1);
  // how many colours a page holds: six, or as many as fit between the arrows across a narrow portrait counter
  const fitPage = () => {
    let fit = 6;
    if (!root.classList.contains('land') && !root.classList.contains('tall')) {
      const foot = $('create'), cs = getComputedStyle(foot), room = foot.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const scale = parseFloat(getComputedStyle(root).getPropertyValue('--s')) || 1;
      const arrow = root.classList.contains('two') ? 50 : Math.max(34, 30 / scale); // index.html's .pg (30 px on screen at least), 4 px off the row
      fit = Math.min(6, Math.max(3, Math.floor((room - 2 * (arrow + 4) + 2) / 50))); // 40 px colours 10 px apart, 4 px each side
    }
    if (fit === perPage) return false;
    const first = page * perPage;
    perPage = fit;
    page = Math.floor(first / perPage);
    return true;
  };
  const renderSwatches = () => {
    const s = session.state, tool = s.selection.tool, key = `${tool}:${s.selection.colour[tool]}:${s.owned.length}`;
    if (key === shownSelection) return;
    const sameTool = shownSelection.startsWith(`${tool}:`) && shownSelection.endsWith(`:${s.owned.length}`);
    shownSelection = key;
    list = coloursFor(tool, s.owned);
    fitPage();
    // a new tool (or a new colour) opens on the page with the picked colour; picking on a page stays on it
    if (!sameTool) page = Math.floor(Math.max(0, list.findIndex((c) => c.id === s.selection.colour[tool])) / perPage);
    showPage();
  };
  // a mouse wheel turns one page per flick
  let wheel = { at: 0, sum: 0, done: false };
  $('create').addEventListener('wheel', (e) => {
    if (pages() < 2 || e.target.closest('#toolbar')) return;
    e.preventDefault();
    const d = (Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 400 : 1);
    if (e.timeStamp - wheel.at > 250) wheel = { at: 0, sum: 0, done: false }; // a new flick
    wheel.at = e.timeStamp; wheel.sum += d;
    if (!wheel.done && Math.abs(wheel.sum) >= 30) { wheel.done = true; turn(page + Math.sign(wheel.sum)); }
  }, { passive: false });
  // a swipe or a drag on the page turns it (left or up for the next page); it never picks the colour under it
  let drag = null, dragged = false;
  swatches.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary || e.button !== 0) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    dragged = false;
  });
  addEventListener('pointermove', (e) => {
    if (drag && e.pointerId === drag.id && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 10) dragged = true;
  });
  const drop = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y, d = Math.abs(dx) > Math.abs(dy) ? dx : dy;
    if (dragged && e.type === 'pointerup' && Math.abs(d) > 24) turn(page + (d < 0 ? 1 : -1));
    drag = null;
  };
  addEventListener('pointerup', drop);
  addEventListener('pointercancel', drop);
  swatches.addEventListener('click', (e) => { if (dragged) { e.stopPropagation(); e.preventDefault(); dragged = false; } }, true);
  // the counter changed shape (a turn, a tall counter): fit the page again, keeping the picked colour on it
  let shape = '';
  new ResizeObserver(() => {
    fitPage();
    const now = `${root.className}:${perPage}`;
    if (now === shape) return; // (browsing the pages never moves you back)
    shape = now;
    const s = session.state, at = list.findIndex((c) => c.id === s.selection.colour[s.selection.tool]);
    if (at >= 0) page = Math.floor(at / perPage);
    showPage();
  }).observe($('create'));

  // ---- the next customer's picture (a small second view that only draws faces) ----
  const thumbs = new Map(); // seed -> a copy of the render (a few at a time)
  let side = null;
  const thumb = (face) => {
    if (thumbs.has(face.seed)) return thumbs.get(face.seed);
    if (!side) {
      side = new FaceView({ canvas: document.createElement('canvas'), width: 168, height: 168, pixelRatio: Math.min(devicePixelRatio, 2), transparent: true, makeup: false });
      revive(side.renderer, () => {}); // (each thumbnail is drawn afresh)
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

  // ---- the colour of the day: the gift (owner's choice, 20 October 2026) ----
  // A gift box tied in today's colour; the product only on the button (one video for this colour). The clock ticks
  // every second until the box is opened. After the video: a shake, the lid flies off, the colour rises out in a
  // flash with confetti over the whole screen and the unwrap sound; the clock stops, and the button becomes an arrow
  // back to the game, the colour already selected in its tray.
  const daily = $('daily'), panel = $('panel'), card = panel.querySelector('.card'), confetti = panel.querySelector('.burst');
  daily.innerHTML = `${ICON.gift}<span class="dot" hidden></span>`;
  card.querySelector('.x').innerHTML = ICON.close;
  let panelTimer = 0, beat = 0, revealing = false;
  const art = card.querySelector('.art'), get = card.querySelector('.get'), time = card.querySelector('.time');
  const renderPanel = () => {
    const s = session.state, pick = s.pick, c = pick && colourById(pick.colour), owned = !!c && s.owned.includes(c.id);
    const t = timeLeft(), won = owned && !revealing;
    if (art.dataset.colour !== c?.id) {
      art.dataset.colour = c?.id || '';
      card.style.setProperty('--ribbon', c?.hex || '#ff7aa8');
      art.innerHTML = `<div class="rays"></div><div class="box"><div class="base"></div><div class="seep"></div><div class="lid"><div class="bow"><i></i></div></div><div class="prize">${c ? productShot(c) : ''}</div></div><span class="forever">${ICON.forever}</span>`;
    }
    // an opened box stays open (also when the card is opened again later the same day)
    // (not while it is being revealed: the shake, then the lid flies off)
    card.classList.toggle('rest', owned && !revealing && !card.classList.contains('unwrap'));
    const live = !!c && !owned;
    for (const l of ['g', 'o', 'r']) { card.classList.toggle(l, live && t.level === l); time.classList.toggle(l, live && t.level === l); }
    card.classList.toggle('last', live && t.last);
    art.setAttribute('aria-label', c ? `A gift: ${TOOL_NAME[c.target]} in ${c.name}, yours for good` : 'You have every colour');
    get.hidden = !c;
    get.disabled = session.busy || revealing;
    get.classList.toggle('owned', won);
    const face = won ? 'next' : `buy:${c?.id}`;
    if (get.dataset.face !== face) {
      get.dataset.face = face;
      get.innerHTML = won ? ICON.next : `<span class="vb">${ICON.video}</span>${ICON.next}<span class="prz">${c ? productShot(c) : ''}</span>`;
    }
    get.setAttribute('aria-label', won ? 'Continue: the colour is ready to use' : `Watch one video to keep ${c ? `${TOOL_NAME[c.target]} in ${c.name}` : 'this colour'} for good`);
    // the clock: only while the colour waits (it stops once the box is opened, and stays away after)
    time.hidden = !c || (owned && !revealing && !card.classList.contains('unwrap'));
    if (live) {
      time.innerHTML = `${ICON.watch} ${t.text}`;
      time.querySelector('.hand').style.transform = `rotate(${(beat % 60) * 6}deg)`;
      time.setAttribute('aria-label', `Ends in ${t.text}`);
    }
  };
  // every second while the colour waits: the tag swings, the hand moves, the clock ticks and tocks
  const clockTick = () => {
    if (paused || revealing) return; // (midnight never swaps the colour in the box as it is revealed)
    session.refreshDaily();
    const s = session.state, live = !!s.pick && !s.owned.includes(s.pick.colour) && !revealing;
    if (live) { beat++; time.classList.toggle('tick', beat % 2 === 1); time.classList.toggle('tock', beat % 2 === 0); ui(beat % 2 ? 'tick' : 'tock'); }
    else time.classList.remove('tick', 'tock');
    renderPanel(); // midnight brings the next colour
  };
  // the card: designed at 290 × 400 and scaled as one piece, at the UI scale, shrunk only to keep 16 px clear of
  // every edge of the safe area; the panel centres it there
  const CARD = [290, 400], EDGE = 16;
  const fitCard = () => {
    if (!panelOpen) return;
    const cs = getComputedStyle(panel), s = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--s')) || 1;
    const w = panel.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), h = panel.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    card.style.zoom = Math.min(s, (w - 2 * EDGE) / CARD[0], (h - 2 * EDGE) / CARD[1]).toFixed(4);
  };
  addEventListener('resize', fitCard);
  const openPanel = () => {
    if (finishing) return; // a finished look is on its way to review (its Finish must not be lost)
    input.interrupt();
    ui('panel');
    session.refreshDaily(); session.openedDaily();
    card.classList.remove('unwrap', 'shake');
    confetti.replaceChildren();
    panelOpen = true; panel.hidden = false;
    beat = 0; time.classList.remove('tick', 'tock');
    renderPanel();
    fitCard();
    clearInterval(panelTimer);
    panelTimer = setInterval(clockTick, 1000);
    get.focus();
  };
  // (once the last colour is earned the daily button goes away: focus moves to Done)
  const closePanel = () => {
    if (revealing) return;
    panelOpen = false; panel.hidden = true; clearInterval(panelTimer);
    card.classList.remove('unwrap', 'shake'); confetti.replaceChildren();
    render(); (daily.hidden ? $('done') : daily).focus();
  };
  // confetti in today's colour, gold and pink, from the box over the whole screen, after a flash
  const celebrate = () => {
    const r = card.querySelector('.box').getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height * 0.3, W = innerWidth, H = innerHeight;
    const c = colourById(session.state.pick?.colour), cols = [c?.hex || '#ff7aa8', '#ffd23f', '#ff7aa8', '#fff6e6', '#5ccf72', '#e7b85a', c?.hex || '#c8122c'];
    const bits = [document.createElement('b')];
    for (let k = 0; k < 80; k++) {
      const i = document.createElement('i'), a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.6, d = (0.35 + Math.random() * 0.6) * Math.max(W, H) * 0.6;
      i.style.cssText = `--x:${x}px;--y:${y}px;--s:${7 + Math.random() * 9}px;--c:${cols[k % cols.length]};--r:${k % 3 ? '3px' : '50%'};--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d + H * 0.45}px;--rot:${Math.random() * 720}deg;--t:${1.2 + Math.random() * 0.9}s`;
      bits.push(i);
    }
    confetti.replaceChildren(...bits);
    setTimeout(() => confetti.replaceChildren(), 2400);
  };
  daily.onclick = openPanel;
  card.querySelector('.x').onclick = closePanel;
  panel.addEventListener('click', (e) => { if (e.target === panel) closePanel(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && panelOpen && !paused) closePanel(); });
  get.onclick = async () => {
    if (session.state.owned.includes(session.state.pick?.colour)) { closePanel(); return; } // continue: it is selected
    const p = session.reward('daily');
    renderPanel();
    if (await p) {
      // the reveal: shake, the lid off, the colour up, the flash and confetti; then the arrow
      revealing = true; time.classList.remove('tick', 'tock'); renderPanel();
      card.classList.add('shake'); ui('unwrap');
      setTimeout(() => { card.classList.remove('shake'); card.classList.add('unwrap'); celebrate(); }, 420);
      setTimeout(() => { revealing = false; renderPanel(); get.focus(); }, 1500); // (the stopped clock has gone)
    } else nope(get);
    render();
  };

  // ---- the screen follows the state ----
  function render() {
    const s = session.state, review = s.attempt.phase === 'review';
    if (review) aim(null); // the tool is put down for review
    document.body.classList.toggle('review', review);
    $('create').hidden = review;
    $('review').hidden = !review;
    if (review) { const slot = $('next').querySelector('.pic'), pic = thumb(s.next); if (slot.firstChild !== pic) slot.replaceChildren(pic); }
    $('redo').hidden = !host.rewardedSupported;
    for (const b of [$('next'), $('redo'), $('done')]) b.disabled = session.busy;
    for (const b of toolbar.children) b.setAttribute('aria-pressed', String(b.dataset.tool === s.selection.tool));
    renderSwatches();
    readyTool();
    // no rewarded videos here, or every colour already earned: nothing to offer, no daily button
    if (!panelOpen) daily.hidden = !session.dailyOffered;
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

  // the canvas fills the stage (window size, orientation, bars), at the screen's current pixel density (browser zoom,
  // or the window moved to another screen, so the face stays as sharp as the tool in hand)
  const refit = () => {
    const [w, h] = fit(), dpr = Math.min(devicePixelRatio, 2);
    if (w !== W || h !== H || dpr !== view.renderer.pixelRatio) {
      input.interrupt(); // a resize ends the stroke; its applied part is kept
      [W, H] = [w, h];
      view.renderer.setPixelRatio(dpr);
      view.setSize(W, H);
      canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
      redraw();
    }
    placeMirror(); // the canvas may also have moved
    tallCounter();
    placeRedo();
  };
  new ResizeObserver(refit).observe(stage);
  // a change of density alone (no change of size) is heard from a media query for the current one
  const density = () => matchMedia(`(resolution: ${devicePixelRatio}dppx)`).addEventListener('change', () => { refit(); density(); }, { once: true });
  density();

  // ---- ready ----
  session.refreshDaily();
  sync();
  render();
  view.render();
  placeMirror();
  // the compact completes and the cover fades over the game, which can be played at once
  loading(1, true);
  const cover = $('cover');
  cover.classList.add('done');
  setTimeout(() => { cover.hidden = true; }, 300);
  prepare();
  await host.gameReady();
  Object.assign(globalThis, { game: { session, view, host, input, sounds, logUnits, glow, mouth, zoneAt, regionsAt, lean } }); // for tests and debugging
}

main().catch((e) => fail('START', e));
