// Applies makeup to the face on screen: turns pointer samples into strokes (contract §2 input rules), paints
// them live, records them in the makeup state, and rebuilds the look from a saved state.
//
//   const g = applicator.begin('brush', 'brush-rose');  // tool and colour are fixed for the whole gesture
//   applicator.move(g, x, y) ...                          // canvas CSS pixels; fast moves are interpolated
//   applicator.end(g);                                    // pointer-up, cancel or lost capture: keeps valid work
//   applicator.tapLens(x, y, 'lens-green');               // sets that iris if the tap is on one
//   applicator.tapGem(x, y, 'gem-crystal');               // sticks a gem on the skin there
import { PaintLayer, StrokePainter } from './paint.js';
import { Gems } from './gems.js';
import { Picker } from './picker.js';
import { createMakeup, addStroke, setLens, validMakeup, pointCount, toQ, fromQ, LIMITS, Q } from './makeup.js';
import { TOOLS, SURFACE_TOOLS } from './tools.js';
import { colourById } from './palette.js';
import { hexToLinear, IRIS } from '../face/colors.js';

const STEP_PX = 2; // interpolation step between pointer samples (CSS pixels)
const LID_TOOLS = new Set(['liner', 'pencil']); // fine lines drawn along the lashes

export class Applicator {
  // view: FaceView (renderer, head geometry, eyes, lashes, camera)
  constructor(view) {
    this.view = view;
    this.paint = new PaintLayer(view.renderer, view.headGeometry);
    this.picker = new Picker();
    this.gems = new Gems(view.headGeometry);
    view.scene.add(this.gems.mesh);
    this.makeup = createMakeup();
    this.allowed = () => true; // the game sets which colours the player may use (colours of the day once earned)
  }

  // a new face (or the same face's clean start): no makeup, natural lashes and irises
  reset(profile) {
    this.profile = profile;
    this.makeup = createMakeup();
    this.paint.clear();
    this.gems.set([]);
    this.view.lashes.resetCoats();
    this.applyLenses();
    this.layout();
  }

  // rebuild the look from a saved makeup state for the current face; false if the state is invalid
  restore(makeup) {
    if (!validMakeup(makeup)) return false;
    this.makeup = makeup;
    this.paint.clear();
    this.view.lashes.resetCoats();
    for (const s of makeup.strokes) {
      if (SURFACE_TOOLS.has(s.tool)) StrokePainter.replay(this.paint, s);
      else if (s.tool === 'gem') continue; // placed together below
      else {
        const touched = new Set(), colour = hexToLinear(colourById(s.colour).hex);
        for (const seg of s.segments) this.view.lashes.coat(seg.map(fromQ), colour, TOOLS.mascara, touched);
      }
    }
    this.placeGems();
    this.applyLenses();
    return true;
  }

  // the gems of the current look, on the current face
  placeGems() {
    this.gems.set(this.makeup.strokes.filter((s) => s.tool === 'gem').map((s) => ({ ref: s.segments[0].map(fromQ), colour: colourById(s.colour) })));
  }

  // recompute picking after a face, size or camera change
  layout() {
    const v = this.view, size = v.cssSize;
    this.picker.update(v.headGeometry, v.eyes, v.camera, size[0], size[1]);
  }

  applyLenses() {
    const natural = IRIS[this.profile.eyes.iris];
    const stops = (eye) => colourById(this.makeup.lenses[eye])?.iris || natural;
    this.view.eyes.setIris(stops('left'), stops('right'), this.profile.eyes.seed);
  }

  // ---- gestures ----
  begin(tool, colour) {
    if (!(SURFACE_TOOLS.has(tool) || tool === 'mascara') || colourById(colour)?.target !== tool || !this.allowed(colour)) return null;
    const room = Math.min(LIMITS.pointsPerStroke, LIMITS.points - pointCount(this.makeup));
    if (room <= 0 || this.makeup.strokes.length >= LIMITS.strokes) return null; // the state is full
    return {
      tool, colour, segments: [], seg: null, points: 0, room, xy: null, lastQ: null, pending: null, touched: new Set(),
      step: TOOLS[tool].step * Q,
      painter: SURFACE_TOOLS.has(tool) ? new StrokePainter(this.paint, tool, colour) : null,
      linear: hexToLinear(colourById(colour).hex),
    };
  }

