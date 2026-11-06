import type { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { attachObserverKeyboard } from '../interaction/attachObserverKeyboard';
import { CameraRegistry } from '../../../domain/cameras/cameraRegistry';
import { createCameraPresets } from '../../../domain/cameras/cameraPresets';
import { createCaptureCameras } from '../cameras/createCaptureCameras';
import { attachCameraControls } from '../interaction/attachCameraControls';
import { Engine } from '@babylonjs/core/Engines/engine';
import type { RenderRuntime } from '../../../application/ports/renderRuntime';
import { watchSceneReadiness } from './watchSceneReadiness';
import { createRoutingRenderer } from '../rendering/createRoutingRenderer';
import { RoutingDirector } from '../../../application/commands/routingDirector';
import { attachRoutingControls } from '../ui/attachRoutingControls';
import { createConcertScene } from './createObservationScene';

export function createBabylonRuntime(canvas: HTMLCanvasElement): RenderRuntime {
  const engine = new Engine(canvas, true, { stencil: true, preserveDrawingBuffer: false });
  try {
    if (engine.webGLVersion < 2) throw new Error('WebGL2 est requis.');
    const { scene, screens } = createConcertScene(engine);
    const registry = new CameraRegistry(createCameraPresets());
    const cameras = createCaptureCameras(scene, registry);
    const director = new RoutingDirector(registry, createRoutingRenderer(scene, screens, cameras));
    const detachRoutingControls = attachRoutingControls(canvas.ownerDocument, registry, director);
    const initialization = director.initialize();
    void initialization.catch(() => undefined);
    const detachCameraControls = attachCameraControls(canvas, registry, scene.activeCamera as ArcRotateCamera);
    scene.activeCamera?.attachControl(canvas, false);
    const detachKeyboard = attachObserverKeyboard(scene.activeCamera as ArcRotateCamera, canvas);
    const readiness = watchSceneReadiness(scene);
    const render = () => scene.render();
    let disposed = false;
    let started = false;
    return {
      start() {
        if (disposed || started) return;
        started = true;
        engine.runRenderLoop(render);
      },
      whenReady: () => Promise.all([readiness.ready, initialization.catch(() => undefined)]).then(() => undefined),
      resize(pixelRatio) {
        if (disposed) return;
        engine.setHardwareScalingLevel(1 / pixelRatio);
        engine.resize();
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        readiness.dispose();
        engine.stopRenderLoop(render);
        detachCameraControls();
        detachKeyboard();
        detachRoutingControls();
        director.dispose();
        cameras.dispose();
        scene.activeCamera?.detachControl();
        scene.dispose();
        engine.dispose();
      },
    };
  } catch (error) {
    engine.dispose();
    throw error;
  }
}
