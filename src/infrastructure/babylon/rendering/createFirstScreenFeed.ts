import type { Scene } from '@babylonjs/core/scene';
import type { Camera } from '@babylonjs/core/Cameras/camera';
import type { BaseTexture } from '@babylonjs/core/Materials/Textures/baseTexture';
import type { createScreens } from '../models/screens/createScreens';
import { bindPreparedFeed } from '../../../application/commands/bindPreparedFeed';
import { createCameraFeed } from './createCameraFeed';
import { watchSceneReadiness } from '../engine/watchSceneReadiness';

type ScreenSurface = ReturnType<typeof createScreens>['screens'][number];

export function createFirstScreenFeed(scene: Scene, camera: Camera, screen: ScreenSurface) {
  const feed = createCameraFeed(scene, camera);
  const binding = bindPreparedFeed<BaseTexture>(feed, {
    getTexture: () => screen.material.emissiveTexture,
    setTexture: (texture) => { screen.material.emissiveTexture = texture; },
  });
  let disposed = false;
  let presentation: ReturnType<typeof watchSceneReadiness> | undefined;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    scene.onDisposeObservable.remove(onDispose);
    presentation?.dispose();
    binding.dispose();
  };
  const onDispose = scene.onDisposeObservable.add(dispose);
  const ready = binding.ready.then(() => {
    if (disposed) throw new Error('Diffusion annulée.');
    // The material was switched between frames. Wait until it has been presented.
    presentation = watchSceneReadiness(scene);
    return presentation.ready;
  }).catch((error: unknown) => { dispose(); throw error; });
  return { texture: feed.texture, ready, dispose, onFrameRendered: feed.onFrameRendered };
}
