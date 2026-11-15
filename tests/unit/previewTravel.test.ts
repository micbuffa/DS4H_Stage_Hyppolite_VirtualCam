import { expect, it, vi } from 'vitest';
import { PreviewController } from '../../src/application/commands/previewController';
import { RoutingDirector } from '../../src/application/commands/routingDirector';
import { createTravelPass } from '../../src/application/commands/createTravelPass';
import { transitionSettings } from '../../src/domain/direction/transitionDefinition';
import { previewLabel } from '../../src/application/presentation/previewPanelModel';
import type { PreviewViewPort } from '../../src/application/ports/preview';
import type { TransitionPlan } from '../../src/domain/direction/transitionPlan';
import { routingFixture, deferred } from '../helpers/routingFixture';
import type { FakeTexture } from '../helpers/routingFixture';

function fixture() {
  const temporary = { texture: { label: 'TEMP' }, ready: Promise.resolve(), dispose: vi.fn(), setRenderingEnabled: vi.fn(), setPose: vi.fn(), waitForFrame: vi.fn(async () => {}) };
  const f = routingFixture(undefined, undefined, () => temporary); let director = f.director;
  let image: FakeTexture | null = null, arrival: FakeTexture | undefined, time = 0, sample: ((time: number) => void) | undefined;
  const view: PreviewViewPort<FakeTexture> = { supportsTravel: true, show: vi.fn((texture) => { image = texture; }), present: vi.fn(async () => {}),
    prepare: vi.fn(async (plan, from, to, signal) => {
      arrival = to;
      return createTravelPass<FakeTexture>({ sources: f.router, surfaces: new Map([[plan.steps[0].screen, { getTexture: () => image, setTexture: (texture) => { image = texture; } }]]),
        waitForPresentation: () => ({ ready: Promise.resolve(), dispose() {} }) }).prepare(plan, new Map([[plan.steps[0].screen, { from, to }]]), signal);
    }) };
  const preview = new PreviewController(f.cameras, f.router, view, { supportedModes: ['virtual-travel'], sample: () => ({ nowMs: time, visible: true }),
    nextSample: (signal) => new Promise((resolve, reject) => {
      const cancel = () => { sample = undefined; reject(new Error('annulé')); }; signal.addEventListener('abort', cancel, { once: true });
      sample = (now) => { signal.removeEventListener('abort', cancel); sample = undefined; time = now; resolve({ nowMs: now, visible: true }); };
    }) }, () => { const state = director.snapshot(); return { routes: state.routes, targets: state.targets, settings: director.transitionSettings(), blocked: state.pending !== null || !!state.qualityPending }; });
  director = new RoutingDirector(f.cameras, f.router, undefined, undefined, preview);
  const setup = async () => { await director.initialize(); await director.assign(2, [2]); await director.assign(3, [3]); f.cameras.select(4); await preview.activate(); director.configureTransition({ mode: 'virtual-travel', durationMs: 1000 }); };
  const tick = async (now: number) => { await vi.waitFor(() => expect(sample).toBeDefined()); sample!(now); await vi.waitFor(() => expect(preview.snapshot().progress).toBe(now < 1000 ? now / 1000 : 0)); };
  return { ...f, director, preview, view, temporary, setup, tick, image: () => image, arrival: () => arrival,
    dispose: () => { preview.dispose(); director.dispose(); f.director.dispose(); } };
}

it('tests only the reference monitor with five shared sources, then promotes the same B texture to simple preview', async () => {
  const f = fixture();
  try {
    await f.setup(); const routes = f.director.snapshot().routes, live = [...f.current], definitions = f.cameras.snapshot();
    const run = f.preview.test(); await f.tick(500);
    expect(f.router.stats()).toMatchObject({ active: 5, allocated: 5 }); expect(f.image()).toBe(f.temporary.texture);
    expect(f.preview.snapshot()).toMatchObject({ temporary: true, destination: 4, source: null, reference: 1, referenceSource: 1, progress: 0.5 });
    expect(previewLabel(f.preview.snapshot())).toContain('Trajet C1 → C4');
    expect(f.director.isCameraLocked(1)).toBe(true); expect(f.director.isCameraLocked(4)).toBe(true);
    expect(f.feeds.filter((feed) => [1, 2, 3].includes(feed.id)).every((feed) => feed.enabled)).toBe(true);
    expect([...f.current]).toEqual(live); expect(f.cameras.snapshot()).toEqual(definitions); expect(f.director.snapshot().routes).toEqual(routes);
    const allocations = f.createFeed.mock.calls.length, arrival = f.arrival();
    await f.tick(1000); await run;
    expect(f.image()).toBe(arrival); expect(f.createFeed).toHaveBeenCalledTimes(allocations); expect(f.temporary.dispose).toHaveBeenCalledOnce();
    expect(f.router.stats()).toMatchObject({ active: 4, allocated: 4, consumers: { 1: 1, 2: 1, 3: 1, 4: 1 } });
    expect(f.preview.snapshot()).toMatchObject({ phase: 'ready', source: 4 }); expect(f.director.isCameraLocked(1)).toBe(false);
  } finally { f.dispose(); }
});

