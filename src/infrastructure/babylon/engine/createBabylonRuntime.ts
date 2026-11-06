import type { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { attachObserverKeyboard } from '../interaction/attachObserverKeyboard';
import { Engine } from '@babylonjs/core/Engines/engine';
import type { RenderRuntime } from '../../../application/ports/renderRuntime';
import { createObservationScene } from './createObservationScene';

export function createBabylonRuntime(canvas: HTMLCanvasElement): RenderRuntime {
  const engine = new Engine(canvas, true, { stencil: true, preserveDrawingBuffer: false });
  try {
    if (engine.webGLVersion < 2) throw new Error('WebGL2 est requis.');
    const scene = createObservationScene(engine);
    scene.activeCamera?.attachControl(canvas, false);
    const detachKeyboard = attachObserverKeyboard(scene.activeCamera as ArcRotateCamera, canvas);
    const render = () => scene.render();
    let disposed = false;
    let started = false;
    return {
      start() {
        if (disposed || started) return;
        started = true;
        engine.runRenderLoop(render);
      },
      resize(pixelRatio) {
        if (disposed) return;
        engine.setHardwareScalingLevel(1 / pixelRatio);
        engine.resize();
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        engine.stopRenderLoop(render);
        detachKeyboard();
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
