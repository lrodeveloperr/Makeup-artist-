// Developer preview of generated faces (not the game UI). Shows the queue's faces one by one with the makeup
// tools to try on them, or a contact sheet with ?sheet. Origin labels are internal data shown here for review
// only; the game never shows them.
//   ?seed=N        start the queue / sheet at N
//   ?sheet&n=16    contact sheet of N faces (&cols, &w, &h, &label; &label=heritage for the heritage only;
//                  &seeds=a,b,c for chosen seeds)
//   ?style=a,b     force hairstyles (debugging), &texture=coily
//   ?zoom=k&zx&zy, ?orbit=rad, ?nohair, ?nogarment, ?scalp   debugging views
import { FaceView } from '../src/face/face-view.js';
import { generateFace } from '../src/face/generator.js';
import { createQueueState, nextFace } from '../src/face/queue.js';
import { attachInput } from '../src/makeup/input.js';
import { PALETTE, DEFAULT_SELECTION } from '../src/makeup/palette.js';

const q = new URLSearchParams(location.search);
const sheet = q.has('sheet');
const ui = document.getElementById('ui'), tools = document.getElementById('tools');
if (sheet) tools?.remove();
const stage = document.getElementById('stage');
const fit = () => [Math.min(stage.clientWidth, 720), stage.clientHeight];
let [W, H] = sheet ? [+(q.get('w') || 300), +(q.get('h') || 400)] : q.has('w') ? [+q.get('w'), +q.get('h')] : fit();
const canvas = document.createElement('canvas');
canvas.width = W; canvas.height = H;
canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
const view = await FaceView.load('head.bin.gz', { canvas, width: W, height: H, pixelRatio: sheet ? 1 : Math.min(devicePixelRatio, 2) });
if (q.has('scalp')) { view.debugScalp = true; view.hair.group.visible = false; }
if (q.has('nohair')) view.hair.group.visible = false;
if (q.has('nogarment')) view.hideGarment = true;
if (q.has('orbit')) view.orbit(+q.get('orbit'));
if (q.has('zoom')) view.zoom(+q.get('zoom'), +(q.get('zy') || 0), +(q.get('zx') || 0));

const styles = q.get('style')?.split(',');
const sets = (q.get('set') || '').split(',').filter(Boolean).map((kv) => kv.split(':'));
function override(face, i) {
  if (q.has('neutral')) face.shape = {};
  for (const [k, v] of sets) face.shape[k] = (face.shape[k] || 0) + +v;
  if (styles) {
    face.hair.style = styles[i % styles.length];
    if (q.get('texture')) face.hair.texture = q.get('texture');
  }
  return face;
}
// heritage as a readable name: a single profile, or a named blend with its parts
const pretty = (id) => id.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')
  .replace('North African Middle Eastern', 'North African / Middle Eastern').replace('Southern Central African', 'Southern / Central African')
  .replace('Asian European', 'Asian × European').replace('Arab African', 'Arab × East African');
const heritage = (f) => (f.origin.kind === 'blend' ? `${pretty(f.origin.blend)} (blend)` : pretty(f.origin.parts[0].id));
const describe = (f) => `#${f.seed} · ${f.origin.parts.map((p) => `${p.id}${p.weight < 1 ? ' ' + Math.round(p.weight * 100) + '%' : ''}`).join(' + ')} · ${f.presentation}, ${f.age} · ${f.hair.style} (${f.hair.texture}, ${f.hair.colour}) · ${f.eyes.iris} eyes${f.skin.freckles.density ? ' · freckles' : ''} · ${f.outfit.names.join('/')} ${f.outfit.pattern} ${f.outfit.kind} (${f.outfit.neckline})`;

