// Developer preview of generated faces (not the game UI). Shows the queue's faces one by one, or a contact
// sheet with ?sheet. Origin labels are internal data shown here for review only; the game never shows them.
//   ?seed=N        start the queue / sheet at N
//   ?sheet&n=16    contact sheet of N faces (&cols, &w, &h, &label; &label=heritage for the heritage only;
//                  &seeds=a,b,c for chosen seeds)
//   ?style=a,b     force hairstyles (debugging), &texture=coily
//   ?zoom=k&zx&zy, ?orbit=rad, ?nohair, ?nogarment, ?scalp   debugging views
import { FaceView } from '../src/face/face-view.js';
import { generateFace } from '../src/face/generator.js';
import { createQueueState, nextFace } from '../src/face/queue.js';

const q = new URLSearchParams(location.search);
const sheet = q.has('sheet');
const ui = document.getElementById('ui');
const fit = () => [Math.min(innerWidth, 720), innerHeight - (ui ? ui.offsetHeight : 0)];
let [W, H] = sheet ? [+(q.get('w') || 300), +(q.get('h') || 400)] : q.has('w') ? [+q.get('w'), +q.get('h')] : fit();
const canvas = document.createElement('canvas');
canvas.width = W; canvas.height = H;
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
  document.getElementById('stage').appendChild(canvas);
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
  addEventListener('resize', () => { [W, H] = fit(); view.setSize(W, H); view.render(); });
  next();
}
window.view = view;
window.done = true;
