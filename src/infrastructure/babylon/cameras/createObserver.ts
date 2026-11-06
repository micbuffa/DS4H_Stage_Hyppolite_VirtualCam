import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';

export function createObserver(scene: Scene): ArcRotateCamera {
  const camera = new ArcRotateCamera('observer', -Math.PI / 2, 1.35, 44, new Vector3(0, 4.5, 9), scene);
  camera.inputs.removeByType('ArcRotateCameraKeyboardMoveInput');
  camera.lowerBetaLimit = 0.1;
  camera.upperBetaLimit = Math.PI / 2 - 0.05;
  camera.lowerRadiusLimit = 5;
  camera.upperRadiusLimit = 100;
  camera.panningAxis = new Vector3(1, 0, 1);
  camera.wheelDeltaPercentage = 0.01;
  camera.minZ = 0.1;
  camera.maxZ = 200;
  scene.activeCamera = camera;
  return camera;
}
