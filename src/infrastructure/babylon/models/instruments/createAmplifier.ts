import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { modelGeometry } from '../modelGeometry';
import type { InstrumentMaterials } from './instrumentMaterials';

export function createAmplifier(scene: Scene, parent: TransformNode, materials: InstrumentMaterials) {
  const root = new TransformNode(`${parent.name}-amplifier`, scene);
  root.parent = parent;
  root.position.set(-0.6, 0, 1.4);
  const g = modelGeometry(scene, root, root.name, 'instruments', parent.name);
  g.box('cabinet', [1, 1, 0.55], [0, 0.5, 0], materials.black);
  g.box('grille', [0.9, 0.85, 0.03], [0, 0.5, -0.29], materials.chrome);
  for (const y of [0.29, 0.71]) {
    const cone = g.cylinder(`cone-${y}`, 0.34, 0.035, [0, y, -0.32], materials.black);
    cone.rotation.x = Math.PI / 2;
  }
  g.box('head', [0.85, 0.25, 0.42], [0, 1.15, 0], materials.black);
  g.box('controls', [0.77, 0.08, 0.025], [0, 1.16, -0.23], materials.gold);
  for (let i = 0; i < 5; i++) g.sphere(`knob-${i}`, [0.035, 0.035, 0.035], [-0.25 + i * 0.1, 1.16, -0.25], materials.ivory);
  return root;
}
