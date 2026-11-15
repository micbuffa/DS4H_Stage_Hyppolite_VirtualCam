import type { Position3 } from '../cameras/cameraDefinition';
import { travelWaypoints } from '../cameras/travelPath';

export const transitionModes = ['cut', 'dissolve', 'dip-black', 'wipe', 'rolling-cubes', 'mosaic', 'grid-morph', 'glitch', 'zoom', 'luma-wipe', 'virtual-travel', 'split'] as const;
export type TransitionMode = typeof transitionModes[number];
export type TransitionOrder = 'simultaneous' | 'staggered';
export type WipeDirection = 'left' | 'right' | 'up' | 'down';

export interface TransitionSettings {
  readonly mode: TransitionMode;
  readonly durationMs: number;
  readonly order: TransitionOrder;
  readonly screenOrder: readonly (1 | 2 | 3)[];
  readonly delayMs: number;
  readonly waypoints: readonly Position3[];
  readonly parameters: Readonly<{ direction: WipeDirection; columns: number; rows: number; seed: number; strength: number }>;
}
export interface TransitionInput {
  mode?: string;
  durationMs?: number;
  order?: string;
  screenOrder?: readonly number[];
  delayMs?: number;
  waypoints?: readonly Position3[];
  parameters?: Partial<{ direction: string; columns: number; rows: number; seed: number; strength: number }>;
}

function bounded(value: number, min: number, max: number, step?: number): number {
  if (!Number.isFinite(value)) throw new Error('Paramètre de transition non fini.');
  const clamped = Math.max(min, Math.min(max, value));
  return step ? Math.round(clamped / step) * step : clamped;
}

/** Owns copies of every parameter: later UI edits cannot change an active command. */
export function transitionSettings(input: TransitionInput = {}): TransitionSettings {
  const mode = input.mode ?? 'cut';
  if (!transitionModes.includes(mode as TransitionMode)) throw new Error('Mode de transition inconnu.');
  const travel = mode === 'virtual-travel';
  const duration = bounded(input.durationMs ?? (travel ? 2000 : 600), travel ? 500 : 100, travel ? 10000 : 3000, travel ? 500 : 100);
  const order = input.order ?? 'simultaneous';
  if (order !== 'simultaneous' && order !== 'staggered') throw new Error('Ordre de transition invalide.');
  const screens = input.screenOrder ?? [3, 1, 2];
  if (screens.length !== 3 || new Set(screens).size !== 3 || screens.some((id) => ![1, 2, 3].includes(id))) throw new Error('Ordre des écrans invalide.');
  const p = input.parameters ?? {};
  const direction = p.direction ?? 'left';
  if (!['left', 'right', 'up', 'down'].includes(direction)) throw new Error('Direction de volet invalide.');
  const seed = p.seed ?? 0;
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Graine de transition invalide.');
  return Object.freeze({
    mode: mode as TransitionMode, durationMs: mode === 'cut' ? 0 : duration,
    order: travel ? 'staggered' : order,
    screenOrder: Object.freeze([...screens]) as readonly (1 | 2 | 3)[],
    delayMs: bounded(input.delayMs ?? 0, 0, 1000, 100),
    waypoints: travelWaypoints(input.waypoints),
    parameters: Object.freeze({ direction: direction as WipeDirection,
      columns: bounded(p.columns ?? 8, 1, 32, 1), rows: bounded(p.rows ?? 4, 1, 18, 1), seed,
      strength: bounded(p.strength ?? 0.3, 0, 1) }),
  });
}
