import { observerView } from '../../../domain/cameras/observerView';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';

export function resetObserver(camera: ArcRotateCamera): void {
  camera.setTarget(Vector3.FromArray(observerView.target));
  camera.alpha = observerView.alpha;
  camera.beta = observerView.beta;
  camera.radius = observerView.radius;
  camera.inertialAlphaOffset = 0;
  camera.inertialBetaOffset = 0;
  camera.inertialRadiusOffset = 0;
  camera.inertialPanningX = 0;
  camera.inertialPanningY = 0;
}

export function createObserver(scene: Scene): ArcRotateCamera {
  const camera = new ArcRotateCamera('observer', observerView.alpha, observerView.beta, observerView.radius, Vector3.FromArray(observerView.target), scene);
  camera.inputs.removeByType('ArcRotateCameraKeyboardMoveInput');
  camera.lowerBetaLimit = 0.1;
  camera.upperBetaLimit = Math.PI / 2 - 0.05;
  camera.lowerRadiusLimit = 5;
  camera.upperRadiusLimit = 100;
  camera.panningAxis = new Vector3(1, 0, 1);
  camera.wheelDeltaPercentage = 0.01;
  camera.minZ = 0.1;
  camera.maxZ = 200;
  camera.layerMask = 3;
  scene.activeCamera = camera;
  return camera;
}
