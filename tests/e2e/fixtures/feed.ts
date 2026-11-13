import { Engine } from '@babylonjs/core/Engines/engine';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { CameraRegistry } from '../../../src/domain/cameras/cameraRegistry';
import { createCameraPresets } from '../../../src/domain/cameras/cameraPresets';
import { attachConcertShow } from '../../../src/infrastructure/babylon/engine/attachConcertShow';
import { createConcertScene } from '../../../src/infrastructure/babylon/engine/createObservationScene';
import { createCaptureCameras } from '../../../src/infrastructure/babylon/cameras/createCaptureCameras';
import { createFirstScreenFeed } from '../../../src/infrastructure/babylon/rendering/createFirstScreenFeed';
import { createTestPattern } from '../../../src/infrastructure/babylon/models/screens/testPattern';

const engine = new Engine(document.querySelector('canvas')!, true);
const concert = createConcertScene(engine);
const { scene, screens, band, audience } = concert;
const registry = new CameraRegistry(createCameraPresets());
const captures = createCaptureCameras(scene, registry);
const params = new URLSearchParams(location.search);
const calibration = params.has('calibration');
const audienceShot = params.has('audience');
if (params.has('show')) {
  const show = attachConcertShow(concert);
  const toggle = document.createElement('button');
  toggle.textContent = 'Basculer la pause';
  toggle.addEventListener('click', () => show.clock.toggle());
  document.querySelector('nav')!.append(toggle);
}
const screen = screens.screens[0];
if (calibration) {
  for (const mesh of scene.meshes) if (mesh.metadata?.category === 'concert') mesh.setEnabled(false);
  const sourceDistance = 4.5 / Math.tan(captures.rigs.get(1)!.camera.fov / 2);
  registry.updatePose(1, { position: [0, 7, 10 - sourceDistance], rotation: [0, 0, 0, 1] });
  const plane = CreatePlane('calibration-pattern', { width: 16, height: 9 }, scene);
  plane.position.set(0, 7, 10);
  plane.metadata = { category: 'concert', theme: 'calibration' };
  const material = new StandardMaterial('calibration-material', scene);
  material.disableLighting = true;
  material.diffuseColor = Color3.Black();
  material.emissiveColor = Color3.Black();
  material.emissiveTexture = RawTexture.CreateRGBATexture(createTestPattern(1, 'GAUCHE'), 512, 288, scene, false, false, Texture.NEAREST_SAMPLINGMODE);
  plane.material = material;
  for (const [category, z] of [['video-surface', 4], ['panel', 5], ['camera-helper', 6]] as const) {
    const excluded = CreatePlane(`excluded-${category}`, { width: 3, height: 2 }, scene);
    excluded.position.set(0, 7, z);
    excluded.metadata = { category };
    excluded.layerMask = category === 'camera-helper' ? 2 : 1;
    const color = new StandardMaterial(`excluded-${category}-material`, scene);
    color.disableLighting = true;
    color.emissiveColor = Color3.Magenta();
    excluded.material = color;
  }
}
// Test-only observer: look directly at the physical screen, never at the source scene.
const observer = new FreeCamera('screen-inspector', new Vector3(-17, 7, 0), scene);
observer.inputs.clear();
observer.setTarget(new Vector3(-17, 7, 10));
observer.mode = Camera.ORTHOGRAPHIC_CAMERA;
observer.layerMask = 1;
scene.activeCamera = observer;
const resize = () => {
  engine.resize();
  const aspect = engine.getRenderWidth() / engine.getRenderHeight();
  const halfWidth = Math.max(4, 2.25 * aspect);
  observer.orthoLeft = -halfWidth; observer.orthoRight = halfWidth;
  observer.orthoTop = halfWidth / aspect; observer.orthoBottom = -halfWidth / aspect;
};
resize();
window.addEventListener('resize', resize);
const source = captures.rigs.get(audienceShot ? 9 : 1)!.camera;
const originalTexture = screen.material.emissiveTexture;
const feed = createFirstScreenFeed(scene, source, screen);
let frame = 0;
let previousFrame = -1;
let duplicatePass = false;
feed.onFrameRendered(() => {
  frame++;
  if (previousFrame === scene.getFrameId()) duplicatePass = true;
  previousFrame = scene.getFrameId();
  document.body.dataset.duplicatePass = String(duplicatePass);
  document.body.dataset.frame = String(frame);
  const matrix = source.getProjectionMatrix();
  document.body.dataset.aspect = String(matrix.m[5] / matrix.m[0]);
});
scene.onAfterRenderObservable.add(() => {
  document.body.dataset.observer = String(scene.activeCamera === observer);
});
const measure = async () => {
  const pixels = await feed.texture.readPixels();
  if (!pixels) throw new Error('Lecture GPU indisponible.');
  const bytes = new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength);
  const copy = new Uint8Array(bytes);
  const hash = await crypto.subtle.digest('SHA-256', copy);
  const pixel = (x: number, y: number) => [...bytes.slice(((575 - y) * 1024 + x) * 4, ((575 - y) * 1024 + x) * 4 + 4)];
  const samples = {
    topLeft: pixel(8, 8), bottomRight: pixel(1016, 568), topRight: pixel(1016, 8),
    bars: Array.from({ length: 8 }, (_, index) => pixel(index * 128 + 64, 115)),
    centerBlank: pixel(512, 385),
  };
  document.body.dataset.samples = JSON.stringify(samples);
  document.body.dataset.hash = [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, '0')).join('');
  document.body.dataset.measure = String(Number(document.body.dataset.measure ?? 0) + 1);
};
if (audienceShot) {
  const toggle = document.createElement('button');
  toggle.textContent = 'Afficher ou masquer le public';
  toggle.addEventListener('click', () => audience.root.setEnabled(!audience.root.isEnabled()));
  document.querySelector('nav')!.append(toggle);
}
document.getElementById('measure')!.addEventListener('click', () => { void measure(); });
document.getElementById('move')!.addEventListener('click', () => { band.musicians[0].root.position.x += 2; });
document.getElementById('select')!.addEventListener('click', () => {
  registry.select(4); document.body.dataset.selected = '4';
});
document.getElementById('late')!.addEventListener('click', () => {
  const mesh = CreateBox('late-filmable-musician', { size: 1 }, scene);
  mesh.position.set(0, 7, 7);
  mesh.metadata = { category: 'concert', theme: 'musicians' };
  const material = new StandardMaterial('late-material', scene);
  material.disableLighting = true;
  material.emissiveColor = Color3.Green();
  mesh.material = material;
});
document.getElementById('stop')!.addEventListener('click', () => {
  feed.dispose(); feed.dispose();
  document.body.dataset.targets = String(scene.customRenderTargets.length);
  document.body.dataset.restored = String(screen.material.emissiveTexture === originalTexture);
});
engine.runRenderLoop(() => scene.render());
feed.ready.then(() => { document.body.dataset.ready = 'true'; }).catch((error: unknown) => {
  document.body.dataset.error = String(error);
});
window.addEventListener('pagehide', () => {
  window.removeEventListener('resize', resize);
  feed.dispose(); captures.dispose(); scene.dispose(); engine.dispose();
}, { once: true });
