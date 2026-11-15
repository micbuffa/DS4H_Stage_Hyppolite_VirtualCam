import { feedSizeFor } from '../../../domain/rendering/feedQuality';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { BaseTexture } from '@babylonjs/core/Materials/Textures/baseTexture';
import type { Scene } from '@babylonjs/core/scene';
import type { createScreens } from '../models/screens/createScreens';
import type { createCaptureCameras } from '../cameras/createCaptureCameras';
import { createTestPattern } from '../models/screens/testPattern';
import { FeedRouter } from '../../../application/commands/feedRouter';
import type { RoutingTable, ScreenId } from '../../../domain/direction/screenRouting';
import type { ScreenTexturePort } from '../../../application/ports/cameraFeed';
import { createCameraFeed } from './createCameraFeed';
import { watchSceneReadiness } from '../engine/watchSceneReadiness';
import { createTransitionComposition } from './createTransitionComposition';
import { createTransitionDriver } from './createTransitionDriver';
import type { TransitionCompositionPort } from '../../../application/ports/transition';
import { createTravelCameraFeed } from '../cameras/createTravelCameraFeed';
import { createTravelComposition } from './createTravelComposition';
import type { TransitionSurfaces } from './createTransitionComposition';

interface RoutingRendererDependencies {
  createFeed: typeof createCameraFeed;
  waitForPresentation: typeof watchSceneReadiness;
  createComposition?: (scene: Scene, screens: ReturnType<typeof createScreens>) => TransitionCompositionPort<BaseTexture>;
}

export function createRoutingRenderer(scene: Scene, screens: ReturnType<typeof createScreens>, cameras: ReturnType<typeof createCaptureCameras>, dependencies: RoutingRendererDependencies = { createFeed: createCameraFeed, waitForPresentation: watchSceneReadiness }) {
  const previous = screens.screens.map((screen) => screen.material.emissiveTexture);
  const fallbacks = screens.screens.map((screen) => {
    const texture = RawTexture.CreateRGBATexture(createTestPattern(screen.definition.id, screen.definition.name, true), 512, 288, scene, false, false, Texture.NEAREST_SAMPLINGMODE);
    texture.name = `screen-${screen.definition.id}-no-signal`;
    screen.material.emissiveTexture = texture;
    return texture;
  });
  const ports = new Map<ScreenId, ScreenTexturePort<BaseTexture>>(screens.screens.map((screen) => [screen.definition.id, {
    getTexture: () => screen.material.emissiveTexture,
    setTexture: (texture) => { screen.material.emissiveTexture = texture; },
  }]));
  let quality = 'standard';
  const router = new FeedRouter<BaseTexture>({
    screens: ports,
    createFeed: (id) => dependencies.createFeed(scene, cameras.rigs.get(id)!.camera, feedSizeFor(quality)),
    createTemporary: (pose) => createTravelCameraFeed(scene, cameras.root, pose, feedSizeFor(quality), dependencies.createFeed),
    waitForPresentation: () => dependencies.waitForPresentation(scene),
  });
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    scene.onDisposeObservable.remove(onDispose);
    router.dispose();
    screens.screens.forEach((screen, index) => { screen.material.emissiveTexture = previous[index]; });
    fallbacks.forEach((texture) => texture.dispose());
  };
  const onDispose = scene.onDisposeObservable.add(dispose);
  return {
    createTravelComposition: (surfaces: TransitionSurfaces) => createTravelComposition(scene, surfaces, router, dependencies.waitForPresentation),
    createTransitionDriver: (document: Document) => createTransitionDriver(scene, document, router, (dependencies.createComposition ?? createTransitionComposition)(scene, screens), createTravelComposition(scene, screens, router, dependencies.waitForPresentation)),
    prepare: (routes: RoutingTable, signal?: AbortSignal) => router.prepare(routes, signal),
    stats: () => router.stats(),
    retain: router.retain.bind(router),
    retainTemporary: router.retainTemporary.bind(router),
    referenceTexture: (id: ScreenId) => ports.get(id)!.getTexture(),
    async setQuality(next: string) {
      const size = feedSizeFor(next);
      if (disposed) throw new Error('La régie est arrêtée.');
      if (next === quality) return;
      await router.replaceFeeds((id) => dependencies.createFeed(scene, cameras.rigs.get(id)!.camera, size));
      quality = next;
    },
    dispose,
  };
}
