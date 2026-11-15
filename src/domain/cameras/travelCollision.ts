import type { Position3 } from './cameraDefinition';

/** Closed world-space boxes. Inflation is conservative at edges and corners. */
export interface TravelObstacle {
  readonly id: string;
  readonly label: string;
  readonly min: Position3;
  readonly max: Position3;
}

export function validateTravelPosition(position: Position3): void {
  if (position.length !== 3 || !position.every(Number.isFinite)) throw new Error('Point de trajet non fini ou incomplet.');
  const [x, y, z] = position;
  if (x < -35 || x > 35 || y < 0.5 || y > 25 || z < -35 || z > 25) throw new Error('Point de trajet hors limites.');
}

export function validateTravelObstacle(obstacle: TravelObstacle): void {
  if (!obstacle.id.trim() || !obstacle.label.trim() || obstacle.min.length !== 3 || obstacle.max.length !== 3 ||
      ![...obstacle.min, ...obstacle.max].every(Number.isFinite) || obstacle.min.some((value, i) => value > obstacle.max[i])) {
    throw new Error('Volume obstacle invalide.');
  }
}

/** Continuous slab intersection, including contact and segments reduced to a point. */
export function segmentHitsObstacle(from: Position3, to: Position3, obstacle: TravelObstacle, radius: number): boolean {
  validateTravelPosition(from); validateTravelPosition(to); validateTravelObstacle(obstacle);
  if (!Number.isFinite(radius) || radius < 0) throw new Error('Marge de trajet invalide.');
  let enter = 0, leave = 1;
  for (let axis = 0; axis < 3; axis++) {
    const min = obstacle.min[axis] - radius, max = obstacle.max[axis] + radius;
    if (!Number.isFinite(min) || !Number.isFinite(max)) throw new Error('Enveloppe de trajet non finie.');
    const delta = to[axis] - from[axis];
    if (delta === 0) { if (from[axis] < min || from[axis] > max) return false; }
    else {
      const a = (min - from[axis]) / delta, b = (max - from[axis]) / delta;
      enter = Math.max(enter, Math.min(a, b)); leave = Math.min(leave, Math.max(a, b));
      if (enter > leave) return false;
    }
  }
  return true;
}
