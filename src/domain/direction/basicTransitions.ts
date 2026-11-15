import type { TransitionMode, WipeDirection } from './transitionDefinition';

export const basicTransitionModes = ['cut', 'dissolve', 'dip-black', 'wipe'] as const;
export const availableTransitionModes = [...basicTransitionModes, 'rolling-cubes', 'mosaic', 'grid-morph', 'glitch', 'zoom', 'luma-wipe', 'split', 'virtual-travel'] as const;
export const transitionNames: Partial<Record<TransitionMode, string>> = { cut: 'Coupe', dissolve: 'Fondu enchaîné', 'dip-black': 'Fondu au noir', wipe: 'Volet', 'rolling-cubes': 'Rolling Cubes', mosaic: 'Mosaïque', 'grid-morph': 'Grid Morph', glitch: 'Glitch', zoom: 'Zoom', 'luma-wipe': 'Volet de luminance', split: 'Écran partagé', 'virtual-travel': 'Trajet virtuel' };
export const wipeDirections: readonly WipeDirection[] = ['left', 'right', 'up', 'down'];
export const wipeNames: Record<WipeDirection, string> = { left: 'Depuis la gauche', right: 'Depuis la droite', up: 'Depuis le haut', down: 'Depuis le bas' };

/** Reference weights for validation; UV uses the mesh convention (Y grows upwards). */
export function basicTransitionWeights(mode: TransitionMode, progress: number, uv: readonly [number, number] = [0.5, 0.5], direction: WipeDirection = 'left'): readonly [number, number] {
  if (!Number.isFinite(progress) || progress < 0 || progress > 1 || !uv.every(Number.isFinite)) throw new Error('Progression de transition invalide.');
  if (progress === 0) return [1, 0];
  if (progress === 1 || mode === 'cut') return [0, 1];
  if (mode === 'dissolve') return [1 - progress, progress];
  if (mode === 'dip-black') return progress < 0.5 ? [1 - progress * 2, 0] : [0, progress * 2 - 1];
  if (mode === 'wipe') {
    const coordinate = direction === 'left' ? uv[0] : direction === 'right' ? 1 - uv[0] : direction === 'up' ? 1 - uv[1] : uv[1];
    return coordinate < progress ? [0, 1] : [1, 0];
  }
  throw new Error('Effet fondamental indisponible.');
}
