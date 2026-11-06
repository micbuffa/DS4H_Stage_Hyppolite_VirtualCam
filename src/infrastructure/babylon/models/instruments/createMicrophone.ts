import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { modelGeometry } from '../modelGeometry';
import type { InstrumentMaterials } from './instrumentMaterials';

export function createMicrophone(scene: Scene, parent: TransformNode, materials: InstrumentMaterials) {
  const root = new TransformNode(`${parent.name}-microphone`, scene);
  root.parent = parent;
  root.position.z = -0.65;
  const g = modelGeometry(scene, root, root.name, 'instruments', parent.name);
  for (let i = 0; i < 3; i++) {
    const angle = i * Math.PI * 2 / 3;
    g.rod(`foot-${i}`, [0, 0.07, 0], [Math.cos(angle) * 0.32, 0.025, Math.sin(angle) * 0.32], 0.035, materials.black);
  }
  g.rod('stand', [0, 0.04, 0], [0, 1.57, 0], 0.035, materials.chrome);
  g.rod('boom', [0, 1.45, 0], [0.18, 1.69, 0.19], 0.025, materials.chrome);
  g.rod('handle', [0.18, 1.69, 0.1], [0.18, 1.69, 0.3], 0.065, materials.black);
  g.sphere('capsule', [0.1, 0.1, 0.12], [0.18, 1.69, 0.31], materials.chrome);
  return root;
}
