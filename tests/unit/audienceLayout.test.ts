import { expect, it } from 'vitest';
import { audienceDefaults, layoutAudience } from '../../src/domain/concert/audienceLayout';

it('reproduces the whole crowd from its seed and varies the distribution with another seed', () => {
  const crowd = layoutAudience(audienceDefaults);
  expect(crowd).toHaveLength(144);
  expect(layoutAudience(audienceDefaults)).toEqual(crowd);
  expect(layoutAudience({ count: 144, seed: 12 })).not.toEqual(crowd);
  expect(new Set(crowd.map((person) => person.style)).size).toBe(6);
});

it('keeps clear of the barrier, the stage, the central aisle and the panel footprint', () => {
  const crowd = layoutAudience(audienceDefaults);
  for (const [index, person] of crowd.entries()) {
    expect(person.z).toBeLessThan(-2);
    expect(person.z).toBeGreaterThan(-28);
    expect(Math.abs(person.x)).toBeLessThan(17);
    expect(Math.abs(person.x)).toBeGreaterThanOrEqual(1.45);
    const nearPanel = person.x > 1.8 && person.x < 16.8 && person.z > -14.8 && person.z < -9.2;
    expect(nearPanel).toBe(false);
    for (const other of crowd.slice(index + 1)) {
      expect(Math.hypot(person.x - other.x, person.z - other.z)).toBeGreaterThan(1.25);
    }
  }
});

it.each([0, 1, 60, 150])('generates exactly %i spectators when configured', (count) => {
  expect(layoutAudience({ count, seed: 0 })).toHaveLength(count);
});

it.each([-1, 2.5, NaN, Infinity, 400])('rejects impossible crowd size %s', (count) => {
  expect(() => layoutAudience({ count, seed: 0 })).toThrow(RangeError);
});

it.each([-1, 0x100000000, 0.25, NaN])('rejects invalid seed %s', (seed) => {
  expect(() => layoutAudience({ count: 1, seed })).toThrow(RangeError);
});
