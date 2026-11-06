import { lookAtRotation, validateCamera } from './cameraDefinition';
import type { CameraDefinition, CameraId, Position3 } from './cameraDefinition';

export function createCameraPresets(): CameraDefinition[] {
  const shots: Array<[CameraId, string, Position3, Position3, number]> = [
    [1, 'Ensemble frontal', [0, 9, -21], [0, 5, 10], 48],
    [2, 'Côté gauche', [-13, 4, 1], [-2, 2.8, 7.5], 52],
    [3, 'Côté droit', [13, 4, 1], [2, 2.8, 7.5], 52],
    [4, 'Chanteur', [0, 3.6, 2.3], [0, 2.8, 6.2], 34],
    [5, 'Guitariste', [-7, 3.4, 3.5], [-5, 2.8, 7.5], 34],
    [6, 'Bassiste', [7, 3.4, 3.5], [5, 2.8, 7.5], 34],
    [7, 'Batterie', [-3, 4.3, 12.7], [0, 3.1, 13.5], 52],
    [8, 'Plongée plateau', [0, 9, 9], [0, 1.6, 10], 78],
    [9, 'Contrechamp public', [0, 4.5, 14], [0, 1.6, -8], 60],
  ];
  return shots.map(([id, name, position, target, fovDegrees]) => {
    const definition = { id, name, pose: { position, rotation: lookAtRotation(position, target) }, fovDegrees, near: 0.1, far: 200 };
    validateCamera(definition);
    return definition;
  });
}
