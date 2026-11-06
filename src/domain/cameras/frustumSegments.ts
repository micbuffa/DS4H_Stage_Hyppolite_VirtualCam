import type { Position3 } from './cameraDefinition';

/** Local +Z framing aid. Its display depth is independent of the actual far clipping plane. */
export function frustumSegments(fovDegrees: number, near: number, depth = 5, aspect = 16 / 9): Position3[][] {
  if (![fovDegrees, near, depth, aspect].every(Number.isFinite) || fovDegrees < 20 || fovDegrees > 90 || near <= 0 || depth <= near || aspect <= 0) throw new Error('Frustum invalide.');
  const rectangle = (z: number): Position3[] => {
    const halfHeight = Math.tan(fovDegrees * Math.PI / 360) * z;
    const halfWidth = halfHeight * aspect;
    return [[-halfWidth, -halfHeight, z], [halfWidth, -halfHeight, z], [halfWidth, halfHeight, z], [-halfWidth, halfHeight, z]];
  };
  const front = rectangle(near);
  const back = rectangle(depth);
  const lines: Position3[][] = [];
  for (let index = 0; index < 4; index++) {
    lines.push([front[index], back[index]], [front[index], front[(index + 1) % 4]], [back[index], back[(index + 1) % 4]]);
  }
  lines.push([[0, 0, 0], [0, 0, depth + 1]]);
  return lines;
}
