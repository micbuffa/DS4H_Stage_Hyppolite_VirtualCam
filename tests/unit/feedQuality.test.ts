import { expect, it } from 'vitest';
import { feedSizeFor } from '../../src/domain/rendering/feedQuality';
import { validateFeedSize } from '../../src/domain/rendering/cameraFeed';
import { routingFixture } from '../helpers/routingFixture';

it('accepts two bounded 16:9 sizes and rejects unknown profiles', () => {
  expect(feedSizeFor('standard')).toEqual({ width: 1024, height: 576 });
  expect(feedSizeFor('reduced')).toEqual({ width: 512, height: 288 });
  for (const profile of ['standard', 'reduced']) validateFeedSize(feedSizeFor(profile));
  expect(() => feedSizeFor('custom')).toThrow(RangeError);
});

it('replaces all three textures with the same assignments and releases each generation once', async () => {
  const fixture = routingFixture();
  try {
    await fixture.director.initialize();
    await fixture.director.assign(2, [2]);
    await fixture.director.assign(3, [3]);
    const routes = fixture.director.snapshot().routes;
    const previous = [...fixture.current.values()];
    await fixture.router.replaceFeeds(fixture.createFeed);
    expect(fixture.director.snapshot().routes).toEqual(routes);
    expect([...fixture.current.values()].map((texture) => texture.label)).toEqual(['C1', 'C2', 'C3']);
    expect([...fixture.current.values()].every((texture, index) => texture !== previous[index])).toBe(true);
    expect(fixture.maxActive()).toBe(3);
  } finally { fixture.director.dispose(); }
  for (const feed of fixture.feeds) expect(feed.dispose).toHaveBeenCalledTimes(1);
});

it('retains the current picture when a replacement source fails and rejects commands after disposal', async () => {
  const fixture = routingFixture();
  await fixture.director.initialize();
  const previous = fixture.current.get(1);
  fixture.failures.add(1);
  await expect(fixture.router.replaceFeeds(fixture.createFeed)).rejects.toThrow('unavailable');
  expect(fixture.current.get(1)).toBe(previous);
  expect(fixture.router.stats().active).toBe(1);
  fixture.director.dispose();
  await expect(fixture.router.replaceFeeds(fixture.createFeed)).rejects.toThrow('arrêtée');
  await expect(fixture.director.broadcast()).rejects.toThrow('arrêtée');
});
