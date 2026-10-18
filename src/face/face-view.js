// Renders one generated face: head surface, eyes, brows, lashes and hair, with a fixed front camera.
import * as GL from '../gl/mini.js';
import { loadHead } from './head-data.js';
import { HeadGeometry } from './head-geometry.js';
import { createSkinMaterial, setMouthLandmarks } from './skin-material.js';
import { Eyes } from './eyes.js';
import { Brows, BROW_SHAPES } from './brows.js';
import { Lashes } from './lashes.js';
import { SurfaceSampler } from './surface.js';
import { Hair, buildCape, Builder as CapeBuilder } from './hair.js';
import { createHairMaterial, HAIR_MODE } from './hair-material.js';
import { skinAlbedo, ALBINISM_SKIN, lipColours, IRIS, HAIR_COLOURS } from './colors.js';
import { createRng } from './rng.js';

export const CAMERA = { fov: 20, target: new GL.Vector3(0, -0.28, 0), distance: 9.4 };

export class FaceView {
  constructor({ canvas, width = 600, height = 800, pixelRatio = 1 } = {}) {
    this.renderer = new GL.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.scene = new GL.Scene();
    this.scene.background = new GL.Color(0xd9cfc7);
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
    this.scene.add(this.headMesh, this.eyes.group, this.brows.mesh, this.lashes.mesh, this.hair.group);
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
  }

  // debugging aid: look from the side (radians around the vertical axis)
  orbit(angle) {
    const d = this.camera.position.clone().sub(CAMERA.target);
    d.applyAxisAngle(new GL.Vector3(0, 1, 0), angle);
    this.camera.position.copy(CAMERA.target).add(d);
    this.camera.lookAt(CAMERA.target);
  }

  setSize(width, height) {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    if (this.head) this.updateViewport();
  }

  // profile: a record from generator.js
  setFace(profile) {
    this.profile = profile;
    const hg = this.headGeometry;
    hg.setShape(profile.shape);
    const rng = createRng(profile.seed ^ 0x5eed);
    const sk = profile.skin;
    const skin = sk.albinism ? ALBINISM_SKIN : skinAlbedo(sk.tone, sk.undertone);
    const u = this.skin.uniforms;
    u.uSkin.value.set(...skin);
    const lips = lipColours(skin, sk.albinism ? 0 : sk.tone, rng);
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
    u.uVitiligo.value.set(sk.vitiligo ? sk.vitiligo.amount : 0, sk.vitiligo ? sk.vitiligo.scale : 1, sk.vitiligo ? sk.vitiligo.seed : 0, 0);
    const hair = HAIR_COLOURS[profile.hair.colour] || HAIR_COLOURS['dark-brown'];
    u.uScalpTint.value.set(...hair.map((c) => c * 0.8));
    const style = profile.hair.style;
    u.uScalpAmount.value = ['hijab', 'headwrap'].includes(style) ? 0 : style === 'buzz' ? 0.55 : style === 'cornrows' ? 0.5 : 0.92;
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
    this.buildCape(this.hair.frame);
  }

  // frame: the HeadFrame of the current face (shared with the hair)
  buildCape(frame) {
    if (!this.cape) {
      this.cape = new GL.Mesh(new GL.BufferGeometry(), createHairMaterial());
      const u = this.cape.material.uniforms;
      u.uMode.value = HAIR_MODE.cloth;
      this.cape.material.side = GL.FrontSide;
      this.cape.renderOrder = 0;
      for (const k of ['uRoot', 'uMid', 'uTip']) u[k].value.set(0.75, 0.66, 0.66);
      this.scene.add(this.cape);
    }
    const b = new CapeBuilder();
    buildCape(frame, b);
    this.cape.geometry.dispose();
    this.cape.geometry = b.geometry();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
