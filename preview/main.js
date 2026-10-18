// Face preview: generated faces with Next / seed controls and a contact-sheet mode for review.
import { FaceView } from '../src/face/face-view.js';
import { generateFace } from '../src/face/generator.js';

const q = new URLSearchParams(location.search);
const sheet = q.has('sheet');
const W = +(q.get('w') || (sheet ? 300 : innerWidth)), H = +(q.get('h') || (sheet ? 400 : innerHeight));
const canvas = document.createElement('canvas');
canvas.width = W; canvas.height = H;
const view = await FaceView.load('head.bin', { canvas, width: W, height: H });
if (q.has('zoom')) view.zoom(+q.get('zoom'), +(q.get('zy') || 0), +(q.get('zx') || 0));

if (sheet) {
  // render N faces into a grid of images
  const start = +(q.get('seed') || 1), count = +(q.get('n') || 12), cols = +(q.get('cols') || 4);
  const grid = document.createElement('div');
  grid.style.cssText = `display:grid;grid-template-columns:repeat(${cols},${W}px);gap:0`;
  document.body.appendChild(grid);
  for (let i = 0; i < count; i++) {
    const face = generateFace(start + i);
    view.setFace(face);
    view.render();
    const fig = document.createElement('figure');
    fig.style.cssText = 'margin:0;position:relative';
    const img = new Image();
    img.src = canvas.toDataURL();
    await img.decode();
    const cap = document.createElement('figcaption');
    cap.style.cssText = 'position:absolute;left:4px;bottom:2px;font:10px sans-serif;color:#fff;text-shadow:0 0 2px #000';
    cap.textContent = q.has('label') ? `#${face.seed} ${face.origin.parts.map((p) => p.id + ' ' + p.weight).join(' + ')} · ${face.hair.style} · ${face.presentation}` : '';
    fig.append(img, cap);
    grid.appendChild(fig);
  }
} else {
  document.body.appendChild(canvas);
  let seed = +(q.get('seed') || 1);
  const show = () => { const face = generateFace(seed); view.setFace(face); view.render(); window.face = face; };
  addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') { seed++; show(); } if (e.key === 'ArrowLeft') { seed--; show(); } });
  canvas.addEventListener('click', () => { seed++; show(); });
  show();
}
window.done = true;
