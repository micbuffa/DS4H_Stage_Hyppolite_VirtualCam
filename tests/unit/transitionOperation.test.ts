import { expect, it, vi } from 'vitest';
import type { TransitionDriver, PreparedTransition } from '../../src/application/ports/transition';
import type { TransitionPlan, TransitionFrame } from '../../src/domain/direction/transitionPlan';
import { TransitionOperation } from '../../src/application/commands/transitionOperation';
import { planTransition } from '../../src/domain/direction/transitionPlan';
import { routingFixture, deferred } from '../helpers/routingFixture';

function effectFixture() {
  const rendered: TransitionFrame[] = [];
  let resolveSample: ((sample: { nowMs: number; visible: boolean }) => void) | undefined;
  let prepareGate: Promise<void> = Promise.resolve();
  let presentationGate: Promise<void> = Promise.resolve();
  const sessions: PreparedTransition[] = [];
  const driver: TransitionDriver = {
    supportedModes: ['dissolve', 'rolling-cubes', 'mosaic', 'grid-morph', 'glitch', 'zoom', 'luma-wipe', 'split', 'virtual-travel'],
    sample: () => ({ nowMs: 0, visible: true }),
    nextSample: vi.fn((signal: AbortSignal) => new Promise<{ nowMs: number; visible: boolean }>((resolve, reject) => {
      const abort = () => { resolveSample = undefined; reject(new Error('sample cancelled')); };
      signal.addEventListener('abort', abort, { once: true });
      resolveSample = (sample) => { signal.removeEventListener('abort', abort); resolveSample = undefined; resolve(sample); };
    })),
    prepare: vi.fn(async (plan: TransitionPlan) => {
      const before = new Map(f.current);
      let settled = false;
      const session: PreparedTransition = {
        render: vi.fn((frame: TransitionFrame) => {
          if (settled) throw new Error('session closed');
          rendered.push(frame);
          for (const step of frame.screens) {
            f.current.set(step.screen, { label: step.progress === 1 ? `C${plan.destination}` : step.progress === 0 ? before.get(step.screen)!.label : 'live blend' });
          }
        }),
        commit: vi.fn(async () => { await presentationGate; if (settled) throw new Error('session closed'); }),
        complete: vi.fn(() => { settled = true; }),
        rollback: vi.fn(() => { if (settled) return; settled = true; for (const [id, texture] of before) f.current.set(id, texture); }),
      };
      sessions.push(session);
      await prepareGate;
      return session;
    }),
  };
  const f = routingFixture(driver);
  const tick = async (nowMs: number, visible = true) => {
    await vi.waitFor(() => expect(resolveSample).toBeDefined());
    resolveSample!({ nowMs, visible });
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  };
  return { ...f, driver, sessions, rendered, tick,
    prepareLater: (gate: Promise<void>) => { prepareGate = gate; },
    presentLater: (gate: Promise<void>) => { presentationGate = gate; } };
}

it('keeps committed routes until final presentation and captures settings independently of later edits', async () => {
  const f = effectFixture();
  try {
    await f.director.initialize();
    f.director.configureTransition({ mode: 'dissolve' }); f.cameras.select(4);
    const presentation = deferred(); f.presentLater(presentation.ready);
    const result = f.director.broadcast();
    expect(f.director.transitionSnapshot().phase).toBe('preparing');
    f.cameras.select(7); f.director.toggleTarget(2); f.director.configureTransition({ mode: 'mosaic', durationMs: 1000 });
    await f.tick(300);
    expect(f.current.get(1)!.label).toBe('live blend');
    expect(f.current.get(2)!.label).toBe('C1');
    expect(f.director.snapshot().routes).toEqual({ 1: 1, 2: 1, 3: 1 });
    expect(f.director.isCameraLocked(4)).toBe(true);
    expect(f.director.isCameraLocked(7)).toBe(false);
    expect(() => f.director.assertQualityChangeAllowed()).toThrow('qualité');
    await expect(f.director.broadcast()).rejects.toThrow('déjà');
    await f.tick(600);
    await vi.waitFor(() => expect(f.director.transitionSnapshot().phase).toBe('presenting'));
    expect(f.current.get(1)!.label).toBe('C4');
    expect(f.director.snapshot().routes[1]).toBe(1);
    presentation.resolve(); await result;
    expect(f.director.snapshot()).toMatchObject({ selectedId: 7, targets: [1, 2], routes: { 1: 4, 2: 1, 3: 1 } });
    expect(f.director.transitionSnapshot().plan!.settings).toMatchObject({ mode: 'dissolve', durationMs: 600 });
    expect(f.sessions[0].complete).toHaveBeenCalledOnce();
    expect(f.director.isCameraLocked(4)).toBe(false);
    expect(() => f.director.assertQualityChangeAllowed()).not.toThrow();
  } finally { f.director.dispose(); }
});

