import type { ScreenDefinition } from '../screens/screenDefinition';
import { validateScreens } from '../screens/screenDefinition';

export interface StageDefinition {
  width: number;
  depth: number;
  height: number;
  centerZ: number;
  roofY: number;
  groundSize: number;
}

export const stageLayout: Readonly<StageDefinition> = Object.freeze({
  width: 20, depth: 12, height: 1.5, centerZ: 10, roofY: 11, groundSize: 80,
});

export const screenLayout: readonly ScreenDefinition[] = [
  { id: 1, name: 'GAUCHE', width: 8, height: 4.5, position: { x: -17, y: 7, z: 10 } },
  { id: 2, name: 'DROITE', width: 8, height: 4.5, position: { x: 17, y: 7, z: 10 } },
  { id: 3, name: 'CENTRE', width: 6.4, height: 3.6, position: { x: 0, y: 8, z: 15.7 } },
];

export function validateConcertLayout(stage: StageDefinition, screens: readonly ScreenDefinition[]): void {
  if (!Object.values(stage).every(Number.isFinite) ||
      [stage.width, stage.depth, stage.height, stage.roofY, stage.groundSize].some((value) => value <= 0) ||
      stage.roofY <= stage.height || stage.groundSize < Math.max(stage.width, stage.depth)) {
    throw new Error('Dimensions de scène invalides.');
  }
  validateScreens(screens);
}
