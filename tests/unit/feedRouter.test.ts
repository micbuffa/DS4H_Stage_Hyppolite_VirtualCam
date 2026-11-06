import { expect, it } from 'vitest';
import { routingFixture } from '../helpers/routingFixture';

it('uses one shared feed, three distinct feeds, then one again, releasing last consumers once', async () => {
  const f = routingFixture();
  await f.director.initialize();
  await f.director.assign(4, [1]);
  await f.director.assign(7, [2, 3]);
  expect(f.router.stats()).toMatchObject({ allocated: 2, active: 2, consumers: { 4: 1, 7: 2 } });
  expect(f.feeds.find((feed) => feed.id === 1)!.dispose).toHaveBeenCalledOnce();
  await f.director.assign(9, [3]);
  expect(f.router.stats().active).toBe(3);
  await f.director.assign(8, [1, 2, 3]);
  expect(f.router.stats()).toMatchObject({ allocated: 1, active: 1, consumers: { 8: 3 } });
  expect(f.maxActive()).toBeLessThanOrEqual(3);
  f.director.dispose(); f.director.dispose();
  for (const feed of f.feeds) expect(feed.dispose).toHaveBeenCalledOnce();
  expect([...f.current]).toEqual([...f.originals]);
});
it('retains the last valid old image and pauses an obsolete source while warming a fourth allocation', async () => {
  const f = routingFixture();
  try {
    await f.director.initialize(); await f.director.assign(2, [2]); await f.director.assign(3, [3]);
    const previous = f.current.get(1);
    f.delayed.add(4);
    const cut = f.director.assign(4, [1]);
    expect(f.current.get(1)).toBe(previous);
    expect(f.router.stats()).toMatchObject({ allocated: 4, active: 3 });
    expect(f.feeds.find((feed) => feed.id === 1)!.enabled).toBe(false);
    f.feeds.find((feed) => feed.id === 4)!.resolve(); await cut;
    expect(f.director.snapshot().routes).toEqual({ 1: 4, 2: 2, 3: 3 });
    expect(f.router.stats()).toMatchObject({ allocated: 3, active: 3 });
    expect(f.maxActive()).toBe(3);
  } finally { f.director.dispose(); }
});
it('resumes the old source if a candidate fails while all render slots were occupied', async () => {
  const f = routingFixture();
  try {
    await f.director.initialize(); await f.director.assign(2, [2]); await f.director.assign(3, [3]);
    const previous = [...f.current];
    f.delayed.add(4);
    const cut = f.director.assign(4, [1]);
    const rejected = expect(cut).rejects.toThrow('candidate failed');
    f.feeds.find((feed) => feed.id === 4)!.reject(new Error('candidate failed')); await rejected;
    expect([...f.current]).toEqual(previous);
    expect(f.feeds.find((feed) => feed.id === 1)!.enabled).toBe(true);
    expect(f.router.stats()).toMatchObject({ allocated: 3, active: 3 });
    expect(f.director.snapshot().routes).toEqual({ 1: 1, 2: 2, 3: 3 });
  } finally { f.director.dispose(); }
});
it('cancels pending preparation on disposal without late screen mutations', async () => {
  const f = routingFixture();
  await f.director.initialize(); f.delayed.add(4);
  const cut = f.director.assign(4, [1]);
  const rejected = expect(cut).rejects.toThrow();
  f.director.dispose(); await rejected;
  expect([...f.current]).toEqual([...f.originals]);
  expect(f.router.stats().allocated).toBe(0);
  await expect(f.director.assign(1, [1])).rejects.toThrow('arrêtée');
  for (const feed of f.feeds) expect(feed.dispose).toHaveBeenCalledOnce();
});
