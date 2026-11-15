import { expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { createConcertScene } from '../../../src/infrastructure/babylon/engine/createObservationScene';
import { CameraRegistry } from '../../../src/domain/cameras/cameraRegistry';
import { createCameraPresets } from '../../../src/domain/cameras/cameraPresets';
import { createCaptureCameras } from '../../../src/infrastructure/babylon/cameras/createCaptureCameras';
import { createRoutingRenderer } from '../../../src/infrastructure/babylon/rendering/createRoutingRenderer';
import { createCameraFeed } from '../../../src/infrastructure/babylon/rendering/createCameraFeed';
import { RoutingDirector } from '../../../src/application/commands/routingDirector';
import { planTransition, transitionFrame } from '../../../src/domain/direction/transitionPlan';
import { createTransitionDriver } from '../../../src/infrastructure/babylon/rendering/createTransitionDriver';
import { routingFixture } from '../../helpers/routingFixture';

it.each(['dissolve', 'rolling-cubes', 'mosaic', 'grid-morph', 'glitch', 'zoom', 'luma-wipe', 'split'])('restores native materials and textures of %s on abort without claiming GPU rendering', async (mode) => {
  const engine = new NullEngine(); const concert = createConcertScene(engine);
  const registry = new CameraRegistry(createCameraPresets()); const cameras = createCaptureCameras(concert.scene, registry);
  const ready = vi.spyOn(ShaderMaterial.prototype, 'isReady').mockReturnValue(true);
  const renderer = createRoutingRenderer(concert.scene, concert.screens, cameras, {
    createFeed: (scene, camera, size) => {
      const feed = createCameraFeed(scene, camera, size); void feed.ready.catch(() => undefined);
      return { ...feed, ready: Promise.resolve() };
    }, waitForPresentation: () => ({ ready: Promise.resolve(), dispose: () => undefined }),
  });
  const director = new RoutingDirector(registry, renderer);
  try {
    await director.initialize();
    const baseline = { textures: [...concert.scene.textures], materials: [...concert.scene.materials], after: concert.scene.onAfterRenderObservable.observers.filter((item) => !item._willBeUnregistered).length };
    const controller = new AbortController();
    const driver = renderer.createTransitionDriver({} as Document);
    const plan = planTransition(director.snapshot().routes, 4, [1, 3], { mode, parameters: { columns: 32, rows: 18 } });
    const session = await driver.prepare(plan, controller.signal);
    session.render(transitionFrame(plan, 300));
    expect(concert.screens.screens[0].surface.material).toBeInstanceOf(ShaderMaterial);
    expect(concert.screens.screens[1].surface.material).toBe(concert.screens.screens[1].material);
    expect(renderer.stats()).toMatchObject({ allocated: 2, active: 2 });
    controller.abort(); session.rollback();
    expect(concert.screens.screens.every((screen) => screen.surface.material === screen.material)).toBe(true);
    expect(renderer.stats()).toMatchObject({ allocated: 1, active: 1, consumers: { 1: 3 } });
    expect(concert.scene.textures).toEqual(baseline.textures);
    expect(concert.scene.materials).toEqual(baseline.materials);
    expect(concert.scene.onAfterRenderObservable.observers.filter((item) => !item._willBeUnregistered)).toHaveLength(baseline.after);
  } finally { ready.mockRestore(); director.dispose(); cameras.dispose(); concert.scene.dispose(); engine.dispose(); }
});

it('refuses travel without its dedicated adapter before allocation or accidental 2D fallback', async () => {
  const engine = new NullEngine(); const scene = new Scene(engine); const f = routingFixture();
  const composition = { prepare: vi.fn() }; const driver = createTransitionDriver(scene, {} as Document, f.router, composition);
  try {
    const plan = planTransition({ 1: 1, 2: 1, 3: 1 }, 4, [1], { mode: 'virtual-travel' });
    await expect(driver.prepare(plan, new AbortController().signal)).rejects.toThrow('Adaptateur');
    expect(composition.prepare).not.toHaveBeenCalled(); expect(f.createFeed).not.toHaveBeenCalled();
  } finally { f.director.dispose(); scene.dispose(); engine.dispose(); }
});

it('samples visibility without a render and detaches browser/frame listeners on cancellation and disposal', async () => {
  const engine = new NullEngine(); const scene = new Scene(engine); const f = routingFixture();
  const events = new EventTarget(); let hidden = false; let time = 0;
  const document = Object.defineProperties(events, { hidden: { get: () => hidden }, defaultView: { value: { performance: { now: () => time } } } }) as unknown as Document;
  const remove = vi.spyOn(events, 'removeEventListener');
  const driver = createTransitionDriver(scene, document, f.router, { prepare: vi.fn() });
  const count = () => scene.onAfterRenderObservable.observers.filter((item) => !item._willBeUnregistered).length;
  try {
    const controller = new AbortController(); const first = driver.nextSample(controller.signal);
    expect(count()).toBe(1);
    hidden = true; time = 100; events.dispatchEvent(new Event('visibilitychange'));
    expect(await first).toEqual({ nowMs: 100, visible: false }); expect(count()).toBe(0);
    const cancelled = driver.nextSample(controller.signal); const rejected = expect(cancelled).rejects.toThrow('annulée');
    controller.abort(); await rejected; expect(count()).toBe(0);
    const stopped = driver.nextSample(new AbortController().signal); const stoppedResult = expect(stopped).rejects.toThrow('annulée');
    scene.dispose(); await stoppedResult;
    expect(remove.mock.calls.filter(([type]) => type === 'visibilitychange')).toHaveLength(4);
  } finally { f.director.dispose(); scene.dispose(); engine.dispose(); }
});
