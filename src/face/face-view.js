// Renders one generated face: head surface, eyes, brows, lashes and hair, with a fixed front camera.
import * as GL from '../gl/mini.js';
import { loadHead } from './head-data.js';
import { HeadGeometry } from './head-geometry.js';
import { createSkinMaterial, setMouthLandmarks } from './skin-material.js';
import { Eyes } from './eyes.js';
import { Brows, BROW_SHAPES } from './brows.js';
import { Lashes } from './lashes.js';
import { SurfaceSampler } from './surface.js';
import { Hair } from './hair.js';
import { Garment, setNeckUniforms } from './garment.js';
import { Applicator } from '../makeup/applicator.js';
import { skinAlbedo, lipColours, IRIS, HAIR_COLOURS } from './colors.js';
import { createRng } from './rng.js';

// fixed front camera: the face large for painting, with the neckline and upper chest in view so the outfit reads
export const CAMERA = { fov: 20, target: new GL.Vector3(0, -0.38, 0), distance: 10 };

export class FaceView {
  // transparent: no background colour, so the page behind the canvas (the game's backdrop) shows around the face
  // makeup: false for a view that only shows faces (no paint textures; the game's next-customer picture)
  constructor({ canvas, width = 600, height = 800, pixelRatio = 1, transparent = false, makeup = true } = {}) {
    this.withMakeup = makeup;
    this.renderer = new GL.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: transparent });
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.cssSize = [width, height];
    this.scene = new GL.Scene();
    this.scene.background = transparent ? null : new GL.Color(0xd9cfc7);
    this.camera = new GL.PerspectiveCamera(CAMERA.fov, width / height, 0.5, 60);
    this.camera.position.copy(CAMERA.target).add(new GL.Vector3(0, 0, CAMERA.distance));
    this.camera.lookAt(CAMERA.target);
  }

  static async load(url, options) {
    const view = new FaceView(options);
    view.init(await loadHead(url));
    return view;
  }

  init(head) {
    this.head = head;
    this.headGeometry = new HeadGeometry(head);
    this.skin = createSkinMaterial();
    setMouthLandmarks(this.skin, head.header.landmarks.mouth);
    this.headMesh = new GL.Mesh(this.headGeometry.geometry, this.skin);
    this.eyes = new Eyes();
    this.sampler = new SurfaceSampler(this.headGeometry.refSub, this.headGeometry.sub.subQuads);
    this.brows = new Brows();
    this.lashes = new Lashes(head);
    this.hair = new Hair();
    this.garment = new Garment();
    this.scene.add(this.headMesh, this.eyes.group, this.brows.mesh, this.lashes.mesh, this.hair.group, this.garment.mesh);
    // applied makeup: the paint textures feed the skin shader
    if (this.withMakeup) {
      this.makeup = new Applicator(this);
      this.skin.uniforms.uPaint.value = this.makeup.paint.colour;
      this.skin.uniforms.uFinish.value = this.makeup.paint.finish;
      this.skin.uniforms.uCoat.value = this.makeup.paint.coat;
      this.skin.uniforms.uPaintOn.value = 1;
    }
    this.updateViewport();
  }

  updateViewport() {
    const size = this.renderer.getDrawingBufferSize(new GL.Vector2());
    for (const m of [this.brows.material, this.lashes.material]) m.uniforms.uViewport.value.copy(size);
  }

  // debugging aid: move the camera closer to a point of the face
  zoom(factor, y = 0, x = 0) {
    const t = new GL.Vector3(x, y, 0);
    this.camera.position.set(x, y, CAMERA.distance / factor);
    this.camera.lookAt(t);
    if (this.profile) this.makeup?.layout();
  }

  // debugging aid: look from the side (radians around the vertical axis)
  orbit(angle) {
    const d = this.camera.position.clone().sub(CAMERA.target);
    d.applyAxisAngle(new GL.Vector3(0, 1, 0), angle);
    this.camera.position.copy(CAMERA.target).add(d);
    this.camera.lookAt(CAMERA.target);
    if (this.profile) this.makeup?.layout();
  }

  setSize(width, height) {
    this.renderer.setSize(width, height, false);
    this.cssSize = [width, height];
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    if (this.head) this.updateViewport();
    if (this.profile) this.makeup?.layout(); // marks stay where they are; only the pointer mapping changes
  }

  // profile: a record from generator.js
  setFace(profile) {
    this.profile = profile;
    const hg = this.headGeometry;
    hg.setShape(profile.shape);
    const rng = createRng(profile.seed ^ 0x5eed);
    const sk = profile.skin;
    const skin = skinAlbedo(sk.tone, sk.undertone);
    const u = this.skin.uniforms;
    u.uSkin.value.set(...skin);
    const lips = lipColours(skin, sk.tone, rng);
    u.uLip.value.set(...lips.outer);
    u.uLipInner.value.set(...lips.inner);
    u.uSeed.value = (profile.seed % 997) * 0.37;
    u.uFlush.value = sk.flush;
    u.uUnderEye.value = sk.underEye;
    u.uOil.value = sk.oil;
    u.uFreckles.value.set(sk.freckles.density, sk.freckles.contrast, sk.freckles.size, sk.freckles.forehead);
    const fc = [skin[0] * 0.55, skin[1] * 0.4, skin[2] * 0.33];
    u.uFreckleCol.value.set(...fc);
    u.uMoles.value.forEach((m, i) => { const mole = sk.moles[i]; m.set(...(mole ? [...mole.at, mole.radius] : [0, 0, 0, 0])); });
    const hair = HAIR_COLOURS[profile.hair.colour] || HAIR_COLOURS['dark-brown'];
    u.uScalpTint.value.set(...hair.map((c) => c * 0.8));
    u.uScalpAmount.value = 0.92;
    if (this.debugScalp) { u.uScalpTint.value.set(3, 0.1, 0.1); u.uScalpAmount.value = 1; }
    u.uScalp.value.set(profile.hair.hairline.front, profile.hair.hairline.temple, profile.hair.hairline.side, 0.03);
    // eyes look at the camera
    this.eyes.place(hg, this.camera.position);
    const iris = IRIS[profile.eyes.iris];
    this.eyes.setIris(iris, iris, profile.eyes.seed);
    this.eyes.setStyle({ irisSize: profile.eyes.irisSize, pupil: profile.eyes.pupil, limbal: profile.eyes.limbal });
    this.brows.build(profile.brows, hg, this.sampler);
    const bs = BROW_SHAPES[profile.brows.shape];
    u.uBrowA.value.set(bs.pu, bs.ph, bs.tail, bs.k1);
    u.uBrowB.value.set(bs.k2, profile.brows.thickness, profile.brows.length, profile.brows.density);
    const bc = HAIR_COLOURS[profile.brows.colour] || HAIR_COLOURS['dark-brown'];
    u.uBrowCol.value.set(...bc.map((c) => c * profile.brows.shade));
    const centres = { left: this.eyes.meshes[0].position, right: this.eyes.meshes[1].position };
    this.lashes.build(profile.lashes, hg, centres);
    this.hair.build(profile, hg);
    this.garment.build(profile.outfit, hg);
    setNeckUniforms(u, profile.outfit.neckline); // the fabric's soft shadow on the skin
    this.garment.mesh.visible = !this.hideGarment; // debugging aid
    this.makeup?.reset(profile); // a new face starts clean
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
