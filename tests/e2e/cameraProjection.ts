import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera.js';
import { observerView } from '../../src/domain/cameras/observerView';
import { createCameraPresets } from '../../src/domain/cameras/cameraPresets';

export function cameraLabelPosition(id: number) {
  const engine = new NullEngine({ renderWidth: 1280, renderHeight: 720, textureSize: 512, deterministicLockstep: false, lockstepMaxSteps: 4 });
  const scene = new Scene(engine);
  try {
    const observer = new ArcRotateCamera('observer', observerView.alpha, observerView.beta, observerView.radius, Vector3.FromArray(observerView.target), scene);
    const definition = createCameraPresets().find((camera) => camera.id === id)!;
    const position = Vector3.FromArray(definition.pose.position).addInPlaceFromFloats(0, 0.95, 0);
    const pixel = Vector3.Project(position, Matrix.Identity(), observer.getViewMatrix().multiply(observer.getProjectionMatrix()), observer.viewport.toGlobal(1280, 720));
    return { x: pixel.x, y: pixel.y };
  } finally { scene.dispose(); engine.dispose(); }
}
