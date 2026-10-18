// Renders one generated face: head surface, eyes, brows, lashes and hair, with a fixed front camera.
import * as THREE from 'three';
import { parseHead } from './head-data.js';
import { HeadGeometry } from './head-geometry.js';
import { createSkinMaterial, setMouthLandmarks } from './skin-material.js';
import { Eyes } from './eyes.js';
import { Brows, BROW_SHAPES } from './brows.js';
import { Lashes } from './lashes.js';
import { SurfaceSampler } from './surface.js';
import { skinAlbedo, ALBINISM_SKIN, lipColours, IRIS, HAIR_COLOURS } from './colors.js';
import { createRng } from './rng.js';

export const CAMERA = { fov: 20, target: new THREE.Vector3(0, -0.28, 0), distance: 9.4 };

export class FaceView {
  constructor({ canvas, width = 600, height = 800, pixelRatio = 1 } = {}) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(CAMERA.fov, width / height, 0.5, 60);
    this.camera.position.copy(CAMERA.target).add(new THREE.Vector3(0, 0, CAMERA.distance));
    this.camera.lookAt(CAMERA.target);
  }

  static async load(url, options) {
    const view = new FaceView(options);
    const buffer = await (await fetch(url)).arrayBuffer();
    view.init(parseHead(buffer));
    return view;
  }

  init(head) {
    this.head = head;
    this.headGeometry = new HeadGeometry(head);
    this.skin = createSkinMaterial();
    setMouthLandmarks(this.skin, head.header.landmarks.mouth);
    this.headMesh = new THREE.Mesh(this.headGeometry.geometry, this.skin);
    this.eyes = new Eyes();
    this.sampler = new SurfaceSampler(this.headGeometry.refSub, this.headGeometry.sub.subQuads);
    this.brows = new Brows();
    this.lashes = new Lashes(head);
    this.scene.add(this.headMesh, this.eyes.group, this.brows.mesh, this.lashes.mesh);
    this.updateViewport();
  }

  updateViewport() {
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    for (const m of [this.brows.material, this.lashes.material]) m.uniforms.uViewport.value.copy(size);
  }

  // debugging aid: move the camera closer to a point of the face
  zoom(factor, y = 0, x = 0) {
    const t = new THREE.Vector3(x, y, 0);
    this.camera.position.set(x, y, CAMERA.distance / factor);
    this.camera.lookAt(t);
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
    u.uHairShadow.value.set(0.82 + hair[0] * 0.3, 0.8 + hair[1] * 0.3, 0.78 + hair[2] * 0.3);
    u.uHairShadow.value.z = profile.hair.style === 'shaved' ? 0.25 : 0.0;
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
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
