import { expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { createConcertScene } from '../../../src/infrastructure/babylon/engine/createObservationScene';
import { attachConcertShow } from '../../../src/infrastructure/babylon/engine/attachConcertShow';
import { createCameraFeed } from '../../../src/infrastructure/babylon/rendering/createCameraFeed';
import { performerMotion } from '../../../src/domain/concert/concertMotion';

it('animates the same filmable objects, freezes their poses, and releases the show', () => {
  const engine = new NullEngine();
  const concert = createConcertScene(engine, { count: 10, seed: 1 });
  const { scene, band, audience } = concert;
  try {
    vi.spyOn(engine, 'getDeltaTime').mockReturnValue(50);
    const show = attachConcertShow(concert);
    const feed = createCameraFeed(scene, concert.observer);
    void feed.ready.catch(() => undefined);
    const update = () => scene.onBeforeRenderObservable.notifyObservers(scene);
    update();
    expect(band.musicians[0].root.rotation.z).toBeCloseTo(performerMotion(0.05, 0).roll);
    expect(audience.spectators[0].position.y).toBeGreaterThan(0);
    expect(show.lighting.fixtures).toHaveLength(4);
    for (const fixture of show.lighting.fixtures) expect(feed.texture.renderList).toContain(fixture.beam);
    const before = band.musicians[0].root.rotation.z;
    show.clock.toggle();
    update();
    expect(band.musicians[0].root.rotation.z).toBe(before);
    show.dispose();
    show.dispose();
    show.clock.toggle();
    update();
    expect(band.musicians[0].root.rotation.z).toBe(before);
    expect(scene.lights).toHaveLength(1);
    expect(feed.texture.renderList?.some((mesh) => mesh.metadata?.theme === 'lighting')).toBe(false);
    feed.dispose();
  } finally { scene.dispose(); engine.dispose(); }
});
