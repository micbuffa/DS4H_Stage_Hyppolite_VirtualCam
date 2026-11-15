import { expect, it, vi } from 'vitest';
import { CameraRegistry } from '../../src/domain/cameras/cameraRegistry';
import { createCameraPresets } from '../../src/domain/cameras/cameraPresets';
import { RoutingDirector } from '../../src/application/commands/routingDirector';
import type { TransitionPlan } from '../../src/domain/direction/transitionPlan';
import type { TransitionDriver } from '../../src/application/ports/transition';
import { deferred } from '../helpers/routingFixture';

function fixture() {
  const cameras = new CameraRegistry(createCameraPresets());
  const session = () => ({ commit: vi.fn(async () => {}), complete: vi.fn(), rollback: vi.fn() });
  const renderer = { prepare: vi.fn(async () => session()), dispose: vi.fn() };
  const driver: TransitionDriver = { supportedModes: ['virtual-travel'], sample: () => ({ nowMs: 0, visible: true }),
    nextSample: vi.fn(async () => ({ nowMs: 10000, visible: true })), prepare: vi.fn(async () => ({ ...session(), render: vi.fn() })) };
  const preview = { suspend: vi.fn(async () => {}), resume: vi.fn(), stopTest: vi.fn(async () => {}), isCameraLocked: vi.fn(() => false) };
  const director = new RoutingDirector(cameras, renderer, driver, undefined, preview);
  return { cameras, director, renderer, driver, preview };
}

it('captures poses before asynchronous preview suspension and passes that immutable plan to the driver', async () => {
  const f = fixture();
  try {
    await f.director.initialize(); f.preview.suspend.mockClear(); f.preview.resume.mockClear();
    const gate = deferred(); f.preview.suspend.mockImplementationOnce(() => gate.ready);
    const original = f.cameras.snapshot().cameras;
    const result = f.director.assign(4, [1], { mode: 'virtual-travel' });
    expect(f.preview.suspend).toHaveBeenCalledOnce(); expect(f.driver.prepare).not.toHaveBeenCalled();
    expect(f.director.isCameraLocked(1)).toBe(true); expect(f.director.isCameraLocked(4)).toBe(true);
    // Deliberate direct registry mutation tests that the plan doesn't read late native poses.
    f.cameras.updatePose(4, { position: [20, 20, 20], rotation: [0, 0, 0, 1] });
    gate.resolve(); await result;
    const plan = vi.mocked(f.driver.prepare).mock.calls[0][0] as TransitionPlan;
    expect(plan.travel?.[0].path.from.position).toEqual(original[0].pose.position);
    expect(plan.travel?.[0].path.to.position).toEqual(original[3].pose.position);
    expect(f.director.snapshot().routes).toEqual({ 1: 4, 2: 1, 3: 1 });
    expect(f.preview.resume).toHaveBeenCalledOnce();
  } finally { f.director.dispose(); }
});

it('refuses a blocked trajectory before touching preview, live routes or rendering resources', async () => {
  const f = fixture();
  try {
    await f.director.initialize(); f.preview.suspend.mockClear(); f.preview.resume.mockClear(); f.renderer.prepare.mockClear();
    const before = f.cameras.snapshot();
    await expect(f.director.assign(4, [1], { mode: 'virtual-travel', waypoints: [[0, 1.6, 10]] })).rejects.toThrow('plateau');
    expect(f.director.snapshot()).toMatchObject({ pending: null, routes: { 1: 1, 2: 1, 3: 1 }, error: expect.stringContaining('Trajet bloqué') });
    expect(f.cameras.snapshot()).toEqual(before); expect(f.driver.prepare).not.toHaveBeenCalled(); expect(f.renderer.prepare).not.toHaveBeenCalled();
    expect(f.preview.suspend).not.toHaveBeenCalled(); expect(f.preview.resume).not.toHaveBeenCalled();
  } finally { f.director.dispose(); }
});

it('rejects a launch while dragging before validation or suspension, and keeps valid travel unavailable without an adapter', async () => {
  const cameras = new CameraRegistry(createCameraPresets()); let dragging = false;
  const renderer = { prepare: vi.fn(async () => ({ commit: async () => {}, complete() {}, rollback() {} })), dispose: vi.fn() };
  const preview = { suspend: vi.fn(async () => {}), resume: vi.fn(), stopTest: vi.fn(async () => {}), isCameraLocked: () => false };
  const director = new RoutingDirector(cameras, renderer, undefined, () => dragging, preview);
  try {
    await director.initialize(); preview.suspend.mockClear(); renderer.prepare.mockClear();
    dragging = true;
    await expect(director.assign(4, [1], { mode: 'virtual-travel' })).rejects.toThrow('geste');
    expect(preview.suspend).not.toHaveBeenCalled();
    dragging = false;
    await expect(director.assign(4, [1], { mode: 'virtual-travel' })).rejects.toThrow('pas encore disponible');
    expect(renderer.prepare).not.toHaveBeenCalled(); expect(director.snapshot().routes).toEqual({ 1: 1, 2: 1, 3: 1 });
  } finally { director.dispose(); }
});
