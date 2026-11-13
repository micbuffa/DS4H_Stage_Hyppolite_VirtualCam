import { lookAtRotation } from './cameraDefinition';
import type { CameraDefinition, CameraPose, Position3 } from './cameraDefinition';

export function degreesToRadians(degrees: number): number {
  if (!Number.isFinite(degrees)) throw new Error('Angle non fini.');
  return degrees * Math.PI / 180;
}
export function radiansToDegrees(radians: number): number {
  if (!Number.isFinite(radians)) throw new Error('Angle non fini.');
  return radians * 180 / Math.PI;
}
export function boundedFov(degrees: number): number {
  if (!Number.isFinite(degrees)) throw new Error('FOV non fini.');
  return Math.max(20, Math.min(90, degrees));
}
export function boundedPose(pose: CameraPose): CameraPose {
  if (pose.position.length !== 3 || pose.rotation.length !== 4 || ![...pose.position, ...pose.rotation].every(Number.isFinite)) throw new Error('Pose non finie ou incomplète.');
  if (Math.abs(Math.hypot(...pose.rotation) - 1) > 1e-5) throw new Error('Quaternion invalide.');
  const [x, y, z] = pose.position;
  return { position: [Math.max(-35, Math.min(35, x)), Math.max(0.5, Math.min(25, y)), Math.max(-35, Math.min(25, z))], rotation: [...pose.rotation] };
}
export function aimAt(camera: CameraDefinition, target: Position3 = [0, 3, 10]): CameraPose {
  return { position: [...camera.pose.position], rotation: lookAtRotation(camera.pose.position, target) };
}
