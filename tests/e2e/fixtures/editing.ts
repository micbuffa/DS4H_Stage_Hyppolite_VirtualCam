import '../../../src/style.css';
import { Engine } from '@babylonjs/core/Engines/engine';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { RenderTargetTexture } from '@babylonjs/core/Materials/Textures/renderTargetTexture';
import { CameraRegistry } from '../../../src/domain/cameras/cameraRegistry';
import { createCameraPresets } from '../../../src/domain/cameras/cameraPresets';
import { CameraEditor } from '../../../src/application/commands/cameraEditor';
import { RoutingDirector } from '../../../src/application/commands/routingDirector';
import { attachConcertShow } from '../../../src/infrastructure/babylon/engine/attachConcertShow';
import { createConcertScene } from '../../../src/infrastructure/babylon/engine/createObservationScene';
import { createCaptureCameras } from '../../../src/infrastructure/babylon/cameras/createCaptureCameras';
import { createRoutingRenderer } from '../../../src/infrastructure/babylon/rendering/createRoutingRenderer';
import { createEditingNavigation } from '../../../src/infrastructure/babylon/interaction/createEditingNavigation';
import { createCameraGizmos } from '../../../src/infrastructure/babylon/interaction/createCameraGizmos';
import { attachObserverKeyboard } from '../../../src/infrastructure/babylon/interaction/attachObserverKeyboard';
import { attachCameraControls } from '../../../src/infrastructure/babylon/interaction/attachCameraControls';
import { attachEditingControls } from '../../../src/infrastructure/babylon/ui/attachEditingControls';
import { attachRoutingControls } from '../../../src/infrastructure/babylon/ui/attachRoutingControls';

const canvas = document.querySelector('canvas')!;
const engine = new Engine(canvas, true);
const concert = createConcertScene(engine);
const { scene, observer, screens } = concert;
const show = attachConcertShow(concert);
show.clock.toggle();
const registry = new CameraRegistry(createCameraPresets());
const cameras = createCaptureCameras(scene, registry);
const renderer = createRoutingRenderer(scene, screens, cameras);
const director = new RoutingDirector(registry, renderer);
const editor = new CameraEditor(registry, createEditingNavigation(observer, canvas));
const gizmos = createCameraGizmos(scene, cameras, registry, editor);
const detachEditing = attachEditingControls(canvas, editor);
const detachCamera = attachCameraControls(canvas, registry, observer, editor);
const detachRouting = attachRoutingControls(document, registry, director);
const detachKeyboard = attachObserverKeyboard(observer, canvas, () => !editor.snapshot().dragging);
observer.attachControl(canvas, false);
registry.subscribe(() => { document.body.dataset.camera = JSON.stringify(editor.selected()); });
editor.subscribe((state) => { document.body.dataset.dragging = String(state.dragging); document.body.dataset.mode = String(state.mode); });
director.subscribe((state) => { document.body.dataset.routes = JSON.stringify(state.routes); });
scene.onAfterRenderObservable.add(() => {
  document.body.dataset.observer = JSON.stringify([observer.alpha, observer.beta, observer.radius, ...observer.target.asArray()]);
});
// Test-only picking coordinates, computed against the real utility scene and camera.
// No synthetic drag notifications and no mutable application globals.
document.getElementById('locate')!.addEventListener('click', () => {
  const gizmo = editor.snapshot().mode === 'move' ? gizmos.move : gizmos.rotate;
  const axes = [gizmo.xGizmo, gizmo.yGizmo, gizmo.zGizmo];
  const meshSets = axes.map((axis) => new Set(axis._rootMesh.getChildMeshes()));
  const position = cameras.rigs.get(editor.selected().id)!.root.getAbsolutePosition();
  const center = Vector3.Project(position, Matrix.Identity(), observer.getTransformationMatrix(), observer.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight()));
  const points: Record<string, { x: number; y: number }> = {};
  const distances = [0, 0, 0];
  for (let dx = -100; dx <= 100; dx += 5) for (let dy = -100; dy <= 100; dy += 5) {
    const x = Math.round(center.x + dx), y = Math.round(center.y + dy);
    const hit = gizmos.layer.utilityLayerScene.pick(x, y, undefined, false, observer);
    const index = meshSets.findIndex((set) => hit?.pickedMesh && set.has(hit.pickedMesh));
    if (index >= 0 && dx * dx + dy * dy > distances[index]) {
      distances[index] = dx * dx + dy * dy;
      points[['x', 'y', 'z'][index]] = { x, y };
    }
  }
  document.body.dataset.handles = JSON.stringify(points);
  document.body.dataset.located = String(Number(document.body.dataset.located ?? 0) + 1);
});
document.getElementById('measure')!.addEventListener('click', () => { void (async () => {
  const hashes = await Promise.all(screens.screens.map(async (screen) => {
    const pixels = await (screen.material.emissiveTexture as RenderTargetTexture).readPixels();
    if (!pixels) throw new Error('Pixels absents');
    const hash = await crypto.subtle.digest('SHA-256', new Uint8Array(new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength)));
    return [...new Uint8Array(hash)].join(',');
  }));
  document.body.dataset.hashes = JSON.stringify(hashes);
  document.body.dataset.measure = String(Number(document.body.dataset.measure ?? 0) + 1);
})(); });
engine.runRenderLoop(() => scene.render());
void director.initialize().then(() => { document.getElementById('status')!.textContent = 'Prêt à explorer'; });
window.addEventListener('pagehide', () => {
  detachEditing(); gizmos.dispose(); editor.dispose(); detachKeyboard(); detachCamera(); detachRouting();
  director.dispose(); cameras.dispose(); scene.dispose(); engine.dispose();
}, { once: true });