if (sheet) {
  ui?.remove();
  const seeds = q.get('seeds')?.split(',').map(Number);
  const start = +(q.get('seed') || 1), count = seeds ? seeds.length : +(q.get('n') || 12), cols = +(q.get('cols') || 4);
  const grid = document.createElement('div');
  grid.style.cssText = `display:grid;grid-template-columns:repeat(${cols},${W}px)`;
  document.body.appendChild(grid);
  let state = createQueueState(start);
  for (let i = 0; i < count; i++) {
    let face;
    if (seeds) face = generateFace(seeds[i]);
    else if (q.has('queue')) ({ face, state } = nextFace(state));
    else face = generateFace(start + i);
    view.setFace(override(face, i));
    view.render();
    const fig = document.createElement('figure');
    fig.style.cssText = 'margin:0;position:relative';
    const img = new Image();
    img.src = canvas.toDataURL('image/jpeg', 0.9);
    await img.decode();
    fig.appendChild(img);
    if (q.has('label')) {
      const cap = document.createElement('figcaption');
      cap.style.cssText = q.get('label') === 'heritage'
        ? 'position:absolute;left:0;right:0;top:0;padding:4px 6px;font:600 13px system-ui,sans-serif;color:#fff;background:rgba(0,0,0,.45)'
        : 'position:absolute;left:4px;right:4px;bottom:2px;font:10px system-ui,sans-serif;color:#fff;text-shadow:0 0 3px #000';
      cap.textContent = q.get('label') === 'heritage' ? heritage(face) : describe(face);
      fig.appendChild(cap);
    }
    grid.appendChild(fig);
  }
} else {
  stage.appendChild(canvas);
  const info = document.getElementById('info');
  // queue history so Back works; Next always draws from the variety director
  const history = [];
  let state = createQueueState(+(q.get('seed') || 1)), index = -1;
  const show = () => {
    const face = override(history[index], index);
    const t0 = performance.now();
    view.setFace(face);
    const t1 = performance.now();
    view.render();
    info.textContent = `${describe(face)} — built in ${Math.round(t1 - t0)} ms`;
    window.face = face;
  };
  const next = () => {
    if (index === history.length - 1) { const r = nextFace(state); state = r.state; history.push(r.face); }
    index++; show();
  };
  const back = () => { if (index > 0) { index--; show(); } };
  document.getElementById('next').onclick = next;
  document.getElementById('back').onclick = back;
  addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') next(); if (e.key === 'ArrowLeft') back(); });

  // ---- makeup tools: seven tools and the lens selector, each with its own colours ----
  const selection = { tool: DEFAULT_SELECTION.tool, colour: { ...DEFAULT_SELECTION.colour } };
  const TOOLS = [
    ['brush', 'Brush', 'M5 21c3 0 5-2 5-5l1-1 2 2-1 1c-3 0-5 2-7 3zM11 15l7-11 2 2-7 11'],
    ['glow', 'Highlighter', 'M4.5 10A8 8 0 0 1 19.5 10L12 15.5zM12 15.5v6M12 15.5L8.6 4.8M12 15.5l3.4-10.7M20 1.5v3M18.5 3h3'],
    ['pencil', 'Pencil', 'M4 20l1-4L16 5l3 3L8 19zM14 7l3 3'],
    ['liner', 'Liner', 'M2.5 15q8 3.5 16-2.5l3-4-6.5 2.5M16.5 2.5l2.5 2.5-7 7-3 .5.5-3z'],
    ['mascara', 'Mascara', 'M4 20L15 9M13 5l6 6M15 4l5 5M11 7l6 6M12 4l1 2M18 10l2 1'],
    ['lip', 'Lips', 'M9 21h6v-8H9zM10 13V7l4-3v9'],
    ['gem', 'Gems', 'M6.5 4h11l4 5.5L12 21 2.5 9.5zM2.5 9.5h19M8 9.5l4 11.5 4-11.5M9 4l3 5.5L15 4'],
    ['lens', 'Lenses', 'M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6'],
  ];
  const bar = document.getElementById('toolbar'), swatches = document.getElementById('swatches');
  const swatchBackground = (c) => (c.gloss ? `radial-gradient(circle at 35% 30%, #fffc 0 14%, #fff0 32%), ${c.hex}`
    : c.shimmer ? `radial-gradient(circle at 30% 30%, #fffb 0 7%, #fff0 16%), radial-gradient(circle at 66% 62%, #fff9 0 5%, #fff0 13%), ${c.hex}` : c.hex);
  const showSwatches = () => {
    swatches.replaceChildren(...PALETTE[selection.tool].map((c) => {
      const b = document.createElement('button');
      b.style.background = swatchBackground(c);
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-label', c.name);
      b.setAttribute('aria-checked', String(selection.colour[selection.tool] === c.id));
      b.onclick = () => { selection.colour[selection.tool] = c.id; showSwatches(); };
      return b;
    }));
  };
  for (const [id, label, path] of TOOLS) {
    const b = document.createElement('button');
    b.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>${label}`;
    b.setAttribute('aria-pressed', String(id === selection.tool));
    b.onclick = () => {
      selection.tool = id;
      for (const x of bar.children) x.setAttribute('aria-pressed', String(x === b));
      showSwatches();
    };
    bar.appendChild(b);
  }
  showSwatches();
  let frame = 0;
  const redraw = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; view.render(); }); };
  const input = attachInput(canvas, view.makeup, {
    selection: () => ({ tool: selection.tool, colour: selection.colour[selection.tool] }),
    onChange: redraw,
    onCommit: () => { info.textContent = `${describe(window.face)} — ${view.makeup.makeup.strokes.length} strokes`; },
  });
  window.input = input;
  // the canvas fills the stage, which changes size with the window and when the info line wraps differently
  // (unless ?w&h fix the size)
  if (!q.has('w')) new ResizeObserver(() => {
    const [w, h] = fit();
    if (w === W && h === H) return;
    input.interrupt(); // a resize ends the current stroke (its valid part is kept)
    [W, H] = [w, h]; view.setSize(W, H);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    view.render();
  }).observe(stage);
  next();
}
window.view = view;
window.done = true;
