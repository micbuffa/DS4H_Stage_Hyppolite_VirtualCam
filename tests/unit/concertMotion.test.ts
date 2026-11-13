import { expect, it } from 'vitest';
import { ShowClock, crowdLift, performerMotion, spotlightMotion, spotlights } from '../../src/domain/concert/concertMotion';

it('produces the same trajectory for equal elapsed time at different frame rates', () => {
  const fast = new ShowClock();
  const slow = new ShowClock();
  for (let i = 0; i < 60; i++) fast.advance(1 / 60);
  for (let i = 0; i < 20; i++) slow.advance(1 / 20);
  expect(performerMotion(fast.time, 0).roll).toBeCloseTo(performerMotion(slow.time, 0).roll, 10);
  expect(performerMotion(0, 0)).toEqual({ lift: 0, yaw: 0, roll: 0 });
  expect(crowdLift(Math.PI / 5.4, 0)).toBeCloseTo(0.14);
});

it('freezes time during pause or invisibility and bounds the first large delta', () => {
  const clock = new ShowClock();
  expect(clock.advance(0.05)).toBeCloseTo(0.05);
  clock.toggle();
  expect(clock.advance(60)).toBeCloseTo(0.05);
  clock.toggle();
  expect(clock.advance(0.02)).toBeCloseTo(0.07);
  expect(clock.advance(100, false)).toBeCloseTo(0.07);
  expect(clock.advance(100)).toBeCloseTo(0.17);
  expect(clock.advance(NaN)).toBeCloseTo(0.17);
});

it('keeps the four lights in their intensity, color and aiming ranges', () => {
  expect(spotlights).toHaveLength(4);
  spotlights.forEach(({ rgb, targetX }, index) => {
    for (const value of rgb) expect(value).toBeGreaterThanOrEqual(0);
    expect(Math.max(...rgb)).toBeLessThanOrEqual(1);
    for (let time = 0; time < 12; time += 0.25) {
      const light = spotlightMotion(time, index);
      expect(light.intensity).toBeGreaterThanOrEqual(0.3);
      expect(light.intensity).toBeLessThanOrEqual(0.63);
      expect(Math.abs(light.x - targetX)).toBeLessThanOrEqual(1.66);
    }
  });
});
