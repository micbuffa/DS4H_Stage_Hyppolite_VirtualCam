import { expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { createPreviewMonitor } from '../../../src/infrastructure/babylon/ui/createPreviewMonitor';
import { isFilmable } from '../../../src/domain/rendering/cameraFeed';
import { planTransition, transitionFrame } from '../../../src/domain/direction/transitionPlan';
import type { TransitionSurfaces } from '../../../src/infrastructure/babylon/rendering/createTransitionComposition';

it('owns only monitor resources, excludes its meshes from feeds, restores its material and never destroys borrowed textures', async () => {
  const engine = new NullEngine(); const scene = new Scene(engine); const parent = new TransformNode('panel', scene);
  const borrowed = RawTexture.CreateRGBATexture(new Uint8Array([20, 40, 80, 255]), 1, 1, scene);
  const destroyed = vi.spyOn(borrowed, 'dispose');
  const baseline = { textures: [...scene.textures], materials: [...scene.materials], meshes: [...scene.meshes], observers: scene.onAfterRenderObservable.observers.length };
  const monitor = createPreviewMonitor(scene, parent, (scene) => ({ texture: RawTexture.CreateRGBATexture(new Uint8Array([20, 40, 80, 255]), 1, 1, scene), draw: vi.fn() }));
  const ready = vi.spyOn(ShaderMaterial.prototype, 'isReady').mockReturnValue(true);
  try {
    for (const mesh of monitor.root.getChildMeshes()) { expect(mesh.layerMask).toBe(2); expect(isFilmable(mesh.metadata)).toBe(false); }
    expect(monitor.surface.getBoundingInfo().boundingBox.extendSize.x / monitor.surface.getBoundingInfo().boundingBox.extendSize.y).toBeCloseTo(16 / 9);
    monitor.show(borrowed);
    const plan = planTransition({ 1: 1, 2: 2, 3: 3 }, 4, [2], { mode: 'dissolve' });
    const session = await monitor.prepare(plan, borrowed, borrowed, new AbortController().signal);
    session.render(transitionFrame(plan, 300)); expect(monitor.surface.material).toBeInstanceOf(ShaderMaterial);
    session.rollback(); session.rollback(); expect(monitor.surface.material).toBe(monitor.material); expect(monitor.material.emissiveTexture).toBe(borrowed);
    monitor.dispose(); monitor.dispose();
    expect(destroyed).not.toHaveBeenCalled(); expect(scene.textures).toEqual(baseline.textures); expect(scene.materials).toEqual(baseline.materials); expect(scene.meshes).toEqual(baseline.meshes);
    expect(scene.onAfterRenderObservable.observers.filter((item) => !item._willBeUnregistered)).toHaveLength(baseline.observers);
  } finally { ready.mockRestore(); monitor.dispose(); parent.dispose(); borrowed.dispose(); scene.dispose(); engine.dispose(); }
});

it('delegates travel to the dedicated composition on the sole reference monitor surface', async () => {
  const engine = new NullEngine(); const scene = new Scene(engine); const root = new TransformNode('panel', scene);
  const pixel = RawTexture.CreateRGBATexture(new Uint8Array([20, 40, 80, 255]), 1, 1, scene);
  const session = { render: vi.fn(), commit: vi.fn(async () => {}), complete: vi.fn(), rollback: vi.fn() };
  const prepare = vi.fn(async () => session), travel = vi.fn((_surfaces: TransitionSurfaces) => { void _surfaces; return { prepare }; });
  const monitor = createPreviewMonitor(scene, root, (scene) => ({ texture: RawTexture.CreateRGBATexture(new Uint8Array([0, 0, 0, 255]), 1, 1, scene), draw() {} }), undefined, undefined, travel);
  try {
    expect(monitor.supportsTravel).toBe(true);
    const plan = planTransition({ 1: 1, 2: 2, 3: 3 }, 4, [2], { mode: 'virtual-travel' });
    const signal = new AbortController().signal; expect(await monitor.prepare(plan, pixel, pixel, signal)).toBe(session);
    expect(travel.mock.calls[0][0].screens).toEqual([{ definition: { id: 2 }, surface: monitor.surface, material: monitor.material }]);
    expect(prepare).toHaveBeenCalledWith(plan, new Map([[2, { from: pixel, to: pixel }]]), signal);
  } finally { monitor.dispose(); root.dispose(); pixel.dispose(); scene.dispose(); engine.dispose(); }
});
