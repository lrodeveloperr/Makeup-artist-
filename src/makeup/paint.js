// Painted makeup on the skin. Dabs are drawn into two textures laid out like the head's UV map: colour
// (premultiplied, read by the skin shader as uPaint) and finish (gloss, shimmer, glow; uFinish). Each dab is rendered
// by drawing the head in texture space and measuring every texel's distance to the dab in the reference-head
// frame, so a dab is round on the face and continues across UV seams. Each new dab is laid "over" what is
// there, so application order matters and repeated passes build towards the full colour without exceeding it.
import * as GL from '../gl/mini.js';
import { TOOLS, FALLOFF_GLSL, walkerFor, dabRate } from './tools.js';
import { colourById } from './palette.js';
import { fromQ } from './makeup.js';
import { hexToLinear } from '../face/colors.js';

const BATCH = 32; // dabs per draw

const vertexShader = /* glsl */ `
attribute vec3 ref;
varying vec3 vRef;
void main() {
  vRef = ref;
  gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
}`;

const fragmentShader = /* glsl */ `
${FALLOFF_GLSL}
uniform vec4 uDabs[${BATCH}];  // xyz: centre; w: size (a factor of the radius)
uniform int uCount, uLayer;   // layer 0: colour, 1: finish
uniform float uRadius, uEdge, uRate;
uniform vec3 uColour;
uniform vec3 uFinish;         // gloss, shimmer, glow
varying vec3 vRef;
void main() {
  // the dabs of one batch share a colour, so their combined coverage does not depend on their order
  float keep = 1.0;
  for (int i = 0; i < ${BATCH}; i++) {
    if (i >= uCount) break;
    keep *= 1.0 - uRate * dabFalloff(uEdge, distance(vRef, uDabs[i].xyz) / (uRadius * uDabs[i].w));
  }
  float a = 1.0 - keep;
  if (a <= 0.0) discard;
  gl_FragColor = uLayer == 0 ? vec4(uColour * a, a) : vec4(uFinish * a, a);
}`;

export class PaintLayer {
  constructor(renderer, headGeometry, size = 1024) {
    this.renderer = renderer;
    // half-float where the device can render to it, so many light dabs build up smoothly and replaying a saved
    // stroke in bigger batches gives the same result as painting it live (8-bit rounds every draw)
    this.colour = new GL.RenderTarget(size, size, { float: true });
    this.finish = new GL.RenderTarget(size, size, { float: true });
    this.dabs = Array.from({ length: BATCH }, () => new GL.Vector4());
    this.material = new GL.ShaderMaterial({
      vertexShader, fragmentShader,
      uniforms: {
        uDabs: { value: this.dabs }, uCount: { value: 0 }, uLayer: { value: 0 },
        uRadius: { value: 1 }, uEdge: { value: 0 }, uRate: { value: 0 },
        uColour: { value: new GL.Vector3() }, uFinish: { value: new GL.Vector3() },
      },
    });
    this.mesh = new GL.Mesh(headGeometry.geometry, this.material);
    this.clear();
  }

  clear() {
    this.renderer.drawToTarget(this.colour, null, { clear: true });
    this.renderer.drawToTarget(this.finish, null, { clear: true });
  }

  // dabs: [[x, y, z, size?], ...] in the reference-head frame, all with one tool and colour
  draw(tool, colourId, dabs) {
    if (!dabs.length) return;
    const t = TOOLS[tool], col = colourById(colourId), u = this.material.uniforms;
    // a sheer product (clear gloss, highlighter) is light in pigment but not in shine
    const rate = [dabRate(tool, col.sheer ?? 1), dabRate(tool)];
    u.uRadius.value = t.radius; u.uEdge.value = t.edge;
    u.uColour.value.set(...hexToLinear(col.hex));
    u.uFinish.value.set(col.gloss || 0, col.shimmer || 0, col.glow || 0);
    for (let i = 0; i < dabs.length; i += BATCH) {
      const n = Math.min(BATCH, dabs.length - i);
      for (let k = 0; k < n; k++) this.dabs[k].set(dabs[i + k][0], dabs[i + k][1], dabs[i + k][2], dabs[i + k][3] ?? 1);
      u.uCount.value = n;
      u.uLayer.value = 0; u.uRate.value = rate[0]; this.renderer.drawToTarget(this.colour, this.mesh);
      u.uLayer.value = 1; u.uRate.value = rate[1]; this.renderer.drawToTarget(this.finish, this.mesh);
    }
  }
}

// Feeds a skin stroke's saved points through a DabWalker and draws the dabs. Live painting and replay both use
// it, so they produce the same dabs.
export class StrokePainter {
  constructor(layer, tool, colour) { Object.assign(this, { layer, tool, colour }); this.walker = walkerFor(tool); }
  // q: integer point [x, y, z] (see makeup.js); true if anything was drawn
  add(q) { return this.draw(this.walker.add([fromQ(q[0]), fromQ(q[1]), fromQ(q[2])])); }
  // the end of a segment (the liner draws its tip now)
  lift() { return this.draw(this.walker.lift()); }
  draw(dabs) { this.layer.draw(this.tool, this.colour, dabs); return dabs.length > 0; }
  // a whole saved stroke at once (dabs drawn in batches)
  static replay(layer, stroke) {
    const walker = walkerFor(stroke.tool), dabs = [];
    for (const seg of stroke.segments) {
      for (let i = 0; i < seg.length; i += 3) dabs.push(...walker.add([fromQ(seg[i]), fromQ(seg[i + 1]), fromQ(seg[i + 2])]));
      dabs.push(...walker.lift());
    }
    layer.draw(stroke.tool, stroke.colour, dabs);
  }
}
