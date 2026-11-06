import { assertCameraId } from '../cameras/cameraDefinition';
import type { CameraId } from '../cameras/cameraDefinition';

export type ScreenId = 1 | 2 | 3;
export type RoutingTable = Record<ScreenId, CameraId | null>;
export const screenIds: readonly ScreenId[] = [1, 2, 3];
export const emptyRouting = (): RoutingTable => ({ 1: null, 2: null, 3: null });

export function assertScreenId(id: number): asserts id is ScreenId {
  if (!Number.isInteger(id) || !screenIds.includes(id as ScreenId)) throw new Error('Identifiant écran invalide : choisir 1 à 3.');
}

export function planRouting(current: RoutingTable, camera: number, targets: readonly number[]): RoutingTable {
  assertCameraId(camera);
  if (!targets.length) throw new Error('Choisir au moins un écran.');
  targets.forEach(assertScreenId);
  const next = { ...current };
  for (const id of targets) next[id as ScreenId] = camera;
  return next;
}

export function sameRouting(a: RoutingTable, b: RoutingTable): boolean {
  return screenIds.every((id) => a[id] === b[id]);
}

export function routingSources(routes: RoutingTable): CameraId[] {
  return [...new Set(screenIds.map((id) => routes[id]).filter((id): id is CameraId => id !== null))];
}
