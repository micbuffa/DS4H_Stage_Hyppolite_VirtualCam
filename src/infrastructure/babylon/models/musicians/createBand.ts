import type { Scene } from '@babylonjs/core/scene';
import { createBandLayout } from '../../../../domain/concert/bandLayout';
import type { StageDefinition } from '../../../../domain/concert/concertLayout';
import { createModelGroup } from '../modelGroup';
import { createMusician } from './createMusician';

export function createBand(scene: Scene, stage: StageDefinition) {
  const definitions = createBandLayout(stage);
  const group = createModelGroup(scene, 'band');
  const musicians: ReturnType<typeof createMusician>[] = [];
  try {
    for (const definition of definitions) {
      const musician = createMusician(scene, definition);
      musician.root.parent = group.root;
      musicians.push(musician);
    }
  } catch (error) {
    musicians.forEach((musician) => musician.dispose());
    group.dispose();
    throw error;
  }
  return {
    root: group.root,
    musicians,
    dispose() {
      musicians.forEach((musician) => musician.dispose());
      group.dispose();
    },
  };
}