it('rolls back every target after cancelling a staggered transition whose first screen already finished', async () => {
  const f = effectFixture();
  try {
    await f.director.initialize(); const previous = [...f.current];
    f.director.configureTransition({ mode: 'dissolve', order: 'staggered' });
    const result = f.director.assign(8, [1, 3]);
    const rejected = expect(result).rejects.toThrow('annulée');
    await f.tick(600);
    expect(f.current.get(3)!.label).toBe('C8');
    expect(f.current.get(1)!.label).toBe('C1');
    f.director.cancelTransition(); f.director.cancelTransition(); await rejected;
    expect([...f.current]).toEqual(previous);
    expect(f.director.snapshot()).toMatchObject({ routes: { 1: 1, 2: 1, 3: 1 }, pending: null, error: null });
    expect(f.director.transitionSnapshot().phase).toBe('cancelled');
    expect(f.sessions[0].rollback).toHaveBeenCalledOnce();
    expect(f.sessions[0].complete).not.toHaveBeenCalled();
  } finally { f.director.dispose(); }
});

it('restores three distinct starts after a later screen fails, preserving the captured sequence despite edits', async () => {
  const f = effectFixture();
  try {
    await f.director.initialize(); await f.director.assign(2, [2]); await f.director.assign(3, [3]);
    const previous = [...f.current];
    f.director.configureTransition({ mode: 'dissolve', order: 'staggered', screenOrder: [2, 3, 1], delayMs: 200 });
    const result = f.director.assign(4, [1, 2, 3]), rejected = expect(result).rejects.toThrow('Later screen failed');
    await f.tick(600); expect(f.current.get(2)!.label).toBe('C4'); expect(f.current.get(3)!.label).toBe('C3');
    f.director.configureTransition({ order: 'simultaneous', screenOrder: [1, 2, 3], delayMs: 1000 });
    expect(f.director.transitionSnapshot().plan).toMatchObject({ totalMs: 2200, settings: { order: 'staggered', screenOrder: [2, 3, 1], delayMs: 200 } });
    await f.tick(1100); expect(f.current.get(3)!.label).toBe('live blend');
    vi.mocked(f.sessions[0].render).mockImplementationOnce(() => { throw new Error('Later screen failed'); });
    await f.tick(1200); await rejected;
    expect([...f.current]).toEqual(previous); expect(f.director.snapshot().routes).toEqual({ 1: 1, 2: 2, 3: 3 });
    expect(f.director.transitionSnapshot().phase).toBe('error'); expect(f.sessions[0].rollback).toHaveBeenCalledOnce();
    f.director.configureTransition({ mode: 'cut' }); await f.director.assign(4, [1]);
    expect(f.director.snapshot().routes).toEqual({ 1: 4, 2: 2, 3: 3 });
  } finally { f.director.dispose(); }
});

it('cleans a late prepared session without rendering it after cancellation', async () => {
  const f = effectFixture();
  try {
    await f.director.initialize(); const previous = [...f.current];
    const ready = deferred(); f.prepareLater(ready.ready);
    f.director.configureTransition({ mode: 'dissolve' });
    const result = f.director.assign(4, [1]); const rejected = expect(result).rejects.toThrow('annulée');
    f.director.cancelTransition(); await rejected;
    ready.resolve();
    await vi.waitFor(() => expect(f.sessions[0].rollback).toHaveBeenCalledOnce());
    expect(f.rendered).toEqual([]); expect([...f.current]).toEqual(previous);
    f.director.configureTransition({ mode: 'cut' }); await f.director.assign(7, [2]);
    expect(f.director.snapshot().routes).toEqual({ 1: 1, 2: 7, 3: 1 });
  } finally { f.director.dispose(); }
});

