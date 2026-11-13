import { SpotLight } from '@babylonjs/core/Lights/spotLight';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { DecorObject } from '../../../../domain/decors/decorDocument';

export function createDecorLight(scene: Scene, root: TransformNode, material: StandardMaterial, object: DecorObject) {
  const housing = CreateCylinder(object.id + '-housing', {height: 0.7, diameter: 0.65, tessellation: 12}, scene);
  housing.parent = root; housing.material = material;
  const beamMaterial = material.clone(object.id + '-beam-material');
  beamMaterial.disableLighting = true; beamMaterial.emissiveColor = Color3.FromHexString(object.color);
  beamMaterial.alpha = 0.075; beamMaterial.backFaceCulling = false; beamMaterial.disableDepthWrite = true;
  const cone = CreateCylinder(object.id + '-beam', {height: 8, diameterTop: 0.12, diameterBottom: 4.5, tessellation: 20}, scene);
  cone.parent = root; cone.position.y = -4.2; cone.material = beamMaterial; cone.isPickable = false;
  const light = new SpotLight(object.id + '-light', Vector3.Zero(), new Vector3(0, -1, 0), Math.PI / 3, 2, scene);
  light.parent = root; light.diffuse = Color3.FromHexString(object.color); light.intensity = object.intensity; light.range = 24;
  return { cone, light, beamMaterial };
}
