import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { validateScreens } from '../../../../domain/screens/screenDefinition';
import type { ScreenDefinition } from '../../../../domain/screens/screenDefinition';
import { createModelGroup } from '../modelGroup';
import { createTestPattern, patternHeight, patternWidth } from './testPattern';

export function createScreens(scene: Scene, definitions: readonly ScreenDefinition[]) {
  validateScreens(definitions);
  const group = createModelGroup(scene, 'screens');
  const frameMaterial = group.material('frame', '#151e28');
  const supportMaterial = group.material('support', '#718191');
  const screens = definitions.map((definition) => {
    const { id, width, height, position } = definition;
    const root = new TransformNode(`screen-${id}`, scene);
    root.parent = group.root;
    root.position.set(position.x, position.y, position.z);
    const frame = CreateBox(`screen-${id}-frame`, { width: width + 0.5, height: height + 0.5, depth: 0.45 }, scene);
    frame.parent = root;
    frame.material = frameMaterial;
    frame.isPickable = false;
    frame.metadata = { category: 'concert', theme: 'screens', screenId: id };
    const surface = CreatePlane(`screen-${id}-surface`, { width, height }, scene);
    surface.parent = root;
    surface.position.z = -0.24;
    surface.isPickable = false;
    surface.metadata = { category: 'video-surface', screenId: id };
    const material = group.material(`video-${id}`, '#ffffff', true);
    material.diffuseColor = Color3.Black();
    material.emissiveColor = Color3.Black(); // StandardMaterial adds this color to the emissive texture.
    const texture = group.ownTexture(RawTexture.CreateRGBATexture(
      createTestPattern(id, definition.name), patternWidth, patternHeight, scene,
      false, false, Texture.NEAREST_SAMPLINGMODE,
    ));
    texture.name = `screen-${id}-test-pattern`;
    material.emissiveTexture = texture;
    surface.material = material;
    if (id !== 3) {
      for (const side of [-1, 1]) {
        const support = CreateBox(`screen-${id}-support-${side}`, { width: 0.28, height: position.y, depth: 0.4 }, scene);
        support.parent = root;
        support.position.set(side * (width / 2 - 0.25), -position.y / 2, 0.3);
        support.material = supportMaterial;
        support.isPickable = false;
        support.metadata = { category: 'concert', theme: 'screens', screenId: id };
      }
    }
    return { definition, root, frame, surface };
  });
  return { ...group, screens };
}
