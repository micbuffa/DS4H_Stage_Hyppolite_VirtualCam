import { expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { CameraRegistry } from '../../../src/domain/cameras/cameraRegistry';
import { createCameraPresets } from '../../../src/domain/cameras/cameraPresets';
import { createConcertScene } from '../../../src/infrastructure/babylon/engine/createObservationScene';
import { createCaptureCameras } from '../../../src/infrastructure/babylon/cameras/createCaptureCameras';
import { createCameraFeed } from '../../../src/infrastructure/babylon/rendering/createCameraFeed';
import { createRoutingRenderer } from '../../../src/infrastructure/babylon/rendering/createRoutingRenderer';
import { RoutingDirector } from '../../../src/application/commands/routingDirector';
import { planTransition, transitionFrame } from '../../../src/domain/direction/transitionPlan';

it.each(['complete', 'cancel', 'error'])('owns staggered cut sources until global presentation and cleans after %s', async (outcome) => {
  const engine = new NullEngine(); const concert = createConcertScene(engine), { scene, screens } = concert;
  const registry = new CameraRegistry(createCameraPresets()), cameras = createCaptureCameras(scene, registry);
  const ready = vi.spyOn(ShaderMaterial.prototype, 'isReady').mockReturnValue(true);
  const renderer = createRoutingRenderer(scene, screens, cameras, { createFeed(scene, camera, size) {
    const feed = createCameraFeed(scene, camera, size); void feed.ready.catch(() => undefined); return { ...feed, ready: Promise.resolve() };
  }, waitForPresentation: () => ({ ready: Promise.resolve(), dispose() {} }) });
  const director = new RoutingDirector(registry, renderer);
  try {
    await director.initialize(); await director.assign(2, [2]); await director.assign(3, [3]);
    const before = screens.screens.map((screen) => screen.material.emissiveTexture), poses = registry.snapshot();
    const plan = planTransition(director.snapshot().routes, 4, [1, 2, 3], { mode: 'cut', order: 'staggered', delayMs: 200 });
    const controller = new AbortController(), driver = renderer.createTransitionDriver({} as Document);
    expect(driver.supportedModes).toContain('cut');
    const session = await driver.prepare(plan, controller.signal); session.render(transitionFrame(plan, 0));
    expect(renderer.stats()).toMatchObject({ active: 4, allocated: 4, sources: [1, 2, 3] });
    expect(scene.customRenderTargets).toHaveLength(4); expect(registry.snapshot()).toEqual(poses);
    if (outcome === 'complete') {
      session.render(transitionFrame(plan, plan.totalMs));
      const readyScene = vi.spyOn(scene, 'isReady').mockReturnValue(true);
      const presenting = session.commit(); scene.onAfterRenderObservable.notifyObservers(scene); await presenting; readyScene.mockRestore();
      session.complete(); expect(renderer.stats()).toMatchObject({ active: 1, allocated: 1, sources: [4] });
    }
    else {
      session.render(transitionFrame(plan, 100));
      if (outcome === 'cancel') controller.abort();
      else { const shader = screens.screens[2].surface.material as ShaderMaterial; shader.onError?.(shader.getEffect()!, 'Panne tardive de recette.'); expect(() => session.render(transitionFrame(plan, 300))).toThrow('Panne tardive'); }
      session.rollback(); expect(screens.screens.map((screen) => screen.material.emissiveTexture)).toEqual(before); expect(renderer.stats()).toMatchObject({ active: 3, allocated: 3 });
    }
    expect(screens.screens.every((screen) => screen.surface.material === screen.material)).toBe(true);
    expect(scene.materials.some((material) => material.name.startsWith('transition-screen-'))).toBe(false);
  } finally { ready.mockRestore(); director.dispose(); cameras.dispose(); scene.dispose(); engine.dispose(); }
});
