import { validateCamera } from './cameraDefinition';
import type { CameraDefinition, Position3, Rotation4 } from './cameraDefinition';
import { segmentHitsObstacle, validateTravelObstacle, validateTravelPosition } from './travelCollision';
import type { TravelObstacle } from './travelCollision';

export interface TravelPose {
  readonly position: Position3;
  readonly rotation: Rotation4;
  readonly fovDegrees: number;
  readonly near: number;
  readonly far: number;
}
export interface TravelPath {
  readonly from: TravelPose;
  readonly to: TravelPose;
  readonly points: readonly Position3[];
  /** Cumulative geometric lengths, independent of easing. */
  readonly distances: readonly number[];
  readonly length: number;
  readonly radius: number;
}
export const travelClearance = 0.25;
export const maxTravelWaypoints = 3;
const smooth = (value: number) => value * value * (3 - 2 * value);
const positionCopy = (point: Position3): Position3 => Object.freeze([...point]) as Position3;
const poseCopy = (camera: CameraDefinition): TravelPose => Object.freeze({
  position: positionCopy(camera.pose.position), rotation: Object.freeze([...camera.pose.rotation]) as Rotation4,
  fovDegrees: camera.fovDegrees, near: camera.near, far: camera.far,
});

export function travelWaypoints(points: readonly Position3[] = []): readonly Position3[] {
  if (points.length > maxTravelWaypoints) throw new Error('Choisir au plus trois points de passage.');
  return Object.freeze(points.map((point) => { validateTravelPosition(point); return positionCopy(point); }));
}

/** Shortest-arc SLERP; opposite quaternion signs describe the same orientation. */
function interpolateRotation(from: Rotation4, to: Rotation4, progress: number): Rotation4 {
  const dot = from.reduce((sum, value, i) => sum + value * to[i], 0);
  const sign = dot < 0 ? -1 : 1, cosine = Math.min(1, Math.abs(dot));
  const angle = Math.acos(cosine), sine = Math.sin(angle);
  const a = cosine > 0.9995 ? 1 - progress : Math.sin((1 - progress) * angle) / sine;
  const b = cosine > 0.9995 ? progress : Math.sin(progress * angle) / sine;
  const values = from.map((value, i) => a * value + b * sign * to[i]);
  const norm = Math.hypot(...values);
  return Object.freeze(values.map((value) => value / norm)) as unknown as Rotation4;
}

/** Piecewise straight geometry: easing never overshoots a validated segment. */
export function createTravelPath(from: CameraDefinition, to: CameraDefinition, waypoints: readonly Position3[] = [], obstacles: readonly TravelObstacle[] = []): TravelPath {
  validateCamera(from); validateCamera(to);
  const middle = travelWaypoints(waypoints);
  const ids = new Set<string>();
  for (const obstacle of obstacles) {
    validateTravelObstacle(obstacle);
    if (ids.has(obstacle.id)) throw new Error('Identifiant obstacle dupliqué.');
    ids.add(obstacle.id);
  }
  const start = poseCopy(from), end = poseCopy(to);
  const nodes = [start.position, ...middle, end.position];
  const points = nodes.filter((point, i) => i === 0 || point.some((value, axis) => value !== nodes[i - 1][axis]));
  const distances = [0];
  for (let i = 1; i < points.length; i++) distances.push(distances[i - 1] + Math.hypot(...points[i].map((value, axis) => value - points[i - 1][axis])));
  // Sphere around the optical centre containing the 16:9 near plane at every orientation.
  const tangent = Math.tan(Math.max(from.fovDegrees, to.fovDegrees) * Math.PI / 360);
  const radius = travelClearance + Math.max(from.near, to.near) * Math.sqrt(1 + tangent * tangent * (1 + (16 / 9) ** 2));
  if (!Number.isFinite(radius)) throw new Error('Enveloppe de trajet non finie.');
  for (let i = 0; i < Math.max(1, points.length - 1); i++) {
    for (const obstacle of obstacles) {
      if (segmentHitsObstacle(points[i], points[i + 1] ?? points[i], obstacle, radius)) {
        throw new Error(`Trajet bloqué : ${obstacle.label} (segment ${i + 1}). Choisir des points de passage, une coupe ou un effet 2D.`);
      }
    }
  }
  return Object.freeze({ from: start, to: end, points: Object.freeze(points), distances: Object.freeze(distances), length: distances.at(-1)!, radius });
}

/** Normalized elapsed time. Segment durations are proportional to their lengths. */
export function travelPose(path: TravelPath, progress: number): TravelPose {
  if (!Number.isFinite(progress)) throw new Error('Progression du trajet non finie.');
  if (progress <= 0) return path.from;
  if (progress >= 1) return path.to;
  const distance = progress * path.length;
  let segment = 0;
  while (segment < path.points.length - 2 && distance > path.distances[segment + 1]) segment++;
  const a = path.points[segment], b = path.points[segment + 1] ?? a;
  const span = path.distances[segment + 1] - path.distances[segment];
  const local = span > 0 ? smooth((distance - path.distances[segment]) / span) : 0;
  const eased = smooth(progress), mix = (a: number, b: number) => a + (b - a) * eased;
  return Object.freeze({ position: Object.freeze(a.map((value, axis) => value + (b[axis] - value) * local)) as unknown as Position3,
    rotation: interpolateRotation(path.from.rotation, path.to.rotation, eased),
    fovDegrees: mix(path.from.fovDegrees, path.to.fovDegrees), near: mix(path.from.near, path.to.near), far: mix(path.from.far, path.to.far) });
}
