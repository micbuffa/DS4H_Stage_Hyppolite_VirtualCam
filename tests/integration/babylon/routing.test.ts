import { expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { CameraRegistry } from '../../../src/domain/cameras/cameraRegistry';
import { createCameraPresets } from '../../../src/domain/cameras/cameraPresets';
import { RoutingDirector } from '../../../src/application/commands/routingDirector';
import { createConcertScene } from '../../../src/infrastructure/babylon/engine/createObservationScene';
import { createCaptureCameras } from '../../../src/infrastructure/babylon/cameras/createCaptureCameras';
import { createCameraFeed } from '../../../src/infrastructure/babylon/rendering/createCameraFeed';
import { createRoutingRenderer } from '../../../src/infrastructure/babylon/rendering/createRoutingRenderer';

it('shares native textures, releases the last consumer once and restores all screen resources', async () => {
  const engine = new NullEngine();
  const { scene, screens } = createConcertScene(engine);
  const registry = new CameraRegistry(createCameraPresets());
  const cameras = createCaptureCameras(scene, registry);
  const originals = screens.screens.map((screen) => screen.material.emissiveTexture);
  const baseline = [...scene.textures];
  const observer = scene.activeCamera;
  const disposals: ReturnType<typeof vi.fn>[] = [];
  const renderer = createRoutingRenderer(scene, screens, cameras, {
    createFeed: (scene, camera) => {
      const feed = createCameraFeed(scene, camera);
      void feed.ready.catch(() => undefined);
      const dispose = vi.fn(feed.dispose); disposals.push(dispose);
      // NullEngine verifies ownership, never GPU readiness or image correctness.
      return { ...feed, ready: Promise.resolve(), dispose };
    },
    waitForPresentation: () => ({ ready: Promise.resolve(), dispose: () => undefined }),
  });
  const director = new RoutingDirector(registry, renderer);
  try {
    await director.initialize();
    expect(scene.customRenderTargets).toHaveLength(1);
    expect(new Set(screens.screens.map((screen) => screen.material.emissiveTexture)).size).toBe(1);
    await director.assign(4, [2]); await director.assign(7, [3]);
    expect(scene.customRenderTargets).toHaveLength(3);
    expect(renderer.stats().consumers).toEqual({ 1: 1, 4: 1, 7: 1 });
    await director.assign(8, [1, 2, 3]);
    expect(scene.customRenderTargets).toHaveLength(1);
    expect(renderer.stats().consumers).toEqual({ 8: 3 });
    expect(new Set(screens.screens.map((screen) => screen.material.emissiveTexture)).size).toBe(1);
    expect(scene.activeCamera).toBe(observer);
    expect(disposals.slice(0, 3).every((dispose) => dispose.mock.calls.length === 1)).toBe(true);
    director.dispose(); director.dispose();
    expect(disposals.every((dispose) => dispose.mock.calls.length === 1)).toBe(true);
    expect(screens.screens.map((screen) => screen.material.emissiveTexture)).toEqual(originals);
    expect(scene.customRenderTargets).toHaveLength(0);
    expect(scene.textures).toEqual(baseline);
  } finally { director.dispose(); cameras.dispose(); scene.dispose(); engine.dispose(); }
});

it('cleans a partially allocated native feed when GPU allocation fails', () => {
  const engine = new NullEngine();
  const { scene } = createConcertScene(engine);
  const baseline = [...scene.textures];
  vi.spyOn(engine, 'createRenderTargetTexture').mockImplementationOnce(() => { throw new Error('allocation refusée'); });
  try {
    expect(() => createCameraFeed(scene, scene.activeCamera!)).toThrow('allocation refusée');
    expect(scene.textures).toEqual(baseline);
    expect(scene.customRenderTargets).toHaveLength(0);
  } finally { scene.dispose(); engine.dispose(); }
});
