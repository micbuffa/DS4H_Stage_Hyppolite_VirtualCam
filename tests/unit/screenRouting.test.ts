import { expect, it } from 'vitest';
import { emptyRouting, planRouting, sameRouting } from '../../src/domain/direction/screenRouting';
import { routingFixture, deferred } from '../helpers/routingFixture';

const subsets = [[1], [2], [3], [1, 2], [1, 3], [2, 3], [1, 2, 3]];
it.each(subsets.map((targets) => [targets]))('routes a camera atomically to subset %j and keeps other screens unchanged', (targets) => {
  const initial = { 1: 1, 2: 2, 3: 3 } as const;
  const next = planRouting(initial, 7, targets);
  for (const id of [1, 2, 3] as const) expect(next[id]).toBe(targets.includes(id) ? 7 : initial[id]);
  expect(initial).toEqual({ 1: 1, 2: 2, 3: 3 });
});
it.each([[0, [1]], [10, [1]], [NaN, [1]], [1, []], [1, [0]], [1, [1, 4]], [1, [1.5]]] as const)('rejects invalid routing input %j / %j', (camera, targets) => {
  const initial = emptyRouting();
  expect(() => planRouting(initial, camera, targets)).toThrow();
  expect(initial).toEqual(emptyRouting());
});
it('accepts duplicate targets without assigning additional screens', () => {
  expect(planRouting(emptyRouting(), 4, [1, 1, 3])).toEqual({ 1: 4, 2: null, 3: 4 });
  expect(sameRouting(emptyRouting(), emptyRouting())).toBe(true);
});

it('starts on C1 for all screens while only screen 1 remains targeted', async () => {
  const f = routingFixture();
  try {
    await f.director.initialize();
    expect(f.director.snapshot()).toMatchObject({ selectedId: 1, targets: [1], routes: { 1: 1, 2: 1, 3: 1 }, pending: null, error: null });
    expect(f.router.stats()).toMatchObject({ allocated: 1, active: 1, consumers: { 1: 3 } });
    expect(f.current.get(1)).toBe(f.current.get(2));
    expect(f.current.get(2)).toBe(f.current.get(3));
    f.cameras.select(4);
    expect(f.director.snapshot().routes).toEqual({ 1: 1, 2: 1, 3: 1 });
    await f.director.broadcast();
    expect(f.director.snapshot().routes).toEqual({ 1: 4, 2: 1, 3: 1 });
    expect(f.director.snapshot().targets).toEqual([1]);
  } finally { f.director.dispose(); }
});
it('toggles empty/multiple targets, selects all idempotently, and refuses an empty broadcast', async () => {
  const f = routingFixture();
  try {
    f.director.toggleTarget(1);
    await expect(f.director.broadcast()).rejects.toThrow('au moins');
    expect(f.createFeed).not.toHaveBeenCalled();
    f.director.selectAllTargets(); f.director.selectAllTargets();
    expect(f.director.snapshot().targets).toEqual([1, 2, 3]);
    f.director.toggleTarget(2);
    expect(f.director.snapshot().targets).toEqual([1, 3]);
    expect(() => f.director.toggleTarget(4)).toThrow('écran');
    f.director.snapshot().targets.push(2);
    expect(f.director.snapshot().targets).toEqual([1, 3]);
  } finally { f.director.dispose(); }
});
it('treats an identical assignment as a no-op without allocating or waiting for another frame', async () => {
  const f = routingFixture();
  try {
    await f.director.initialize();
    const creations = f.createFeed.mock.calls.length;
    const presentations = f.waitForPresentation.mock.calls.length;
    await f.director.assign(1, [1, 2, 3]);
    expect(f.createFeed).toHaveBeenCalledTimes(creations);
    expect(f.waitForPresentation).toHaveBeenCalledTimes(presentations);
  } finally { f.director.dispose(); }
});
it('preserves all old routes and images on source preparation failure', async () => {
  const f = routingFixture();
  try {
    await f.director.initialize();
    const previous = [...f.current];
    f.failures.add(8);
    await expect(f.director.assign(8, [1, 3])).rejects.toThrow('unavailable');
    expect([...f.current]).toEqual(previous);
    expect(f.director.snapshot().routes).toEqual({ 1: 1, 2: 1, 3: 1 });
    expect(f.director.snapshot().error).toContain('conservée');
    expect(f.router.stats().active).toBe(1);
  } finally { f.director.dispose(); }
});
it('keeps startup without signal on failure and can retry successfully', async () => {
  const f = routingFixture();
  try {
    f.failures.add(1);
    await expect(f.director.initialize()).rejects.toThrow();
    expect(f.director.snapshot().routes).toEqual(emptyRouting());
    expect(f.director.snapshot().error).toContain('sans signal');
    expect([...f.current]).toEqual([...f.originals]);
    f.failures.clear();
    await f.director.initialize();
    expect(f.director.snapshot().routes).toEqual({ 1: 1, 2: 1, 3: 1 });
  } finally { f.director.dispose(); }
});
it('commits the camera and targets captured at invocation, independently of later selections', async () => {
  const f = routingFixture();
  try {
    await f.director.initialize();
    f.delayed.add(4); f.cameras.select(4);
    const cut = f.director.broadcast();
    f.cameras.select(6); f.director.toggleTarget(3);
    await expect(f.director.broadcast()).rejects.toThrow('déjà');
    expect(f.director.snapshot().routes).toEqual({ 1: 1, 2: 1, 3: 1 });
    f.feeds.find((feed) => feed.id === 4)!.resolve(); await cut;
    expect(f.director.snapshot()).toMatchObject({ selectedId: 6, targets: [1, 3], routes: { 1: 4, 2: 1, 3: 1 } });
  } finally { f.director.dispose(); }
});
it('rolls back all screen textures if presentation fails after the atomic swap', async () => {
  const f = routingFixture();
  try {
    await f.director.initialize();
    const previous = [...f.current];
    const presentation = deferred();
    f.waitForPresentation.mockReturnValue({ ready: presentation.ready, dispose: presentation.reject.bind(null, new Error('cancelled')) });
    const cut = f.director.assign(4, [1, 2]);
    const result = expect(cut).rejects.toThrow('presentation failed');
    presentation.reject(new Error('presentation failed'));
    await result;
    expect([...f.current]).toEqual(previous);
    expect(f.director.snapshot().routes).toEqual({ 1: 1, 2: 1, 3: 1 });
    expect(f.feeds.find((feed) => feed.id === 4)!.dispose).toHaveBeenCalledOnce();
  } finally { f.director.dispose(); }
});
