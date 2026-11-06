import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Material } from '@babylonjs/core/Materials/material';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import type { Point3 } from '../../../domain/concert/bandLayout';

/** Primitives owned by the enclosing model group, with explicit filming metadata. */
export function modelGeometry(scene: Scene, parent: TransformNode, prefix: string, theme: 'musicians' | 'instruments', performer: string) {
  const attach = (mesh: Mesh, position: Point3, material: Material) => {
    mesh.parent = parent;
    mesh.position.set(...position);
    mesh.material = material;
    mesh.isPickable = false;
    mesh.metadata = { category: 'concert', theme, performer };
    return mesh;
  };
  return {
    node(name: string) {
      const node = new TransformNode(`${prefix}-${name}`, scene);
      node.parent = parent;
      return node;
    },
    box(name: string, size: Point3, position: Point3, material: Material) {
      return attach(CreateBox(`${prefix}-${name}`, { width: size[0], height: size[1], depth: size[2] }, scene), position, material);
    },
    sphere(name: string, size: Point3, position: Point3, material: Material) {
      return attach(CreateSphere(`${prefix}-${name}`, { diameterX: size[0], diameterY: size[1], diameterZ: size[2], segments: 6 }, scene), position, material);
    },
    cylinder(name: string, diameter: number, height: number, position: Point3, material: Material) {
      return attach(CreateCylinder(`${prefix}-${name}`, { diameter, height, tessellation: 16 }, scene), position, material);
    },
    rod(name: string, start: Point3, end: Point3, diameter: number, material: Material) {
      const a = Vector3.FromArray(start);
      const b = Vector3.FromArray(end);
      const direction = b.subtract(a);
      const midpoint = a.add(b).scale(0.5);
      const mesh = attach(CreateCylinder(`${prefix}-${name}`, { diameter, height: direction.length(), tessellation: 8 }, scene), [midpoint.x, midpoint.y, midpoint.z], material);
      mesh.rotationQuaternion = Quaternion.Identity();
      Quaternion.FromUnitVectorsToRef(Vector3.Up(), direction.normalize(), mesh.rotationQuaternion);
      return mesh;
    },
  };
}