it.each(['dissolve', 'rolling-cubes', 'mosaic', 'grid-morph', 'glitch', 'zoom', 'luma-wipe', 'split'].flatMap((mode) => ['render', 'presentation'].map((failure) => [mode, failure])))('restores %s images and routes when %s fails during a passage', async (mode, failure) => {
  const f = effectFixture();
  try {
    await f.director.initialize(); const previous = [...f.current];
    f.director.configureTransition({ mode });
    const presentation = deferred();
    if (failure === 'presentation') f.presentLater(presentation.ready);
    const result = f.director.assign(4, [1, 3]);
    const rejected = expect(result).rejects.toThrow(`${failure} failed`);
    await f.tick(300);
    if (failure === 'render') vi.mocked(f.sessions[0].render).mockImplementationOnce(() => { throw new Error('render failed'); });
    await f.tick(600);
    if (failure === 'presentation') presentation.reject(new Error('presentation failed'));
    await rejected;
    expect([...f.current]).toEqual(previous);
    expect(f.director.snapshot().routes).toEqual({ 1: 1, 2: 1, 3: 1 });
    expect(f.director.transitionSnapshot()).toMatchObject({ phase: 'error', error: `${failure} failed` });
    expect(f.sessions[0].rollback).toHaveBeenCalledOnce();
  } finally { f.director.dispose(); }
});

it('pauses hidden time, resumes without a jump and ignores the concert pause clock', async () => {
  const f = effectFixture();
  try {
    await f.director.initialize(); f.director.configureTransition({ mode: 'dissolve' });
    const result = f.director.assign(4, [1]);
    await f.tick(300); expect(f.director.transitionSnapshot().frame!.progress).toBe(0.5);
    await f.tick(300, false); const draws = f.rendered.length;
    await f.tick(100000, false); expect(f.rendered).toHaveLength(draws);
    await f.tick(100100); expect(f.director.transitionSnapshot().frame!.progress).toBe(0.5);
    await f.tick(100400); await result;
    expect(f.director.snapshot().routes[1]).toBe(4);
  } finally { f.director.dispose(); }
});

it('waits for visibility before presenting a transition whose clock ended at the hide event', async () => {
  const f = effectFixture();
  try {
    await f.director.initialize(); f.director.configureTransition({ mode: 'dissolve' });
    const result = f.director.assign(4, [1]);
    await f.tick(600, false);
    expect(f.director.transitionSnapshot().phase).toBe('transitioning');
    expect(f.sessions[0].commit).not.toHaveBeenCalled();
    expect(f.director.snapshot().routes[1]).toBe(1);
    await f.tick(90000, true); await result;
    expect(f.director.snapshot().routes[1]).toBe(4);
  } finally { f.director.dispose(); }
});

it('restores the last valid images when an effect fails during preparation', async () => {
  const f = effectFixture();
  try {
    await f.director.initialize(); const previous = [...f.current];
    vi.mocked(f.driver.prepare).mockRejectedValueOnce(new Error('shader failed'));
    f.director.configureTransition({ mode: 'dissolve' });
    await expect(f.director.assign(4, [1])).rejects.toThrow('shader failed');
    expect([...f.current]).toEqual(previous);
    expect(f.director.snapshot().routes).toEqual({ 1: 1, 2: 1, 3: 1 });
    expect(f.director.transitionSnapshot()).toMatchObject({ phase: 'error', error: 'shader failed' });
  } finally { f.director.dispose(); }
});

it('stops pending work on disposal and refuses commands after stop', async () => {
  const f = effectFixture();
  await f.director.initialize(); f.director.configureTransition({ mode: 'dissolve' });
  const result = f.director.assign(4, [1]); const rejected = expect(result).rejects.toThrow();
  await f.tick(300); f.director.dispose(); f.director.dispose(); await rejected;
  expect(f.director.transitionSnapshot().phase).toBe('stopped');
  expect(f.sessions[0].rollback).toHaveBeenCalledOnce();
  await expect(f.director.assign(7, [1])).rejects.toThrow('arrêtée');
  expect(() => f.director.configureTransition({ mode: 'cut' })).toThrow('arrêtée');
});

