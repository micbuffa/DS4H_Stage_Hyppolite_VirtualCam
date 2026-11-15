import { expect, it, vi } from 'vitest';
import { routingFixture, deferred } from '../helpers/routingFixture';
import type { FakeTexture } from '../helpers/routingFixture';
import type { TransitionCompositionPort } from '../../src/application/ports/transition';
import { planTransition, transitionFrame } from '../../src/domain/direction/transitionPlan';
import { basicTransitionWeights } from '../../src/domain/direction/basicTransitions';
import { CameraEditor } from '../../src/application/commands/cameraEditor';

const composition = () => {
  const session = { render: vi.fn(), commit: vi.fn(async (): Promise<void> => undefined), complete: vi.fn(), rollback: vi.fn() };
  const port: TransitionCompositionPort<FakeTexture> = { prepare: vi.fn(async () => session) };
  return { session, port };
};
it('keeps all three old sources live while preparing a fourth and releases them only after presentation', async () => {
  const f = routingFixture(); const visual = composition();
  try {
    await f.director.initialize(); await f.director.assign(2, [2]); await f.director.assign(3, [3]);
    const before = f.director.snapshot().routes;
    const plan = planTransition(before, 8, [1, 2, 3], { mode: 'dissolve' });
    const transaction = await f.router.prepareTransition(plan, visual.port, new AbortController().signal);
    expect(f.router.stats()).toMatchObject({ active: 4, allocated: 4 });
    expect(f.feeds.every((feed) => feed.enabled)).toBe(true);
    const pairs = vi.mocked(visual.port.prepare).mock.calls[0][1];
    expect([...pairs.values()].map((pair) => pair.from!.label)).toEqual(['C3', 'C1', 'C2']);
    expect(new Set([...pairs.values()].map((pair) => pair.to)).size).toBe(1);
    transaction.render(transitionFrame(plan, 300));
    expect(visual.session.render.mock.calls[0][0].screens.every((item: { progress: number }) => item.progress === 0.5)).toBe(true);
    const presentation = deferred(); visual.session.commit.mockReturnValueOnce(presentation.ready);
    const presenting = transaction.commit();
    expect(new Set(f.current.values()).size).toBe(1);
    expect(f.router.stats().allocated).toBe(4);
    expect(() => transaction.complete()).toThrow('Présenter');
    presentation.resolve(); await presenting; transaction.complete();
    expect(f.router.stats()).toMatchObject({ active: 1, allocated: 1, consumers: { 8: 3 } });
    expect(f.maxActive()).toBe(4);
    expect(visual.session.complete).toHaveBeenCalledOnce();
    for (const feed of f.feeds.filter((item) => item.id !== 8)) expect(feed.dispose).toHaveBeenCalledOnce();
  } finally { f.director.dispose(); }
});
it('restores textures and consumers when cancelled after the texture swap', async () => {
  const f = routingFixture(); const visual = composition();
  try {
    await f.director.initialize(); const previous = [...f.current];
    const signal = new AbortController();
    const transaction = await f.router.prepareTransition(planTransition(f.director.snapshot().routes, 4, [1, 3], { mode: 'wipe' }), visual.port, signal.signal);
    const presentation = deferred(); visual.session.commit.mockReturnValueOnce(presentation.ready);
    const pending = transaction.commit(); const rejected = expect(pending).rejects.toThrow('annulée');
    signal.abort(); presentation.resolve(); await rejected;
    transaction.rollback();
    expect([...f.current]).toEqual(previous);
    expect(f.router.stats()).toMatchObject({ active: 1, allocated: 1, consumers: { 1: 3 } });
    expect(visual.session.rollback).toHaveBeenCalledOnce();
    expect(f.feeds.find((feed) => feed.id === 4)!.dispose).toHaveBeenCalledOnce();
  } finally { f.director.dispose(); }
});
it.each(['source', 'shader'])('releases partial acquisitions on %s preparation failure without touching the direct', async (failure) => {
  const f = routingFixture(); const visual = composition();
  try {
    await f.director.initialize(); const previous = [...f.current];
    if (failure === 'source') f.failures.add(4);
    else vi.mocked(visual.port.prepare).mockRejectedValueOnce(new Error('shader failure'));
    await expect(f.router.prepareTransition(planTransition(f.director.snapshot().routes, 4, [1], { mode: 'dissolve' }), visual.port, new AbortController().signal)).rejects.toThrow();
    expect([...f.current]).toEqual(previous);
    expect(f.router.stats()).toMatchObject({ active: 1, allocated: 1, consumers: { 1: 3 } });
    await f.director.assign(7, [1]); expect(f.director.snapshot().routes[1]).toBe(7);
  } finally { f.director.dispose(); }
});
it('owns shared leases, rendering requests and last-consumer destruction independently of live screens', async () => {
  const f = routingFixture(); const signal = new AbortController();
  try {
    await f.director.initialize();
    const a = f.router.retain({ owner: 'a', source: 4, use: 'transition', rendering: true }, signal.signal);
    const b = f.router.retain({ owner: 'b', source: 4, use: 'transition', rendering: true }, signal.signal);
    await Promise.all([a.ready, b.ready]); expect(a.texture).toBe(b.texture);
    a.setRenderingEnabled(false); expect(f.router.stats().active).toBe(2);
    b.setRenderingEnabled(false); expect(f.router.stats().active).toBe(1);
    a.dispose(); expect(f.router.stats().allocated).toBe(2);
    b.dispose(); b.dispose(); expect(f.router.stats().allocated).toBe(1);
    const live = f.router.retain({ owner: 'shared', source: 1, use: 'transition', rendering: true }, signal.signal);
    await live.ready; live.dispose(); expect(f.router.stats().allocated).toBe(1);
    const delayed = f.router.retain({ owner: 'stop', source: 7, use: 'transition', rendering: true }, signal.signal);
    signal.abort(); await expect(delayed.ready).rejects.toThrow('annulée');
    expect(f.router.stats().allocated).toBe(1);
    for (const feed of f.feeds.filter((item) => item.id !== 1)) expect(feed.dispose).toHaveBeenCalledOnce();
  } finally { f.director.dispose(); }
});
it('refuses an extra live source before allocation and refuses duplicate consumers', async () => {
  const f = routingFixture(); const signal = new AbortController().signal;
  try {
    await f.director.initialize(); await f.director.assign(2, [2]); await f.director.assign(3, [3]);
    const lease = f.router.retain({ owner: 'fourth', source: 4, use: 'transition', rendering: true }, signal);
    await lease.ready;
    expect(() => f.router.retain({ owner: 'fifth', source: 5, use: 'transition', rendering: true }, signal)).toThrow('Budget');
    expect(() => f.router.retain({ owner: 'fourth', source: 4, use: 'transition', rendering: true }, signal)).toThrow('dupliqué');
    expect(f.feeds).toHaveLength(4); lease.dispose();
  } finally { f.director.dispose(); }
});
it('locks editing through commands and gesture entry while keeping other cameras editable', () => {
  const f = routingFixture(); let locked = true;
  const editor = new CameraEditor(f.cameras, { suspend: vi.fn(), resume: vi.fn() }, (id) => locked && id === 1);
  try {
    const initial = editor.selected(); editor.setMode('move');
    expect(() => editor.begin()).toThrow('verrouillée'); expect(() => editor.adjustFov(5)).toThrow('verrouillée');
    expect(() => editor.aim()).toThrow('verrouillée'); expect(() => editor.reset()).toThrow('verrouillée');
    expect(editor.selected()).toEqual(initial);
    f.cameras.select(2); expect(() => editor.adjustFov(5)).not.toThrow();
    f.cameras.select(1); locked = false; editor.begin(); expect(editor.snapshot().dragging).toBe(true); editor.cancel();
  } finally { editor.dispose(); f.director.dispose(); }
});
it('defines exact endpoints, a black midpoint and directional wipe samples', () => {
  for (const mode of ['dissolve', 'dip-black', 'wipe'] as const) {
    expect(basicTransitionWeights(mode, 0)).toEqual([1, 0]); expect(basicTransitionWeights(mode, 1)).toEqual([0, 1]);
  }
  expect(basicTransitionWeights('dissolve', 0.25)).toEqual([0.75, 0.25]);
  expect(basicTransitionWeights('dip-black', 0.5)).toEqual([0, 0]);
  expect(basicTransitionWeights('dip-black', 0.25)).toEqual([0.5, 0]);
  expect(basicTransitionWeights('dip-black', 0.75)).toEqual([0, 0.5]);
  expect(basicTransitionWeights('wipe', 0.5, [0.2, 0.8], 'left')).toEqual([0, 1]);
  expect(basicTransitionWeights('wipe', 0.5, [0.2, 0.8], 'right')).toEqual([1, 0]);
  expect(basicTransitionWeights('wipe', 0.5, [0.2, 0.8], 'up')).toEqual([0, 1]);
  expect(basicTransitionWeights('wipe', 0.5, [0.2, 0.8], 'down')).toEqual([1, 0]);
  expect(() => basicTransitionWeights('wipe', NaN)).toThrow();
});
