import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { Point3 } from '../../../../domain/concert/bandLayout';
import { modelGeometry } from '../modelGeometry';
import type { InstrumentMaterials } from './instrumentMaterials';

export function createDrumKit(scene: Scene, parent: TransformNode, materials: InstrumentMaterials) {
  const root = new TransformNode(`${parent.name}-drums`, scene);
  root.parent = parent;
  const g = modelGeometry(scene, root, root.name, 'instruments', parent.name);
  const bass = g.cylinder('kick-shell', 0.88, 0.56, [0, 0.45, -0.87], materials.accent);
  bass.rotation.x = Math.PI / 2;
  for (const z of [-1.16, -0.58]) {
    const rim = g.cylinder(`kick-rim-${z}`, 0.92, 0.035, [0, 0.45, z], materials.chrome);
    rim.rotation.x = Math.PI / 2;
  }
  const head = g.cylinder('kick-front-head', 0.85, 0.015, [0, 0.45, -1.19], materials.ivory);
  head.rotation.x = Math.PI / 2;
  const port = g.cylinder('kick-head-port', 0.18, 0.02, [0.2, 0.3, -1.21], materials.black);
  port.rotation.x = Math.PI / 2;
  const drums: Array<{ name: string; position: Point3; diameter: number; height: number }> = [
    { name: 'tom-left', position: [-0.35, 1.02, -0.68], diameter: 0.44, height: 0.35 },
    { name: 'tom-right', position: [0.35, 1.02, -0.68], diameter: 0.48, height: 0.36 },
    { name: 'floor-tom', position: [0.88, 0.64, -0.35], diameter: 0.6, height: 0.5 },
    { name: 'snare', position: [-0.65, 0.8, -0.35], diameter: 0.5, height: 0.2 },
  ];
  for (const { name, position: [x, y, z], diameter, height } of drums) {
    g.cylinder(`${name}-shell`, diameter, height, [x, y, z], materials.accent);
    g.cylinder(`${name}-rim`, diameter + 0.03, 0.035, [x, y + height / 2, z], materials.chrome);
    g.cylinder(`${name}-head`, diameter - 0.04, 0.012, [x, y + height / 2 + 0.02, z], materials.ivory);
    g.rod(`${name}-stand`, [x, 0.03, z], [x, y - height / 2, z], 0.035, materials.chrome);
  }
  for (const [name, x, y, z, diameter] of [
    ['crash', -1.1, 1.52, -0.9, 0.86], ['ride', 1.12, 1.45, -0.85, 0.95], ['hi-hat', -0.95, 1.04, -0.1, 0.55],
  ] as const) {
    g.rod(`${name}-stand`, [x, 0.03, z], [x, y + 0.05, z], 0.025, materials.chrome);
    g.cylinder(`${name}-cymbal`, diameter, 0.025, [x, y, z], materials.gold);
    g.sphere(`${name}-bell`, [0.16, 0.07, 0.16], [x, y + 0.04, z], materials.gold);
    for (let i = 0; i < 3; i++) g.rod(`${name}-foot-${i}`, [x, 0.2, z], [x + 0.27 * Math.cos(i * 2.094), 0.02, z + 0.27 * Math.sin(i * 2.094)], 0.025, materials.chrome);
  }
  g.cylinder('stool-seat', 0.4, 0.1, [0, 0.49, 0.1], materials.black);
  g.rod('stool-leg', [0, 0.01, 0.1], [0, 0.46, 0.1], 0.07, materials.chrome);
  return root;
}
