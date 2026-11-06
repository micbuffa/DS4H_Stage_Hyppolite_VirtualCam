export type CameraId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type Position3 = readonly [number, number, number];
export type Rotation4 = readonly [number, number, number, number];
export interface CameraPose { position: Position3; rotation: Rotation4 }
export interface CameraDefinition {
  id: CameraId;
  name: string;
  pose: CameraPose;
  fovDegrees: number;
  near: number;
  far: number;
}

export function assertCameraId(id: number): asserts id is CameraId {
  if (!Number.isInteger(id) || id < 1 || id > 9) throw new Error('Identifiant caméra invalide : choisir 1 à 9.');
}

export function validateCamera(definition: CameraDefinition): void {
  assertCameraId(definition.id);
  const { position: [x, y, z], rotation } = definition.pose;
  if (!definition.name.trim() || ![x, y, z, ...rotation, definition.fovDegrees, definition.near, definition.far].every(Number.isFinite)) throw new Error('Paramètres de caméra invalides.');
  if (x < -35 || x > 35 || y < 0.5 || y > 25 || z < -35 || z > 25) throw new Error('Position caméra hors limites.');
  if (rotation.length !== 4 || Math.abs(Math.hypot(...rotation) - 1) > 1e-5) throw new Error('Rotation caméra invalide.');
  if (definition.fovDegrees < 20 || definition.fovDegrees > 90 || definition.near <= 0 || definition.far <= definition.near) throw new Error('Objectif caméra invalide.');
}

export function lookAtRotation(position: Position3, target: Position3): Rotation4 {
  const [dx, dy, dz] = target.map((value, index) => value - position[index]);
  if (![dx, dy, dz].every(Number.isFinite) || Math.hypot(dx, dy, dz) < 1e-6) throw new Error('Cible de visée invalide.');
  const yaw = Math.atan2(dx, dz) / 2;
  const pitch = -Math.atan2(dy, Math.hypot(dx, dz)) / 2;
  return [Math.cos(yaw) * Math.sin(pitch), Math.sin(yaw) * Math.cos(pitch), -Math.sin(yaw) * Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
}

export function cloneCamera(definition: CameraDefinition): CameraDefinition {
  return { ...definition, pose: { position: [...definition.pose.position], rotation: [...definition.pose.rotation] } };
}
