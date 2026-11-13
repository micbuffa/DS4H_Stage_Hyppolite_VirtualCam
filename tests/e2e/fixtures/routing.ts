import { Engine } from '@babylonjs/core/Engines/engine';
import { RenderTargetTexture } from '@babylonjs/core/Materials/Textures/renderTargetTexture';
import { CameraRegistry } from '../../../src/domain/cameras/cameraRegistry';
import { createCameraPresets } from '../../../src/domain/cameras/cameraPresets';
import { RoutingDirector } from '../../../src/application/commands/routingDirector';
import { createConcertScene } from '../../../src/infrastructure/babylon/engine/createObservationScene';
import { createCaptureCameras } from '../../../src/infrastructure/babylon/cameras/createCaptureCameras';
import { createCameraFeed } from '../../../src/infrastructure/babylon/rendering/createCameraFeed';
import { createRoutingRenderer } from '../../../src/infrastructure/babylon/rendering/createRoutingRenderer';
import { DirectorPanel } from '../../../src/application/commands/directorPanel';
import { CameraEditor } from '../../../src/application/commands/cameraEditor';
import { createDirectorPanel } from '../../../src/infrastructure/babylon/ui/createDirectorPanel';
import { lookAtRotation } from '../../../src/domain/cameras/cameraDefinition';
import { panelPlacement } from '../../../src/domain/direction/panelLayout';
import { watchSceneReadiness } from '../../../src/infrastructure/babylon/engine/watchSceneReadiness';

const engine = new Engine(document.querySelector('canvas')!, true);
const { scene, screens } = createConcertScene(engine);
const registry = new CameraRegistry(createCameraPresets());
const captures = createCaptureCameras(scene, registry);
const observer = scene.activeCamera;
const params = new URLSearchParams(location.search);
let fail = params.has('failure');
let release!: () => void;
const gate = new Promise<void>((resolve) => { release = resolve; });
const renderer = createRoutingRenderer(scene, screens, captures, {
  createFeed: (scene, camera) => {
    if (fail && (camera === captures.rigs.get(8)!.camera || params.has('startup'))) throw new Error('Source indisponible (recette).');
    const feed = createCameraFeed(scene, camera);
    if (params.has('delay') && camera === captures.rigs.get(8)!.camera) return { ...feed, ready: Promise.all([feed.ready, gate]).then(() => undefined) };
    return feed;
  },
  waitForPresentation: watchSceneReadiness,
});
const director = new RoutingDirector(registry, renderer);
if (params.has('stress')) {
  Object.assign(window, {
    async cycleCuts() {
      const textures = scene.textures.length - 1; // The initialized shared C1 is replaced by the first cut.
      const renderObservers = scene.onBeforeRenderObservable.observers.filter((observer) => !observer._willBeUnregistered).length - 1;
      for (let i = 0; i < 100; i++) {
        const expected = i % 2 === 0 ? 3 : 1;
        const transaction = await renderer.prepare(expected === 3 ? { 1: 2, 2: 5, 3: 9 } : { 1: 1, 2: 1, 3: 1 });
        await transaction.commit();
        transaction.complete();
        const observers = scene.onBeforeRenderObservable.observers.filter((observer) => !observer._willBeUnregistered).length;
        if (scene.customRenderTargets.length !== expected || scene.textures.length !== textures + expected || observers !== renderObservers + expected) {
          throw new Error('Fuite de ressources à la coupe ' + (i + 1));
        }
      }
      return 100;
    },
  });
}
const panel = params.has('panel') ? createDirectorPanel(scene) : undefined;
const editor = panel ? new CameraEditor(registry, { suspend() {}, resume() {} }) : undefined;
const panelCommands = panel && editor ? new DirectorPanel(registry, director, editor, panel, () => undefined) : undefined;
if (panel) {
  for (const [id, x] of [[1, 7], [4, 9], [7, 11]] as const) {
    const position = [x, 9, -24] as const;
    registry.updatePose(id, { position, rotation: lookAtRotation(position, panelPlacement.position) });
  }
  const filmPanel = document.createElement('button');
  filmPanel.id = 'film-panel';
  filmPanel.textContent = 'Inclure le panneau dans les flux de recette';
  document.body.append(filmPanel);
  filmPanel.addEventListener('click', () => {
    for (const mesh of panel.root.getChildMeshes()) {
      mesh.metadata.category = 'concert';
      mesh.layerMask = 1;
    }
    scene.onAfterRenderObservable.addOnce(() => { document.body.dataset.panelFilmable = 'true'; });
  });
}
let maxActive = 0;
scene.onAfterRenderObservable.add(() => {
  maxActive = Math.max(maxActive, scene.customRenderTargets.length);
  document.body.dataset.maxActive = String(maxActive);
  document.body.dataset.active = String(scene.customRenderTargets.length);
  document.body.dataset.allocated = String(renderer.stats().allocated);
  document.body.dataset.observer = String(scene.activeCamera === observer);
  document.body.dataset.textures = screens.screens.map((screen) => screen.material.emissiveTexture?.name).join('|');
  document.body.dataset.valid = String(screens.screens.every((screen) => screen.material.emissiveTexture?.getInternalTexture()?.isReady));
});
director.subscribe((state) => {
  document.body.dataset.routes = JSON.stringify(state.routes);
  document.body.dataset.pending = String(state.pending);
  document.body.dataset.error = state.error ?? '';
});
const run = (command: Promise<void>) => { void command.catch(() => undefined); };
const click = (id: string, handler: () => void) => document.getElementById(id)!.addEventListener('click', handler);
click('c1', () => run(director.assign(1, [1, 2, 3])));
click('three', () => run((async () => { await director.assign(4, [2]); await director.assign(7, [3]); })()));
click('c8', () => run(director.assign(8, [1, 2, 3])));
click('release', () => { fail = false; release(); });
click('move', () => {
  const pose = registry.snapshot().cameras.find((camera) => camera.id === 8)!.pose;
  registry.updatePose(8, { ...pose, position: [pose.position[0] + 5, pose.position[1], pose.position[2]] });
});
click('measure', () => { void (async () => {
  const hashes = await Promise.all(screens.screens.map(async (screen) => {
    const texture = screen.material.emissiveTexture as RenderTargetTexture;
    const pixels = await texture.readPixels();
    if (!pixels) throw new Error('Pixels indisponibles');
    const hash = await crypto.subtle.digest('SHA-256', new Uint8Array(new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength)));
    return [...new Uint8Array(hash)].join(',');
  }));
  document.body.dataset.hashes = JSON.stringify(hashes);
  document.body.dataset.measure = String(Number(document.body.dataset.measure ?? 0) + 1);
})().catch((error: unknown) => { document.body.dataset.measureError = String(error); }); });
click('stop', () => { director.dispose(); director.dispose(); document.body.dataset.stopped = String(scene.customRenderTargets.length); });
engine.runRenderLoop(() => scene.render());
run(director.initialize());
window.addEventListener('pagehide', () => { panelCommands?.dispose(); editor?.dispose(); director.dispose(); panel?.dispose(); captures.dispose(); scene.dispose(); engine.dispose(); }, { once: true });
