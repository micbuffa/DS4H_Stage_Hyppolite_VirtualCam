import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';
import type { BaseTexture } from '@babylonjs/core/Materials/Textures/baseTexture';

export function createModelGroup(scene: Scene, name: string) {
  const root = new TransformNode(name, scene);
  const materials: StandardMaterial[] = [];
  const textures: BaseTexture[] = [];
  let disposed = false;
  return {
    root,
    material(label: string, color: string, emissive = false) {
      const material = new StandardMaterial(`${name}-${label}`, scene);
      material.diffuseColor = Color3.FromHexString(color);
      material.specularColor.setAll(0.12);
      if (emissive) {
        material.disableLighting = true;
        material.emissiveColor = material.diffuseColor;
      }
      materials.push(material);
      return material;
    },
    ownTexture<T extends BaseTexture>(texture: T): T { textures.push(texture); return texture; },
    dispose() {
      if (disposed) return;
      disposed = true;
      root.dispose(false, false);
      materials.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
    },
  };
}
