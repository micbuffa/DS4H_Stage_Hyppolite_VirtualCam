import { expect, it, vi } from 'vitest';
import { PreviewController } from '../../src/application/commands/previewController';
import { RoutingDirector } from '../../src/application/commands/routingDirector';
import { DirectorPanel } from '../../src/application/commands/directorPanel';
import { CameraEditor } from '../../src/application/commands/cameraEditor';
import { routingFixture, deferred } from '../helpers/routingFixture';
import type { FakeTexture } from '../helpers/routingFixture';
import type { PreviewViewPort } from '../../src/application/ports/preview';
import type { PreparedTransition } from '../../src/application/ports/transition';
import { availableTransitionModes } from '../../src/domain/direction/basicTransitions';

function fixture(travelTiming = false) {
  const f = routingFixture(); let director = f.director;
  let displayed: FakeTexture | null = null, base: FakeTexture | null = null;
  let nowMs = 0, sample: ((now: number) => void) | undefined;
  const view: PreviewViewPort<FakeTexture> = {
    show: vi.fn((texture) => { base = displayed = texture; }), present: vi.fn(async () => undefined),
    prepare: vi.fn(async () => {
      const previous = base;
      return { render: vi.fn((frame) => { displayed = { label: `test-${frame.progress}` }; }),
        commit: vi.fn(async () => { displayed = previous; }), complete: vi.fn(), rollback: vi.fn(() => { displayed = base; }) };
    }),
  };
  const timing = { supportedModes: [...availableTransitionModes, ...(travelTiming ? ['virtual-travel' as const] : [])], sample: () => ({ nowMs, visible: true }),
    nextSample: (signal: AbortSignal) => new Promise<{ nowMs: number; visible: boolean }>((resolve, reject) => {
      const abort = () => { sample = undefined; reject(new Error('annulé')); };
      signal.addEventListener('abort', abort, { once: true });
      sample = (time) => { signal.removeEventListener('abort', abort); sample = undefined; nowMs = time; resolve({ nowMs, visible: true }); };
    }) };
  const preview = new PreviewController(f.cameras, f.router, view, timing, () => {
    const state = director.snapshot(); return { routes: state.routes, targets: state.targets, settings: director.transitionSettings(), blocked: state.pending !== null || !!state.qualityPending };
  });
  director = new RoutingDirector(f.cameras, f.router, undefined, undefined, preview);
  const tick = async (time: number) => { await vi.waitFor(() => expect(sample).toBeDefined()); sample!(time); await Promise.resolve(); await Promise.resolve(); };
  const ready = async () => { await vi.waitFor(() => expect(preview.snapshot().phase).toBe('ready')); };
  const dispose = () => { preview.dispose(); director.dispose(); f.director.dispose(); };
  return { ...f, director, preview, view, tick, ready, displayed: () => displayed, dispose };
}

it('refuses an unavailable travel test before touching the preview even when the live driver supports travel', async () => {
  const f = fixture(true);
  try {
    await f.director.initialize(); f.cameras.select(4); await f.preview.activate();
    const before = f.preview.snapshot(), displayed = f.displayed(), allocations = f.createFeed.mock.calls.length;
    f.director.configureTransition({ mode: 'virtual-travel' });
    await expect(f.preview.test()).rejects.toThrow('test hors direct du trajet');
    expect(f.preview.snapshot()).toEqual(before); expect(f.displayed()).toBe(displayed);
    expect(f.createFeed).toHaveBeenCalledTimes(allocations); expect(f.view.prepare).not.toHaveBeenCalled();
  } finally { f.dispose(); }
});

