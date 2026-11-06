import { Engine } from '@babylonjs/core/Engines/engine';
import { CameraRegistry } from '../../../src/domain/cameras/cameraRegistry';
import { createCameraPresets } from '../../../src/domain/cameras/cameraPresets';
import { assertCameraId } from '../../../src/domain/cameras/cameraDefinition';
import { createCaptureCameras } from '../../../src/infrastructure/babylon/cameras/createCaptureCameras';
import { createObservationScene } from '../../../src/infrastructure/babylon/engine/createObservationScene';
import { watchSceneReadiness } from '../../../src/infrastructure/babylon/engine/watchSceneReadiness';

// Test-only framing inspection. The application continues to use its observer.
const id = Number(new URLSearchParams(location.search).get('camera'));
assertCameraId(id);
const engine = new Engine(document.querySelector('canvas')!, true);
const scene = createObservationScene(engine);
const registry = new CameraRegistry(createCameraPresets());
const captures = createCaptureCameras(scene, registry);
scene.activeCamera = captures.rigs.get(id)!.camera;
const readiness = watchSceneReadiness(scene);
engine.runRenderLoop(() => scene.render());
readiness.ready.then(() => { document.body.dataset.ready = 'true'; });
window.addEventListener('pagehide', () => { readiness.dispose(); captures.dispose(); scene.dispose(); engine.dispose(); }, { once: true });
