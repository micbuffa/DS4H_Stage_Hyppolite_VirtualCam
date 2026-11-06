import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Material } from '@babylonjs/core/Materials/material';
import type { stageGeometry } from './stageGeometry';

export function createTruss(
  geometry: ReturnType<typeof stageGeometry>, name: string,
  start: Vector3, end: Vector3, material: Material,
) {
  const direction = end.subtract(start);
  const side = Math.abs(direction.y) > 0.9 * direction.length() ? Vector3.Right() : Vector3.Up();
  const half = 0.22;
  for (const offset of [-half, half]) {
    geometry.beam(`${name}-rail-${offset}`, start.add(side.scale(offset)), end.add(side.scale(offset)), 0.12, material);
  }
  const segments = Math.ceil(direction.length() / 1.2);
  for (let i = 0; i < segments; i++) {
    const a = start.add(direction.scale(i / segments)).add(side.scale(i % 2 ? half : -half));
    const b = start.add(direction.scale((i + 1) / segments)).add(side.scale(i % 2 ? -half : half));
    geometry.beam(`${name}-brace-${i}`, a, b, 0.065, material);
  }
}
