import '@babylonjs/core/Meshes/instancedMesh';
import type { InstancedMesh } from '@babylonjs/core/Meshes/instancedMesh';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import { audienceDefaults, layoutAudience } from '../../../../domain/concert/audienceLayout';
import { createModelGroup } from '../modelGroup';
import { createSpectatorTemplate } from './createSpectatorTemplate';

export function createAudience(scene: Scene, options = audienceDefaults) {
  const placements = layoutAudience(options);
  const group = createModelGroup(scene, 'audience');
  const templates = new Map<number, Mesh>();
  const spectators: InstancedMesh[] = [];
  const metadata = { category: 'concert', theme: 'audience' };
  try {
    const material = placements.length ? group.material('clothing', '#ffffff') : undefined;
    material?.specularColor.setAll(0);
    for (const [index, placement] of placements.entries()) {
      let template = templates.get(placement.style);
      if (!template) {
        template = createSpectatorTemplate(scene, placement.style);
        template.parent = group.root;
        template.material = material!;
        template.isVisible = false;
        template.isPickable = false;
        template.metadata = metadata;
        templates.set(placement.style, template);
      }
      const spectator = template.createInstance(`audience-member-${index + 1}`);
      spectator.parent = group.root;
      spectator.isVisible = true;
      spectator.isPickable = false;
      spectator.metadata = metadata;
      spectator.position.set(placement.x, 0, placement.z);
      spectator.rotation.y = placement.yaw;
      spectator.scaling.setAll(placement.scale);
      spectators.push(spectator);
    }
    return { root: group.root, spectators, dispose: group.dispose };
  } catch (error) {
    group.dispose();
    throw error;
  }
}