  // a pointer sample; returns true if the face changed (needs a redraw)
  move(g, x, y) {
    if (!g || !Number.isFinite(x) || !Number.isFinite(y)) return false;
    let changed = false;
    if (!g.xy) changed = this.sample(g, x, y);
    else {
      const [px, py] = g.xy, n = Math.max(1, Math.ceil(Math.hypot(x - px, y - py) / STEP_PX));
      for (let k = 1; k <= n; k++) changed = this.sample(g, px + ((x - px) * k) / n, py + ((y - py) * k) / n) || changed;
    }
    g.xy = [x, y];
    return changed;
  }

  // A pointer sample. A point is stored (and painted) once the pointer is the tool's step away from the last
  // one; the latest sample waits until then, or until the pen lifts, so the stroke still ends where it did.
  sample(g, x, y) {
    let q = null;
    if (g.painter) {
      // the eyeball, skin under the outfit and empty space never take paint; the liner and the pencil, traced along
      // the lashes, keep to the lid's edge where the pointer slips just onto the eye
      let hit = this.picker.pick(x, y);
      if (hit?.kind === 'eye' && LID_TOOLS.has(g.tool)) hit = this.picker.lidNear(x, y, hit.eye);
      if (hit?.kind === 'skin' && !this.view.garment?.covers(hit.ref)) q = hit.ref.map(toQ);
    } else {
      const p = this.picker.onPlane(x, y, this.view.lashes.zPlane);
      if (p) q = p.map(toQ);
    }
    if (!q) { g.onLash = false; return this.lift(g); } // pen up until the pointer is back on the face
    if (!g.seg) {
      if (g.segments.length >= LIMITS.segments || g.points >= g.room) return false;
      g.seg = []; g.segments.push(g.seg);
      return this.store(g, q);
    }
    g.pending = q;
    return Math.hypot(...q.map((v, i) => v - g.lastQ[i])) >= g.step && this.store(g, q);
  }

  store(g, q) {
    g.pending = null;
    if (g.lastQ && q.every((v, i) => v === g.lastQ[i])) return false;
    if (g.points >= g.room) return false;
    const prev = g.lastQ;
    g.seg.push(...q); g.points++; g.lastQ = q;
    if (g.painter) { g.painter.add(q); return true; }
    const wand = prev ? [...prev, ...q].map(fromQ) : q.map(fromQ);
    g.onLash = this.view.lashes.touches(wand, TOOLS.mascara.reach);
    return this.view.lashes.coat(wand, g.linear, TOOLS.mascara, g.touched);
  }

  // end the current segment at the last sample on the face (the liner draws its tip)
  lift(g) {
    if (!g.seg) return false;
    let changed = g.pending ? this.store(g, g.pending) : false;
    if (g.painter) changed = g.painter.lift() || changed;
    g.seg = null; g.lastQ = null;
    return changed;
  }

  // Commit the gesture's valid work (pointer-up, cancel, lost capture, pause); returns the stored stroke or
  // null. The last part of the path may be painted now, so the face needs a redraw after a stroke is returned.
  end(g) {
    if (!g) return null;
    this.lift(g);
    if (!g.segments.length || (!g.painter && !g.touched.size)) return null; // a wand that missed every lash is no work
    const stroke = { tool: g.tool, colour: g.colour, segments: g.segments };
    const before = this.makeup;
    this.makeup = addStroke(this.makeup, stroke);
    return this.makeup === before ? null : this.makeup.strokes[this.makeup.strokes.length - 1];
  }

  // face gems: a tap on the skin sticks one there (not on the outfit, the eyes or empty space); returns the stored
  // stroke or null
  tapGem(x, y, colour) {
    if (colourById(colour)?.target !== 'gem' || !this.allowed(colour)) return null;
    const hit = this.picker.pick(x, y);
    if (hit?.kind !== 'skin' || this.view.garment?.covers(hit.ref)) return null;
    const q = hit.ref.map(toQ);
    if (!this.gems.locate(q.map(fromQ))) return null;
    const before = this.makeup;
    this.makeup = addStroke(this.makeup, { tool: 'gem', colour, segments: [q] });
    if (this.makeup === before) return null; // the face is full of gems
    this.placeGems();
    return this.makeup.strokes[this.makeup.strokes.length - 1];
  }

  // contact lenses: a tap on an iris sets that eye; anything else does nothing
  tapLens(x, y, colour) {
    if (!this.allowed(colour)) return false;
    const hit = this.picker.pick(x, y);
    if (hit?.kind !== 'eye' || !hit.iris) return false;
    const next = setLens(this.makeup, hit.eye, colour);
    if (next === this.makeup) return false;
    this.makeup = next;
    this.applyLenses();
    return true;
  }
}
