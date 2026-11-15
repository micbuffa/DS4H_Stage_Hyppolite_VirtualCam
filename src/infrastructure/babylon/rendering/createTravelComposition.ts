import type { Scene } from '@babylonjs/core/scene';
import type { BaseTexture } from '@babylonjs/core/Materials/Textures/baseTexture';
import type { TravelSourcePort } from '../../../application/ports/transition';
import { createTravelPass } from '../../../application/commands/createTravelPass';
import { watchSceneReadiness } from '../engine/watchSceneReadiness';
import type { TransitionSurfaces } from './createTransitionComposition';

export function createTravelComposition(scene: Scene, surfaces: TransitionSurfaces, sources: TravelSourcePort<BaseTexture>, waitForPresentation = watchSceneReadiness) {
  return createTravelPass({ sources,
    surfaces: new Map(surfaces.screens.map((screen) => [screen.definition.id, {
      getTexture: () => screen.material.emissiveTexture,
      setTexture: (texture: BaseTexture | null) => { screen.material.emissiveTexture = texture; screen.surface.material = screen.material; },
    }])),
    waitForPresentation: () => waitForPresentation(scene),
  });
}
