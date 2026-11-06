import { expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CameraRegistry } from '../../../src/domain/cameras/cameraRegistry';
import { createCameraPresets } from '../../../src/domain/cameras/cameraPresets';
import { createConcertScene } from '../../../src/infrastructure/babylon/engine/createObservationScene';
import { createCaptureCameras } from '../../../src/infrastructure/babylon/cameras/createCaptureCameras';
import { createCameraFeed } from '../../../src/infrastructure/babylon/rendering/createCameraFeed';

it('registers one fixed-size feed, filters all three surfaces and keeps late filmable objects', async () => {
  const engine = new NullEngine();
  const { scene, screens } = createConcertScene(engine);
  const registry = new CameraRegistry(createCameraPresets());
  const cameras = createCaptureCameras(scene, registry);
  const observer = scene.activeCamera;
  const textures = [...scene.textures];
  const source = cameras.rigs.get(1)!.camera;
  const feed = createCameraFeed(scene, source);
  try {
    expect(scene.customRenderTargets).toEqual([feed.texture]);
    expect(feed.texture.activeCamera).toBe(source);
    expect(feed.texture.getSize()).toEqual({ width: 1024, height: 576 });
    expect(feed.texture.forceLayerMaskCheck).toBe(true);
    expect(feed.texture.renderList!.every((mesh) => mesh.metadata?.category === 'concert')).toBe(true);
    for (const screen of screens.screens) {
      expect(feed.texture.renderList).not.toContain(screen.surface);
      expect(feed.texture.renderList).toContain(screen.frame);
    }
    const late = CreateBox('late-musician', {}, scene);
    late.metadata = { category: 'concert', theme: 'musicians' };
    const unknown = CreateBox('unclassified', {}, scene);
    scene.onBeforeRenderObservable.notifyObservers(scene);
    expect(feed.texture.renderList).toContain(late);
    expect(feed.texture.renderList).not.toContain(unknown);
    registry.select(5);
    expect(feed.texture.activeCamera).toBe(source);
    expect(scene.customRenderTargets).toHaveLength(1);
    const ready = vi.fn();
    feed.ready.then(ready, () => undefined);
    feed.texture.isReadyForRendering();
    vi.spyOn(feed.texture, 'isReadyForRendering').mockReturnValue(true);
    feed.texture.onAfterRenderObservable.notifyObservers(0); // Readiness-only event, not a drawn frame.
    scene.onAfterRenderObservable.notifyObservers(scene);
    await Promise.resolve();
    expect(ready).not.toHaveBeenCalled();
    expect(scene.activeCamera).toBe(observer);
    const rejected = expect(feed.ready).rejects.toThrow('annulée');
    feed.dispose(); feed.dispose();
    await rejected;
    expect(scene.customRenderTargets).toHaveLength(0);
    expect(scene.textures).toEqual(textures);
  } finally { cameras.dispose(); scene.dispose(); engine.dispose(); }
});
