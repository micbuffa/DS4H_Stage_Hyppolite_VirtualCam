import { expect, it, vi } from 'vitest';
import { FeedRouter } from '../../src/application/commands/feedRouter';
import type { RoutableFeed, TravelFeed } from '../../src/application/ports/routing';
import type { SourceConsumer } from '../../src/domain/rendering/sourceBudget';
import type { TravelPose } from '../../src/domain/cameras/travelPath';
import { createTravelPath } from '../../src/domain/cameras/travelPath';
import { createCameraPresets } from '../../src/domain/cameras/cameraPresets';
import type { RoutingTable, ScreenId } from '../../src/domain/direction/screenRouting';
import { planTransition } from '../../src/domain/direction/transitionPlan';
import { deferred } from '../helpers/routingFixture';

const definitions = createCameraPresets();
const path = createTravelPath(definitions[0], definitions[3]);
function fixture() {
  const current = new Map<ScreenId, string>([[1, 'offline-1'], [2, 'offline-2'], [3, 'offline-3']]);
  const entries: { id: SourceConsumer['source']; enabled: boolean; disposed: boolean; feed: RoutableFeed<string> }[] = [];
  let tempReady: Promise<void> = Promise.resolve(), failure = false, peak = 0;
  const record = () => { peak = Math.max(peak, entries.filter((item) => item.enabled && !item.disposed).length); };
  const make = (id: SourceConsumer['source'], ready = Promise.resolve()) => {
    const entry = { id, enabled: true, disposed: false, feed: undefined as unknown as RoutableFeed<string> };
    const feed = { texture: `feed-${id}`, ready, dispose: vi.fn(() => { entry.disposed = true; entry.enabled = false; }),
      setRenderingEnabled: vi.fn((enabled: boolean) => { entry.enabled = enabled; record(); }) };
    entry.feed = feed; entries.push(entry); record(); return feed;
  };
  const createTemporary = vi.fn((_pose: TravelPose): TravelFeed<string> => {
    void _pose;
    if (failure) throw new Error('Allocation temporaire impossible.');
    return { ...make('temporary', tempReady), setPose: vi.fn(), waitForFrame: vi.fn(async () => {}) };
  });
  const router = new FeedRouter({ screens: new Map([...current.keys()].map((id) => [id, { getTexture: () => current.get(id)!, setTexture: (texture: string | null) => { current.set(id, texture!); } }])),
    createFeed: vi.fn((id) => make(id)), createTemporary, waitForPresentation: () => ({ ready: Promise.resolve(), dispose() {} }) });
  const commit = async (routes: RoutingTable) => { const tx = await router.prepare(routes); await tx.commit(); tx.complete(); };
  return { router, current, entries, createTemporary, commit, peak: () => peak, delay: (ready: Promise<void>) => { tempReady = ready; }, fail: () => { failure = true; } };
}

it('owns exactly one temporary camera in the existing five-source budget without freezing live sources', async () => {
  const f = fixture(); const signal = new AbortController().signal;
  try {
    await f.commit({ 1: 1, 2: 2, 3: 3 });
    const b = f.router.retain({ owner: 'destination', source: 4, use: 'travel', rendering: true }, signal);
    const temp = f.router.retainTemporary('travel', path.from, signal); await temp.ready;
    expect(f.router.stats()).toMatchObject({ allocated: 5, active: 5, sources: [1, 2, 3], consumers: { temporary: 1 } });
    expect(f.entries.every((entry) => entry.enabled)).toBe(true);
    expect(() => f.router.retainTemporary('second', path.to, signal)).toThrow('déjà');
    expect(() => f.router.retain({ owner: 'sixth', source: 5, use: 'travel', rendering: true }, signal)).toThrow('Budget');
    expect(() => f.router.retain({ owner: 'preview', source: 1, use: 'preview', rendering: false }, signal)).toThrow('prévisualisation');
    expect(f.entries).toHaveLength(5); expect(f.createTemporary).toHaveBeenCalledOnce();
    temp.setPose(path.to); await temp.waitForFrame(signal);
    const native = f.createTemporary.mock.results[0].value as TravelFeed<string>;
    expect(native.setPose).toHaveBeenCalledWith(path.to); expect(native.waitForFrame).toHaveBeenCalledWith(signal);
    temp.setRenderingEnabled(false); expect(f.router.stats().active).toBe(4); expect(temp.consumer.rendering).toBe(false);
    temp.setRenderingEnabled(true); expect(f.router.stats().active).toBe(5);
    temp.dispose(); temp.dispose(); expect(native.dispose).toHaveBeenCalledOnce();
    expect(() => temp.setPose(path.to)).toThrow('libérée'); await expect(temp.waitForFrame(signal)).rejects.toThrow('libérée');
    b.dispose(); expect(f.router.stats()).toMatchObject({ allocated: 3, active: 3 }); expect(f.peak()).toBe(5);
  } finally { f.router.dispose(); }
});

it('refuses a temporary reservation while a preview lease exists, even when both share live sources', async () => {
  const f = fixture(); const signal = new AbortController().signal;
  try {
    await f.commit({ 1: 1, 2: 1, 3: 1 });
    const preview = f.router.retain({ owner: 'preview', source: 1, use: 'preview', rendering: true }, signal);
    expect(() => f.router.retainTemporary('travel', path.from, signal)).toThrow('prévisualisation');
    expect(f.createTemporary).not.toHaveBeenCalled(); preview.dispose();
    f.router.retainTemporary('travel', path.from, signal).dispose(); expect(f.createTemporary).toHaveBeenCalledOnce();
  } finally { f.router.dispose(); }
});

