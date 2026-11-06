import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { drumRiserLayout } from '../../../../domain/concert/concertLayout';
import type { StageDefinition } from '../../../../domain/concert/concertLayout';
import { createModelGroup } from '../modelGroup';
import { stageGeometry } from './stageGeometry';
import { createTruss } from './createTruss';

export function createStage(scene: Scene, layout: StageDefinition) {
  const group = createModelGroup(scene, 'stage');
  const { width, depth, height, centerZ, roofY, groundSize } = layout;
  const frontZ = centerZ - depth / 2;
  const backZ = centerZ + depth / 2;
  const geometry = stageGeometry(scene, group.root);
  const { box } = geometry;
  const ground = group.material('ground', '#202d30');
  const deck = group.material('deck', '#3a424e');
  const black = group.material('black', '#11151c');
  const steel = group.material('steel', '#8695a5');
  const trim = group.material('trim', '#d08d4b', true);
  const grille = group.material('grille', '#303c47');
  const coldTrim = group.material('cold-trim', '#527f94', true);

  box('festival-ground', [groundSize, 0.2, groundSize], [0, -0.12, 0], ground);
  box('stage-deck', [width, height, depth], [0, height / 2, centerZ], deck);
  box('stage-front-skirt', [width, height - 0.1, 0.15], [0, height / 2, frontZ - 0.08], black);
  box('stage-front-trim', [width, 0.08, 0.08], [0, height, frontZ - 0.1], trim);
  for (let x = -width / 2 + 1; x < width / 2; x += 1) {
    box(`deck-seam-${x}`, [0.018, 0.005, depth - 0.2], [x, height + 0.006, centerZ], black);
  }
  box('stage-backdrop', [width, roofY - height - 0.5, 0.2], [0, (roofY + height) / 2 - 0.25, backZ + 0.2], black);
  box('stage-roof', [width + 1.5, 0.35, depth + 1.2], [0, roofY + 0.3, centerZ], black);
  box('stage-roof-edge', [width + 1.5, 0.12, 0.15], [0, roofY + 0.15, frontZ - 0.6], coldTrim);
  for (const x of [-width / 2, width / 2]) {
    for (const z of [frontZ, backZ]) {
      createTruss(geometry, `tower-${x}-${z}`, new Vector3(x, height, z), new Vector3(x, roofY, z), steel);
      box(`tower-base-${x}-${z}`, [0.9, 0.15, 0.9], [x, height + 0.075, z], black);
    }
    createTruss(geometry, `roof-side-${x}`, new Vector3(x, roofY, frontZ), new Vector3(x, roofY, backZ), steel);
  }
  for (const z of [frontZ, backZ]) {
    createTruss(geometry, `roof-span-${z}`, new Vector3(-width / 2, roofY, z), new Vector3(width / 2, roofY, z), steel);
  }
  // Access stairs and a drum riser, ready for the musicians in T03.
  for (let i = 0; i < 4; i++) {
    box(`stage-step-${i}`, [2, height * (i + 1) / 4, 0.5], [-width / 2 + 2, height * (i + 1) / 8, frontZ - 1.75 + i * 0.5], deck);
  }
  const riser = drumRiserLayout(layout);
  box('drum-riser', [riser.width, riser.height, riser.depth], [0, height + riser.height / 2, riser.centerZ], deck);

  for (const sign of [-1, 1]) {
    const x = sign * (width / 2 - 1);
    for (let i = 0; i < 5; i++) {
      box(`speaker-${sign}-${i}`, [1.25, 0.65, 1.1], [x, 8.6 - i * 0.7, frontZ + 0.5], black);
      box(`speaker-grille-${sign}-${i}`, [1.1, 0.48, 0.03], [x, 8.6 - i * 0.7, frontZ - 0.07], grille);
    }
    for (let i = 0; i < 2; i++) {
      box(`subwoofer-${sign}-${i}`, [1.6, 1, 1.4], [sign * (width / 2 - 0.9 - i * 1.7), 0.5, frontZ - 0.9], black);
    }
  }
  for (let x = -22; x <= 22; x += 2) {
    box(`barrier-post-${x}`, [0.08, 1.2, 0.08], [x, 0.6, 0], steel);
    box(`barrier-foot-${x}`, [0.65, 0.08, 0.7], [x, 0.04, 0], black);
    if (x < 22) {
      box(`barrier-top-${x}`, [2, 0.08, 0.08], [x + 1, 1.2, 0], steel);
      for (let i = 1; i <= 4; i++) box(`barrier-bar-${x}-${i}`, [0.035, 1.05, 0.035], [x + i * 0.4, 0.6, 0], steel);
    }
  }
  return group;
}