it('rejects unavailable modes, invalid input and active drags without acquiring any feed', async () => {
  const f = routingFixture(undefined, () => true);
  try {
    await expect(f.director.assign(4, [1])).rejects.toThrow('geste');
    expect(f.createFeed).not.toHaveBeenCalled();
  } finally { f.director.dispose(); }
  const g = routingFixture();
  try {
    await g.director.initialize(); const count = g.createFeed.mock.calls.length;
    expect(() => g.director.configureTransition({ durationMs: NaN })).toThrow();
    g.director.configureTransition({ mode: 'dissolve' });
    await expect(g.director.assign(4, [1])).rejects.toThrow('pas encore disponible');
    g.director.configureTransition({ mode: 'cut', order: 'staggered', delayMs: 100 });
    await expect(g.director.assign(4, [1, 3])).rejects.toThrow('pas encore disponible');
    expect(g.createFeed).toHaveBeenCalledTimes(count);
    expect(g.director.snapshot().routes).toEqual({ 1: 1, 2: 1, 3: 1 });
  } finally { g.director.dispose(); }
});

it('treats an identical assignment as success even when no effect adapter is installed', async () => {
  const f = routingFixture();
  try {
    await f.director.initialize(); f.director.configureTransition({ mode: 'dissolve' });
    const calls = f.createFeed.mock.calls.length;
    await f.director.assign(1, [1, 3]); expect(f.createFeed).toHaveBeenCalledTimes(calls);
  } finally { f.director.dispose(); }
});

it('refuses concurrent operations and disposal is idempotent at the port boundary', async () => {
  const ready = deferred();
  const rollback = vi.fn();
  const renderer = { prepare: vi.fn(() => ready.ready.then(() => ({ commit: async () => undefined, complete: vi.fn(), rollback }))), dispose: vi.fn() };
  const operation = new TransitionOperation(renderer);
  const plan = planTransition({ 1: 1, 2: 1, 3: 1 }, 4, [1]);
  const result = operation.execute(plan); const rejected = expect(result).rejects.toThrow('annulée');
  await expect(operation.execute(plan)).rejects.toThrow('déjà');
  operation.dispose(); operation.dispose(); await rejected; ready.resolve();
  await vi.waitFor(() => expect(rollback).toHaveBeenCalledOnce());
  expect(renderer.dispose).toHaveBeenCalledOnce();
});

it('cancels a cut while warming a source and restores both rendering slots and textures', async () => {
  const f = routingFixture();
  try {
    await f.director.initialize(); await f.director.assign(2, [2]); await f.director.assign(3, [3]);
    const previous = [...f.current]; f.delayed.add(4);
    const result = f.director.assign(4, [1]); const rejected = expect(result).rejects.toThrow('annulée');
    expect(f.router.stats()).toMatchObject({ allocated: 4, active: 3 });
    f.director.cancelTransition(); await rejected;
    expect([...f.current]).toEqual(previous);
    expect(f.router.stats()).toMatchObject({ allocated: 3, active: 3 });
    expect(f.feeds.find((entry) => entry.id === 4)!.dispose).toHaveBeenCalledOnce();
    f.delayed.clear(); await f.director.assign(7, [1]);
    expect(f.director.snapshot().routes[1]).toBe(7);
  } finally { f.director.dispose(); }
});

it('cancels a cut after texture swap but before presentation and removes the presentation observer', async () => {
  const f = routingFixture();
  try {
    await f.director.initialize(); const previous = [...f.current];
    const frame = deferred(); const dispose = vi.fn(() => frame.reject(new Error('cancelled')));
    f.waitForPresentation.mockReturnValue({ ready: frame.ready, dispose });
    const result = f.director.assign(4, [1]); const rejected = expect(result).rejects.toThrow();
    await vi.waitFor(() => expect(f.director.transitionSnapshot().phase).toBe('presenting'));
    expect(f.current.get(1)!.label).toBe('C4');
    f.director.cancelTransition(); await rejected;
    expect([...f.current]).toEqual(previous);
    expect(f.director.snapshot().routes).toEqual({ 1: 1, 2: 1, 3: 1 });
    expect(dispose).toHaveBeenCalledOnce();
    expect(f.router.stats()).toMatchObject({ allocated: 1, active: 1 });
  } finally { f.director.dispose(); }
});