it.each(['cancel', 'selection', 'hide', 'broadcast', 'quality', 'dispose'])('releases the travel before %s and never leaves a temporary source or stale monitor image', async (action) => {
  const f = fixture();
  try {
    await f.setup(); const run = f.preview.test(); await f.tick(500);
    if (action === 'cancel') await f.preview.stopTest();
    else if (action === 'selection') f.cameras.select(7);
    else if (action === 'hide') await f.preview.deactivate();
    else if (action === 'broadcast') await f.director.assign(6, [1], { mode: 'cut' });
    else if (action === 'quality') await f.director.changeQuality(async () => { expect(f.router.stats().active).toBe(3); });
    else f.preview.dispose();
    await run;
    if (!['hide', 'dispose'].includes(action)) await vi.waitFor(() => expect(f.preview.snapshot()).toMatchObject({ phase: 'ready', source: action === 'selection' ? 7 : 4 }));
    else expect(f.image()).toBeNull();
    expect(f.router.stats().active).toBeLessThanOrEqual(4); expect(f.router.stats().consumers).not.toHaveProperty('temporary');
    expect(f.temporary.dispose).toHaveBeenCalledOnce(); expect(f.director.snapshot().routes).toEqual(action === 'broadcast' ? { 1: 6, 2: 2, 3: 3 } : { 1: 1, 2: 2, 3: 3 });
  } finally { f.dispose(); }
});

it('refuses a blocked path before suspending the actual preview or acquiring a temporary source', async () => {
  const f = fixture();
  try {
    await f.setup(); const image = f.image(), allocations = f.createFeed.mock.calls.length;
    f.director.configureTransition({ mode: 'virtual-travel', waypoints: [[0, 1.6, 10]] });
    await expect(f.preview.test()).rejects.toThrow('plateau'); expect(f.image()).toBe(image); expect(f.createFeed).toHaveBeenCalledTimes(allocations);
    expect(f.view.prepare).not.toHaveBeenCalled(); expect(f.preview.snapshot().phase).toBe('ready');
  } finally { f.dispose(); }
});

it('recovers simple preview after partial preparation failure, and discards an abandoned late composition', async () => {
  const f = fixture();
  try {
    await f.setup(); vi.mocked(f.view.prepare).mockRejectedValueOnce(new Error('Préparation de trajet impossible.'));
    await f.preview.test(); expect(f.preview.snapshot()).toMatchObject({ phase: 'error', source: 4 }); expect(f.router.stats().active).toBe(4);
    const gate = deferred(), rollback = vi.fn();
    vi.mocked(f.view.prepare).mockImplementationOnce(async () => { await gate.ready; return { render: vi.fn(), commit: vi.fn(async () => {}), complete: vi.fn(), rollback }; });
    const run = f.preview.test(); await vi.waitFor(() => expect(f.view.prepare).toHaveBeenCalledTimes(2));
    await f.preview.deactivate(); await run; gate.resolve(); await vi.waitFor(() => expect(rollback).toHaveBeenCalledOnce());
    expect(f.image()).toBeNull(); expect(f.router.stats()).toMatchObject({ active: 3, allocated: 3 });
  } finally { f.dispose(); }
});

it('captures the requested path and settings before asynchronous source preparation', async () => {
  const f = fixture();
  try {
    await f.setup(); f.delayed.add(4);
    const run = f.preview.test(); await vi.waitFor(() => expect(f.feeds.filter((feed) => feed.id === 4)).toHaveLength(2));
    f.director.configureTransition({ mode: 'virtual-travel', waypoints: [[0, 20, 0]], durationMs: 5000 });
    f.feeds.at(-1)!.resolve(); await f.tick(500);
    const plan = vi.mocked(f.view.prepare).mock.calls[0][0] as TransitionPlan;
    expect(plan.settings).toMatchObject(transitionSettings({ mode: 'virtual-travel', durationMs: 1000 })); expect(plan.travel![0].path.points).toHaveLength(2);
    await f.preview.stopTest(); await run;
  } finally { f.dispose(); }
});

it('locks captured participants immediately and cancels a pending request before releasing the simple preview', async () => {
  const f = fixture();
  try {
    await f.setup(); const image = f.image(), run = f.preview.test();
    expect(f.director.isCameraLocked(1)).toBe(true); expect(f.director.isCameraLocked(4)).toBe(true); expect(f.director.isCameraLocked(7)).toBe(false);
    await f.preview.stopTest(); await run;
    expect(f.image()).toBe(image); expect(f.view.prepare).not.toHaveBeenCalled(); expect(f.director.isCameraLocked(1)).toBe(false);
    expect(f.router.stats()).toMatchObject({ active: 4, allocated: 4 });
  } finally { f.dispose(); }
});

it('restores the already prepared arrival image after a temporary draw error without replacing its RTT', async () => {
  const f = fixture();
  try {
    await f.setup(); const run = f.preview.test(); await f.tick(500); const arrival = f.arrival(), allocations = f.createFeed.mock.calls.length;
    f.temporary.waitForFrame.mockRejectedValueOnce(new Error('Dessin temporaire impossible.'));
    await f.tick(1000); await run;
    expect(f.preview.snapshot()).toMatchObject({ phase: 'error', source: 4 }); expect(f.image()).toBe(arrival);
    expect(f.createFeed).toHaveBeenCalledTimes(allocations); expect(f.temporary.dispose).toHaveBeenCalledOnce(); expect(f.router.stats().active).toBe(4);
  } finally { f.dispose(); }
});
