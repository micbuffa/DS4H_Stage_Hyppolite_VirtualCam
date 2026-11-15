import type { Position3 } from '../cameras/cameraDefinition';
import type { TravelObstacle } from '../cameras/travelCollision';
import { validateConcertLayout, drumRiserLayout, stageLayout, screenLayout } from './concertLayout';
import type { StageDefinition } from './concertLayout';
import type { ScreenDefinition } from '../screens/screenDefinition';
import { panelPlacement, previewPlacement } from '../direction/panelLayout';

function bounds(id: string, label: string, min: number[], max: number[]): TravelObstacle {
  return Object.freeze({ id, label, min: Object.freeze(min) as unknown as Position3, max: Object.freeze(max) as unknown as Position3 });
}
function box(id: string, label: string, size: Position3, center: Position3): TravelObstacle {
  return bounds(id, label, center.map((value, i) => value - size[i] / 2), center.map((value, i) => value + size[i] / 2));
}

/** Conservative AABB of a box in the tilted panel's coordinate system. */
function panelBox(id: string, label: string, min: Position3, max: Position3): TravelObstacle {
  const corners: number[][] = [], cosine = Math.cos(panelPlacement.tilt), sine = Math.sin(panelPlacement.tilt);
  for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) {
    corners.push([x + panelPlacement.position[0], y * cosine - z * sine + panelPlacement.position[1], y * sine + z * cosine + panelPlacement.position[2]]);
  }
  return bounds(id, label, [0, 1, 2].map((axis) => Math.min(...corners.map((p) => p[axis]))), [0, 1, 2].map((axis) => Math.max(...corners.map((p) => p[axis]))));
}

/** Explicit envelopes of fixed structures, not arbitrary mesh-name discovery. */
export function createConcertTravelObstacles(stage: StageDefinition = stageLayout, screens: readonly ScreenDefinition[] = screenLayout): readonly TravelObstacle[] {
  validateConcertLayout(stage, screens);
  const { width, depth, height, centerZ, roofY, groundSize } = stage;
  const front = centerZ - depth / 2, back = centerZ + depth / 2;
  const riser = drumRiserLayout(stage);
  const obstacles: TravelObstacle[] = [
    bounds('ground', 'sol', [-groundSize / 2, -100, -groundSize / 2], [groundSize / 2, 0, groundSize / 2]),
    box('deck', 'plateau', [width, height + 0.08, depth + 0.4], [0, height / 2, centerZ - 0.1]),
    box('backdrop', 'fond de scène', [width, roofY - height - 0.5, 0.2], [0, (roofY + height) / 2 - 0.25, back + 0.2]),
    box('roof', 'toit', [width + 1.5, 0.5, depth + 1.4], [0, roofY + 0.225, centerZ]),
    box('riser', 'estrade batterie', [riser.width, riser.height, riser.depth], [0, height + riser.height / 2, riser.centerZ]),
    box('barrier', 'barrière du public', [44.65, 1.28, 0.7], [0, 0.6, 0]),
  ];
  for (const x of [-width / 2, width / 2]) {
    for (const z of [front, back]) obstacles.push(box(`tower-${x}-${z}`, 'pilier et embase', [0.9, roofY - height + 0.56, 0.9], [x, (roofY + height) / 2, z]));
    obstacles.push(box(`side-${x}`, 'treillis latéral', [0.56, 0.56, depth + 0.12], [x, roofY, centerZ]));
  }
  for (const z of [front, back]) obstacles.push(box(`span-${z}`, 'treillis transversal', [width + 0.12, 0.56, 0.56], [0, roofY, z]));
  for (let i = 0; i < 4; i++) obstacles.push(box(`step-${i}`, 'escalier', [2, height * (i + 1) / 4, 0.5], [-width / 2 + 2, height * (i + 1) / 8, front - 1.75 + i * 0.5]));
  for (const sign of [-1, 1]) {
    obstacles.push(box(`speakers-${sign}`, 'enceintes suspendues', [1.25, 3.45, 1.135], [sign * (width / 2 - 1), 7.2, front + 0.4825]));
    for (let i = 0; i < 2; i++) obstacles.push(box(`sub-${sign}-${i}`, 'caisson de basses', [1.6, 1, 1.4], [sign * (width / 2 - 0.9 - i * 1.7), 0.5, front - 0.9]));
  }
  for (const screen of screens) {
    const { id, width, height, position: { x, y, z } } = screen;
    obstacles.push(box(`screen-${id}`, `écran ${id}`, [width + 0.5, height + 0.5, 0.5], [x, y, z]));
    if (id !== 3) for (const side of [-1, 1]) obstacles.push(box(`screen-${id}-support-${side}`, `support écran ${id}`, [0.28, y, 0.4], [x + side * (width / 2 - 0.25), y / 2, z + 0.3]));
  }
  obstacles.push(
    panelBox('panel', 'pupitre', [-panelPlacement.width / 2, -panelPlacement.height / 2, -0.5], [panelPlacement.width / 2, panelPlacement.height / 2, 0.2]),
    panelBox('preview', 'moniteur hors direct', [previewPlacement.x - 2.15, -3.15, -0.5], [previewPlacement.x + 2.15, 3.15, 0.2]),
    panelBox('preview-bridge', 'raccord du pupitre', [previewPlacement.x + 2.15, -3.1, -0.175], [-panelPlacement.width / 2, -2.8, 0.175]),
  );
  return Object.freeze(obstacles);
}
