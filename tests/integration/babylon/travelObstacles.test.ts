import { expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { createStage } from '../../../src/infrastructure/babylon/models/stage/createStage';
import { createScreens } from '../../../src/infrastructure/babylon/models/screens/createScreens';
import { createPreviewMonitor } from '../../../src/infrastructure/babylon/ui/createPreviewMonitor';
import { createDirectorPanel } from '../../../src/infrastructure/babylon/ui/createDirectorPanel';
import { stageLayout, screenLayout } from '../../../src/domain/concert/concertLayout';
import { createConcertTravelObstacles } from '../../../src/domain/concert/travelObstacles';

it('contains the actual fixed stage, screen and tilted preview geometry in the explicit obstacle envelopes', () => {
  const engine = new NullEngine(); const scene = new Scene(engine);
  const stage = createStage(scene, stageLayout), screens = createScreens(scene, screenLayout);
  const labels = (scene: Scene) => ({ texture: RawTexture.CreateRGBATexture(new Uint8Array([0, 0, 0, 255]), 1, 1, scene), draw() {} });
  const panel = createDirectorPanel(scene, labels);
  const preview = createPreviewMonitor(scene, panel.root, labels);
  try {
    const obstacles = createConcertTravelObstacles();
    const meshes = [...stage.root.getChildMeshes(), ...screens.root.getChildMeshes(), ...panel.root.getChildMeshes()];
    expect(meshes.length).toBeGreaterThan(300);
    const missing: string[] = [];
    for (const mesh of meshes) {
      mesh.computeWorldMatrix(true);
      const { minimumWorld: min, maximumWorld: max } = mesh.getBoundingInfo().boundingBox;
      const contained = obstacles.some((o) => [0, 1, 2].every((axis) => min.asArray()[axis] >= o.min[axis] - 1e-5 && max.asArray()[axis] <= o.max[axis] + 1e-5));
      if (!contained) missing.push(mesh.name);
    }
    expect(missing, 'Volumes explicites manquants ou trop petits').toEqual([]);
  } finally { preview.dispose(); panel.dispose(); screens.dispose(); stage.dispose(); scene.dispose(); engine.dispose(); }
});
