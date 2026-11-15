import type { TransitionMode, TransitionSettings } from './transitionDefinition';
import { shaderSeed } from './gridTransitions';

export const graphicTransitionModes = ['glitch', 'zoom', 'luma-wipe', 'split'] as const;
type Parameters = TransitionSettings['parameters'];
export function hasGraphicSettings(mode: TransitionMode): boolean { return mode === 'glitch' || mode === 'zoom' || mode === 'luma-wipe'; }
function validate(progress: number, uv: readonly number[] = []): void {
  if (![progress, ...uv].every((value) => Number.isFinite(value) && value >= 0 && value <= 1)) throw new Error('Coordonnée ou progression graphique invalide.');
}
export function smoothProgress(progress: number): number { validate(progress); return progress * progress * (3 - 2 * progress); }

/** Stable integer hash, mirrored by GLSL; no frame counter or wall-clock entropy. */
export function graphicNoise(column: number, row: number, seed: number): number {
  const value = (row * 37 + column * 61 + shaderSeed(seed) * 17) % 4093;
  return ((value * 61 + 19) % 4093) / 4093;
}
export function glitchOffset(progress: number, y: number, parameters: Parameters): number {
  validate(progress, [y]);
  if (progress === 0 || progress === 1 || parameters.strength === 0) return 0;
  const phase = Math.min(7, Math.floor(progress * 8));
  const band = Math.min(parameters.rows - 1, Math.floor(y * parameters.rows));
  return (graphicNoise(phase, band, parameters.seed) * 2 - 1) * parameters.strength * 0.08 * 4 * progress * (1 - progress);
}
export function zoomFrame(progress: number, strength: number) {
  validate(progress, [strength]); const weight = smoothProgress(progress);
  return { scaleA: 1 + strength * weight, scaleB: 1 + strength * (1 - weight), weight };
}
/** Continuous value-noise mask, with luminance in [0,1]. Bright areas reveal B first. */
export function proceduralLuminance(uv: readonly [number, number], parameters: Parameters): number {
  validate(0, uv);
  const x = uv[0] * parameters.columns, y = uv[1] * parameters.rows;
  const column = Math.floor(x), row = Math.floor(y), fx = smoothProgress(x - column), fy = smoothProgress(y - row);
  const mix = (a: number, b: number, p: number) => a + (b - a) * p;
  return mix(mix(graphicNoise(column, row, parameters.seed), graphicNoise(column + 1, row, parameters.seed), fx),
    mix(graphicNoise(column, row + 1, parameters.seed), graphicNoise(column + 1, row + 1, parameters.seed), fx), fy);
}
export function lumaWeight(progress: number, uv: readonly [number, number], parameters: Parameters): number {
  validate(progress, uv);
  if (progress === 0 || progress === 1) return progress;
  const mask = proceduralLuminance(uv, parameters), feather = parameters.strength * 0.1;
  const threshold = 1 + feather - progress * (1 + 2 * feather);
  if (feather === 0) return mask >= threshold ? 1 : 0;
  return smoothProgress(Math.max(0, Math.min(1, (mask - threshold + feather) / (2 * feather))));
}
/** Quarter opening, half holding both complete frames, quarter closing onto B. */
export function splitBoundary(progress: number): number {
  validate(progress);
  return progress < 0.25 ? 1 - 0.5 * smoothProgress(progress * 4) : progress <= 0.75 ? 0.5 : 0.5 * (1 - smoothProgress((progress - 0.75) * 4));
}
export function splitSample(progress: number, uv: readonly [number, number]): { source: 'a' | 'b' | 'black'; uv: readonly [number, number] } {
  validate(progress, uv);
  if (progress === 0 || progress === 1) return { source: progress === 0 ? 'a' : 'b', uv };
  const boundary = splitBoundary(progress), from = uv[0] < boundary;
  if (boundary === 0 || boundary === 1) return { source: boundary === 1 ? 'a' : 'b', uv };
  const width = from ? boundary : 1 - boundary;
  const x = (uv[0] - (from ? 0 : boundary)) / width, y = (uv[1] - 0.5) / width + 0.5;
  return { source: y < 0 || y > 1 ? 'black' : from ? 'a' : 'b', uv: [x, y] };
}
