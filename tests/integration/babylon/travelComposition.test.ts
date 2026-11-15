import { expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { createConcertScene } from '../../../src/infrastructure/babylon/engine/createObservationScene';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { createTravelComposition } from '../../../src/infrastructure/babylon/rendering/createTravelComposition';
import { createCameraPresets } from '../../../src/domain/cameras/cameraPresets';
import { captureTravelPlan } from '../../../src/domain/direction/captureTravelPlan';
import { planTransition, transitionFrame } from '../../../src/domain/direction/transitionPlan';

it.each(['rollback', 'complete'])('binds borrowed textures only to targeted native materials and cleans on %s', async (finish) => {
  const engine = new NullEngine(); const concert = createConcertScene(engine); const { scene, screens } = concert;
  const a = screens.screens.map((screen) => screen.material.emissiveTexture);
  const b = RawTexture.CreateRGBATexture(new Uint8Array([100, 20, 30, 255]), 1, 1, scene);
  const temp = RawTexture.CreateRGBATexture(new Uint8Array([20, 100, 30, 255]), 1, 1, scene);
  const borrowed = vi.spyOn(b, 'dispose'), temporaryPixels = vi.spyOn(temp, 'dispose');
  const released = vi.fn(); const baseline = { materials: [...scene.materials], textures: [...scene.textures] };
  const plan = captureTravelPlan(planTransition({ 1: 1, 2: 2, 3: 3 }, 4, [1, 3], { mode: 'virtual-travel' }), createCameraPresets(), []);
  const sources = { retain: vi.fn(), retainTemporary: vi.fn(() => ({ texture: temp, ready: Promise.resolve(), consumer: { owner: 'temp', source: 'temporary' as const, use: 'travel' as const, rendering: true },
    dispose: released, setRenderingEnabled: vi.fn(), setPose: vi.fn(), waitForFrame: vi.fn(async () => {}) })) };
  try {
    const composition = createTravelComposition(scene, screens, sources, () => ({ ready: Promise.resolve(), dispose() {} }));
    const session = await composition.prepare(plan, new Map(plan.steps.map((step) => [step.screen, { from: a[step.screen - 1], to: b }])), new AbortController().signal);
    await session.render(transitionFrame(plan, 1000));
    expect(screens.screens[2].material.emissiveTexture).toBe(temp); expect(screens.screens[0].material.emissiveTexture).toBe(a[0]);
    expect(screens.screens[1].material.emissiveTexture).toBe(a[1]);
    await session.render(transitionFrame(plan, plan.totalMs));
    expect(screens.screens.map((screen) => screen.material.emissiveTexture)).toEqual([b, a[1], b]);
    if (finish === 'complete') { await session.commit(); session.complete(); } else session.rollback();
    expect(screens.screens.map((screen) => screen.material.emissiveTexture)).toEqual(finish === 'complete' ? [b, a[1], b] : a);
    expect(screens.screens.every((screen) => screen.surface.material === screen.material)).toBe(true);
    expect(released).toHaveBeenCalledOnce(); expect(borrowed).not.toHaveBeenCalled(); expect(temporaryPixels).not.toHaveBeenCalled();
    expect(scene.materials).toEqual(baseline.materials); expect(scene.textures).toEqual(baseline.textures);
  } finally { borrowed.mockRestore(); temporaryPixels.mockRestore(); b.dispose(); temp.dispose(); scene.dispose(); engine.dispose(); }
});