it.each(['abort', 'failure', 'stop'])('cleans a pending temporary acquisition on %s and permits no stale mutation', async (reason) => {
  const f = fixture(); const controller = new AbortController(); const gate = deferred(); f.delay(gate.ready);
  try {
    await f.commit({ 1: 1, 2: 1, 3: 1 });
    const temp = f.router.retainTemporary('travel', path.from, controller.signal);
    const rejected = expect(temp.ready).rejects.toThrow();
    if (reason === 'abort') controller.abort(); else if (reason === 'stop') f.router.dispose(); else gate.reject(new Error('GPU indisponible.'));
    await rejected; await vi.waitFor(() => expect(f.entries.find((entry) => entry.id === 'temporary')!.disposed).toBe(true));
    expect(() => temp.setPose(path.to)).toThrow('libérée');
    expect(f.entries.find((entry) => entry.id === 'temporary')!.feed.dispose).toHaveBeenCalledOnce();
    gate.resolve(); await Promise.resolve();
    expect(f.router.stats().allocated).toBe(reason === 'stop' ? 0 : 1);
  } finally { f.router.dispose(); }
});

it('retains all rollback sources through travel preparation and releases the temporary source only with its owner', async () => {
  const f = fixture(); const controller = new AbortController();
  try {
    await f.commit({ 1: 1, 2: 2, 3: 3 }); const original = [...f.current];
    let temp: ReturnType<typeof f.router.retainTemporary> | undefined;
    const visual = { render: vi.fn(), commit: vi.fn(async () => {}), complete: vi.fn(() => temp!.dispose()), rollback: vi.fn(() => temp!.dispose()) };
    const plan = planTransition({ 1: 1, 2: 2, 3: 3 }, 4, [1, 2, 3], { mode: 'virtual-travel' });
    const tx = await f.router.prepareTransition(plan, { prepare: async () => { temp = f.router.retainTemporary('travel', path.from, controller.signal); await temp.ready; return visual; } }, controller.signal);
    expect(f.router.stats()).toMatchObject({ allocated: 5, active: 5 }); expect(f.peak()).toBe(5);
    await tx.commit(); expect([...f.current.values()]).toEqual(['feed-4', 'feed-4', 'feed-4']);
    expect(f.router.stats().allocated).toBe(5);
    controller.abort(); tx.rollback(); expect([...f.current]).toEqual(original);
    expect(f.router.stats()).toMatchObject({ allocated: 3, active: 3 }); expect(visual.rollback).toHaveBeenCalledOnce();
    expect(f.entries.filter((entry) => [1, 2, 3].includes(entry.id as number)).every((entry) => !entry.disposed && entry.enabled)).toBe(true);
  } finally { f.router.dispose(); }
});

it('releases partial acquisitions on temporary allocation failure without changing the direct', async () => {
  const f = fixture(); const signal = new AbortController().signal;
  try {
    await f.commit({ 1: 1, 2: 2, 3: 3 }); const original = [...f.current]; f.fail();
    const plan = planTransition({ 1: 1, 2: 2, 3: 3 }, 4, [1, 2, 3], { mode: 'virtual-travel' });
    await expect(f.router.prepareTransition(plan, { prepare: async () => { f.router.retainTemporary('travel', path.from, signal); throw new Error('unreachable'); } }, signal)).rejects.toThrow('Allocation');
    expect([...f.current]).toEqual(original); expect(f.router.stats()).toMatchObject({ allocated: 3, active: 3 });
    await f.commit({ 1: 2, 2: 2, 3: 2 }); expect(f.router.stats().allocated).toBe(1);
  } finally { f.router.dispose(); }
});

it('refuses aborted, unsupported or duplicate reservations before allocation', async () => {
  const f = fixture(); const controller = new AbortController(); controller.abort();
  try {
    await f.commit({ 1: 1, 2: 1, 3: 1 });
    expect(() => f.router.retainTemporary('travel', path.from, controller.signal)).toThrow('annulée');
    expect(f.createTemporary).not.toHaveBeenCalled();
    const signal = new AbortController().signal;
    const live = f.router.retain({ owner: 'same', source: 1, use: 'travel', rendering: true }, signal);
    expect(() => f.router.retainTemporary('same', path.from, signal)).toThrow('dupliqué');
    expect(f.createTemporary).not.toHaveBeenCalled(); live.dispose();
    expect(() => f.router.retain({ owner: 'raw', source: 'temporary', use: 'travel', rendering: true }, signal)).toThrow('pose');
    const unsupported = new FeedRouter({ createFeed: () => { throw new Error('unreachable'); }, screens: new Map([1, 2, 3].map((id) => [id as ScreenId, { getTexture: () => null, setTexture() {} }])), waitForPresentation: () => ({ ready: Promise.resolve(), dispose() {} }) });
    expect(() => unsupported.retainTemporary('travel', path.from, signal)).toThrow('indisponible'); unsupported.dispose();
  } finally { f.router.dispose(); }
});
