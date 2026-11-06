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

export function createRoutingRenderer(scene: Scene, screens: ReturnType<typeof createScreens>, cameras: ReturnType<typeof createCaptureCameras>, dependencies = { createFeed: createCameraFeed, waitForPresentation: watchSceneReadiness }) {
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
  const router = new FeedRouter<BaseTexture>({
    screens: ports,
    createFeed: (id) => dependencies.createFeed(scene, cameras.rigs.get(id)!.camera),
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
  return { prepare: (routes: RoutingTable) => router.prepare(routes), stats: () => router.stats(), dispose };
}
