import type { TransitionMode, TransitionSettings } from './transitionDefinition';

export const gridTransitionModes = ['rolling-cubes', 'mosaic', 'grid-morph'] as const;
export const gridPresets = [[4, 2], [8, 4], [16, 9], [32, 18]] as const;
export function isGridTransition(mode: TransitionMode): boolean { return gridTransitionModes.some((item) => item === mode); }

/** Integer arithmetic below 2^24: the GLSL highp implementation uses the same hash. */
export function gridCellOrder(column: number, row: number, columns: number, seed: number): number {
  if (![column, row, columns, seed].every(Number.isSafeInteger) || columns < 1 || columns > 32 || column < 0 || column >= columns || row < 0 || row >= 18 || seed < 0 || seed > 0xffffffff) throw new Error('Case de transition invalide.');
  const reducedSeed = (seed % 4093 + Math.floor(seed / 4093) % 4093) % 4093;
  const value = ((row * columns + column) * 37 + reducedSeed * 17) % 4093;
  return ((value * 61 + 19) % 4093) / 4093;
}

/** Every cell starts in [0,.4), and completes by 1. No hidden temporal randomness. */
export function gridCellProgress(settings: TransitionSettings, progress: number, column: number, row: number): number {
  if (!Number.isFinite(progress) || progress < 0 || progress > 1 || row >= settings.parameters.rows) throw new Error('Progression de grille invalide.');
  const order = gridCellOrder(column, row, settings.parameters.columns, settings.parameters.seed);
  return Math.max(0, Math.min(1, (progress - order * 0.4) / 0.6));
}

export function shaderSeed(seed: number): number { return (seed % 4093 + Math.floor(seed / 4093) % 4093) % 4093; }
