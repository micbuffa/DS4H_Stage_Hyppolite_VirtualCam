import type { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import type { EditingNavigation } from '../../../application/commands/cameraEditor';

export function createEditingNavigation(observer: ArcRotateCamera, canvas: HTMLCanvasElement): EditingNavigation {
  let suspended = false;
  const clearInertia = () => {
    observer.inertialAlphaOffset = observer.inertialBetaOffset = observer.inertialRadiusOffset = 0;
    observer.inertialPanningX = observer.inertialPanningY = 0;
  };
  return {
    suspend() {
      if (suspended) return;
      suspended = true; clearInertia(); observer.detachControl();
    },
    resume() {
      if (!suspended) return;
      suspended = false; clearInertia(); observer.attachControl(canvas, false);
    },
  };
}
