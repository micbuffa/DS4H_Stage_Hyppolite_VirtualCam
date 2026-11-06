import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { modelGeometry } from '../modelGeometry';
import type { InstrumentMaterials } from './instrumentMaterials';

export function createGuitar(scene: Scene, parent: TransformNode, materials: InstrumentMaterials, bass: boolean) {
  const root = new TransformNode(`${parent.name}-${bass ? 'bass' : 'guitar'}`, scene);
  root.parent = parent;
  root.position.set(-0.12, 1.03, -0.38);
  root.rotation.z = -0.8;
  const g = modelGeometry(scene, root, root.name, 'instruments', parent.name);
  g.sphere('body-lower', [0.48, 0.52, 0.17], [0, -0.1, 0], materials.accent);
  g.sphere('body-upper', [0.37, 0.35, 0.16], [0, 0.16, 0], materials.accent);
  g.box('pickguard', [0.2, 0.3, 0.025], [0.02, 0.02, -0.09], materials.ivory);
  const neckLength = bass ? 1 : 0.85;
  g.box('neck', [0.105, neckLength, 0.07], [0, 0.35 + neckLength / 2, 0], materials.wood);
  g.box('fretboard', [0.095, neckLength, 0.015], [0, 0.35 + neckLength / 2, -0.044], materials.black);
  g.box('headstock', [0.15, 0.24, 0.08], [0, 0.47 + neckLength, 0], materials.wood);
  g.box('bridge', [0.19, 0.035, 0.025], [0, -0.17, -0.1], materials.chrome);
  for (let i = 0; i < (bass ? 4 : 6); i++) {
    const x = (i - (bass ? 1.5 : 2.5)) * 0.012;
    g.rod(`string-${i}`, [x, -0.17, -0.115], [x, 0.4 + neckLength, -0.06], 0.004, materials.chrome);
    g.sphere(`tuner-${i}`, [0.07, 0.035, 0.045], [i % 2 ? -0.1 : 0.1, 0.42 + neckLength + Math.floor(i / 2) * 0.055, 0], materials.chrome);
  }
  for (let i = 0; i < 10; i++) g.box(`fret-${i}`, [0.1, 0.008, 0.007], [0, 0.38 + i * neckLength / 11, -0.055], materials.chrome);
  return root;
}