it('shares an on-air preview and follows selection without cutting or owning a second feed pool', async () => {
  const f = fixture();
  try {
    await f.director.initialize(); const routes = f.director.snapshot().routes;
    await f.preview.activate(); expect(f.router.stats()).toMatchObject({ active: 1, allocated: 1, consumers: { 1: 4 } });
    f.cameras.select(4); await f.ready(); expect(f.displayed()?.label).toBe('C4');
    expect(f.router.stats()).toMatchObject({ active: 2, allocated: 2 }); expect(f.director.snapshot().routes).toEqual(routes);
    await f.preview.deactivate(); expect(f.displayed()).toBe(null); expect(f.router.stats()).toMatchObject({ active: 1, allocated: 1 });
  } finally { f.dispose(); }
});
it('keeps at most four sources active while retaining the old preview for recovery', async () => {
  const f = fixture();
  try {
    await f.director.initialize(); await f.director.assign(2, [2]); await f.director.assign(3, [3]);
    f.cameras.select(4); await f.preview.activate(); f.delayed.add(7); f.cameras.select(7);
    await vi.waitFor(() => expect(f.router.stats()).toMatchObject({ active: 4, allocated: 5 }));
    expect(f.displayed()?.label).toBe('C4'); expect(f.preview.snapshot()).toMatchObject({ source: 4, requested: 7, phase: 'preparing' });
    expect(f.feeds.find((item) => item.id === 4)?.enabled).toBe(false);
    f.feeds.find((item) => item.id === 7)!.reject(new Error('source absente'));
    await vi.waitFor(() => expect(f.preview.snapshot().phase).toBe('error'));
    expect(f.displayed()?.label).toBe('C4'); expect(f.router.stats()).toMatchObject({ active: 4, allocated: 4 }); expect(f.maxActive()).toBe(4);
    expect(f.preview.snapshot().error).toContain('C4 conservée');
  } finally { f.dispose(); }
});
it('abandons stale selection preparations and never publishes them after a newer selection or disposal', async () => {
  const f = fixture();
  try {
    await f.director.initialize(); f.delayed.add(4); f.cameras.select(4); const pending = f.preview.activate();
    await vi.waitFor(() => expect(f.feeds.some((item) => item.id === 4)).toBe(true));
    const old = f.feeds.find((item) => item.id === 4)!;
    f.cameras.select(7); await f.ready(); old.resolve(); await pending;
    expect(old.disposed).toBe(true); expect(f.displayed()?.label).toBe('C7');
    f.delayed.add(8); f.cameras.select(8); await vi.waitFor(() => expect(f.feeds.some((item) => item.id === 8)).toBe(true));
    f.preview.dispose(); f.feeds.find((item) => item.id === 8)!.resolve(); await Promise.resolve();
    expect(f.router.stats()).toMatchObject({ active: 1, allocated: 1 }); expect(f.displayed()).toBe(null);
  } finally { f.dispose(); }
});
it('uses the smallest target as reference, tests only on the monitor and releases A after completion', async () => {
  const f = fixture();
  try {
    await f.director.initialize(); await f.director.assign(2, [2]); await f.director.assign(3, [3]);
    f.director.toggleTarget(1); f.director.toggleTarget(3); f.director.toggleTarget(2);
    f.cameras.select(4); f.director.configureTransition({ mode: 'dissolve', durationMs: 1000 });
    const routes = f.director.snapshot().routes, current = [...f.current]; const running = f.preview.test();
    await f.tick(500); expect(f.preview.snapshot()).toMatchObject({ phase: 'testing', reference: 2, referenceSource: 2, source: 4, progress: 0.5 });
    expect(f.displayed()?.label).toBe('test-0.5'); expect(f.director.isCameraLocked(2)).toBe(true);
    expect(f.director.snapshot().routes).toEqual(routes); expect([...f.current]).toEqual(current); expect(f.router.stats().active).toBe(4);
    await f.tick(1000); await running; expect(f.displayed()?.label).toBe('C4'); expect(f.director.isCameraLocked(2)).toBe(false);
    expect(f.router.stats().consumers).toEqual({ 1: 1, 2: 1, 3: 1, 4: 1 });
  } finally { f.dispose(); }
});
it('restores the old preview after presentation fails and ignores a later abandoned presentation', async () => {
  const f = fixture();
  try {
    await f.director.initialize(); f.cameras.select(4); await f.preview.activate();
    vi.mocked(f.view.present).mockRejectedValueOnce(new Error('présentation impossible'));
    f.cameras.select(7); await vi.waitFor(() => expect(f.preview.snapshot().phase).toBe('error'));
    expect(f.preview.snapshot().source).toBe(4); expect(f.displayed()?.label).toBe('C4');
    const gate = deferred(); vi.mocked(f.view.present).mockImplementationOnce(() => gate.ready);
    const retry = f.preview.activate(); await vi.waitFor(() => expect(f.preview.snapshot()).toMatchObject({ phase: 'preparing', source: 7 }));
    f.cameras.select(8); await f.ready(); gate.resolve(); await retry;
    expect(f.displayed()?.label).toBe('C8'); expect(f.router.stats()).toMatchObject({ active: 2, allocated: 2 });
  } finally { f.dispose(); }
});
it('cancels a broadcast while preview suspension is pending without acquiring a candidate live feed', async () => {
  const f = routingFixture(); const gate = deferred();
  const coordinator = { suspend: vi.fn(async (): Promise<void> => undefined), resume: vi.fn(), isCameraLocked: () => false, stopTest: async () => undefined };
  const director = new RoutingDirector(f.cameras, f.router, undefined, undefined, coordinator);
  try {
    await director.initialize(); coordinator.suspend.mockImplementationOnce(() => gate.ready);
    const run = director.assign(4, [1]); const rejected = expect(run).rejects.toThrow('annulée');
    expect(director.isCameraLocked(4)).toBe(true); expect(director.isCameraLocked(7)).toBe(false);
    director.cancelTransition(); gate.resolve(); await rejected;
    expect(director.snapshot()).toMatchObject({ pending: null, error: null, routes: { 1: 1, 2: 1, 3: 1 }, transition: { phase: 'cancelled' } });
    expect(f.createFeed).toHaveBeenCalledTimes(1); expect(coordinator.resume).toHaveBeenCalledTimes(2);
  } finally { director.dispose(); f.director.dispose(); }
});
it('rejects a live command during an active drag before interrupting the preview', async () => {
  const f = routingFixture(); let dragging = false;
  const coordinator = { suspend: vi.fn(async (): Promise<void> => undefined), resume: vi.fn(), isCameraLocked: () => false, stopTest: async () => undefined };
  const director = new RoutingDirector(f.cameras, f.router, undefined, () => dragging, coordinator);
  try {
    await director.initialize(); dragging = true;
    await expect(director.assign(4, [1])).rejects.toThrow('geste'); expect(coordinator.suspend).toHaveBeenCalledTimes(1);
    expect(director.snapshot().pending).toBe(null); expect(director.isCameraLocked(4)).toBe(false); expect(f.createFeed).toHaveBeenCalledTimes(1);
  } finally { director.dispose(); f.director.dispose(); }
});
it('allows a simple preview without targets but refuses a test before acquiring any test resources', async () => {
  const f = fixture();
  try {
    await f.director.initialize(); f.director.toggleTarget(1); f.cameras.select(4); await f.preview.activate();
    const count = f.feeds.length;
    await expect(f.preview.test()).rejects.toThrow('écran cible'); expect(f.view.prepare).not.toHaveBeenCalled(); expect(f.feeds).toHaveLength(count);
    expect(f.preview.snapshot()).toMatchObject({ phase: 'ready', source: 4, reference: null });
  } finally { f.dispose(); }
});
it('keeps a distinct preview allocation during a no-op assignment while stopping any monitor test', async () => {
  const f = fixture();
  try {
    await f.director.initialize(); f.cameras.select(4); await f.preview.activate();
    const previous = f.displayed(), created = f.createFeed.mock.calls.length;
    await f.director.assign(1, [1]); await f.ready();
    expect(f.createFeed).toHaveBeenCalledTimes(created); expect(f.displayed()).toBe(previous);
    f.director.configureTransition({ mode: 'dissolve', durationMs: 1000 }); const run = f.preview.test(); await f.tick(500);
    await f.director.assign(1, [1], { mode: 'cut' }); await run;
    expect(f.preview.snapshot().phase).toBe('ready'); expect(f.router.stats()).toMatchObject({ active: 2, allocated: 2 });
    expect(f.director.snapshot().routes).toEqual({ 1: 1, 2: 1, 3: 1 });
  } finally { f.dispose(); }
});
it('abandons superseded test requests even when both select the same already prepared source', async () => {
  const f = fixture();
  try {
    await f.director.initialize(); f.cameras.select(4); await f.preview.activate(); f.director.configureTransition({ mode: 'dissolve', durationMs: 1000 });
    const first = f.preview.test(), second = f.preview.test(); await f.tick(500);
    expect(f.view.prepare).toHaveBeenCalledOnce(); expect(f.preview.snapshot()).toMatchObject({ phase: 'testing', progress: 0.5 });
    await f.tick(1000); await Promise.all([first, second]); expect(f.preview.snapshot().phase).toBe('ready');
    expect(f.router.stats().consumers).toEqual({ 1: 3, 4: 1 });
  } finally { f.dispose(); }
});
it('gives broadcasting priority over preview preparation and resumes the latest selection afterwards', async () => {
  const f = fixture();
  try {
    await f.director.initialize(); f.cameras.select(4); await f.preview.activate();
    f.delayed.add(7); f.cameras.select(7); await vi.waitFor(() => expect(f.router.stats().allocated).toBe(3));
    await f.director.assign(8, [1]); f.cameras.select(9); await f.ready();
    expect(f.displayed()?.label).toBe('C9'); expect(f.director.snapshot().routes).toEqual({ 1: 8, 2: 1, 3: 1 });
    expect(f.feeds.find((feed) => feed.id === 7)?.disposed).toBe(true); expect(f.maxActive()).toBeLessThanOrEqual(4);
  } finally { f.dispose(); }
});
it('interrupts an in-flight monitor test before a cut and resumes its preview without changing the test reference routes', async () => {
  const f = fixture();
  try {
    await f.director.initialize(); f.cameras.select(4); f.director.configureTransition({ mode: 'dissolve', durationMs: 1000 });
    const test = f.preview.test(); await f.tick(500);
    await f.director.assign(7, [1], { mode: 'cut' }); await test; await f.ready();
    expect(f.director.snapshot().routes).toEqual({ 1: 7, 2: 1, 3: 1 }); expect(f.displayed()?.label).toBe('C4');
    expect(f.router.stats()).toMatchObject({ active: 3, allocated: 3 });
  } finally { f.dispose(); }
});
it('suspends consumers for a quality replacement, rejects competing cuts, and recovers the preview after failure', async () => {
  const f = fixture();
  try {
    await f.director.initialize(); f.cameras.select(4); await f.preview.activate(); const gate = deferred();
    const quality = f.director.changeQuality(async () => { expect(f.router.stats().allocated).toBe(1); await gate.ready; await f.router.replaceFeeds(f.createFeed); });
    await vi.waitFor(() => expect(f.preview.snapshot().phase).toBe('suspended'));
    await expect(f.director.assign(7, [1])).rejects.toThrow('qualité'); gate.resolve(); await quality; await f.ready();
    expect(f.displayed()?.label).toBe('C4'); const routes = f.director.snapshot().routes;
    await expect(f.director.changeQuality(async () => { throw new Error('profil impossible'); })).rejects.toThrow('profil'); await f.ready();
    expect(f.director.snapshot().routes).toEqual(routes); expect(f.displayed()?.label).toBe('C4');
  } finally { f.dispose(); }
});
it('restores the simple preview after shader failure and cleans a late preparation after cancellation', async () => {
  const f = fixture();
  try {
    await f.director.initialize(); f.cameras.select(4); f.director.configureTransition({ mode: 'dissolve' });
    vi.mocked(f.view.prepare).mockRejectedValueOnce(new Error('shader impossible')); await f.preview.test();
    expect(f.preview.snapshot()).toMatchObject({ phase: 'error', source: 4 }); expect(f.displayed()?.label).toBe('C4'); expect(f.router.stats().consumers).toEqual({ 1: 3, 4: 1 });
    const gate = deferred(); const rollback = vi.fn();
    vi.mocked(f.view.prepare).mockImplementationOnce(async () => { await gate.ready; return { render: vi.fn(), commit: vi.fn(), complete: vi.fn(), rollback } as PreparedTransition; });
    const running = f.preview.test(); await vi.waitFor(() => expect(f.preview.snapshot().phase).toBe('testing'));
    await f.preview.deactivate(); await running; gate.resolve(); await vi.waitFor(() => expect(rollback).toHaveBeenCalledOnce());
    expect(f.displayed()).toBe(null); expect(f.router.stats()).toMatchObject({ active: 1, allocated: 1 });
  } finally { f.dispose(); }
});
it('maps spatial preview commands, states and disabled tests without confusing preview with on-air routes', async () => {
  const f = fixture(); const editor = new CameraEditor(f.cameras, { suspend() {}, resume() {} });
  const panel = new DirectorPanel(f.cameras, f.director, editor, { render() {} }, () => undefined, undefined, f.preview);
  try {
    await f.director.initialize(); f.cameras.select(4); await panel.activate('preview-toggle');
    expect(panel.model().previewLabel).toContain('Aperçu C4'); expect(panel.model().routes[0]).toBe('Écran 1 ← C1');
    f.director.toggleTarget(1); expect(panel.model().buttons.find((button) => button.id === 'preview-test')?.enabled).toBe(false);
    await panel.activate('preview-toggle'); expect(panel.model().previewLabel).toContain('désactivé');
  } finally { panel.dispose(); editor.dispose(); f.dispose(); }
});
