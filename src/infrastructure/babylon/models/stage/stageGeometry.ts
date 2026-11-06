import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Material } from '@babylonjs/core/Materials/material';
import type { Scene } from '@babylonjs/core/scene';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';

export function stageGeometry(scene: Scene, root: TransformNode) {
  const box = (name: string, size: readonly [number, number, number], position: readonly [number, number, number], material: Material) => {
    const mesh = CreateBox(name, { width: size[0], height: size[1], depth: size[2] }, scene);
    mesh.position.set(...position);
    mesh.parent = root;
    mesh.material = material;
    mesh.isPickable = false;
    mesh.metadata = { category: 'concert', theme: 'stage' };
    return mesh;
  };
  const beam = (name: string, start: Vector3, end: Vector3, diameter: number, material: Material) => {
    const direction = end.subtract(start);
    const mesh = CreateCylinder(name, { height: direction.length(), diameter, tessellation: 6 }, scene);
    mesh.position.copyFrom(start.add(end).scale(0.5));
    mesh.rotationQuaternion = Quaternion.Identity();
    Quaternion.FromUnitVectorsToRef(Vector3.Up(), direction.normalize(), mesh.rotationQuaternion);
    mesh.parent = root;
    mesh.material = material;
    mesh.isPickable = false;
    mesh.metadata = { category: 'concert', theme: 'stage' };
    return mesh;
  };
  return { box, beam };
}
