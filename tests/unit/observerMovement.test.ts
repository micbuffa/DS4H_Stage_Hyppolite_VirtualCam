import { expect, it } from 'vitest';
import { movementKey, observerTranslation } from '../../src/domain/cameras/observerMovement';
import type { MoveDirection } from '../../src/domain/cameras/observerMovement';

it.each([
  ['z', 'forward'], ['Z', 'forward'], ['ArrowUp', 'forward'],
  ['q', 'left'], ['ArrowLeft', 'left'], ['s', 'backward'], ['ArrowDown', 'backward'],
  ['d', 'right'], ['ArrowRight', 'right'], ['a', undefined], ['Tab', undefined],
])('maps the actual AZERTY key %s to %s', (key, direction) => {
  expect(movementKey(key)).toBe(direction);
});

const step = (keys: MoveDirection[], alpha = -Math.PI / 2, delta = 0.1) => observerTranslation(new Set(keys), alpha, delta);
it('moves forward and strafes relative to the viewing azimuth without rotating', () => {
  expect(step(['forward']).z).toBeCloseTo(1);
  expect(step(['right']).x).toBeCloseTo(1);
  expect(step(['left']).x).toBeCloseTo(-1);
  expect(step(['backward']).z).toBeCloseTo(-1);
  expect(step(['forward'], 0).x).toBeCloseTo(-1);
  expect(step(['right'], 0).z).toBeCloseTo(1);
});
it('normalizes diagonal speed and cancels opposite directions', () => {
  const diagonal = step(['forward', 'right']);
  expect(Math.hypot(diagonal.x, diagonal.z)).toBeCloseTo(1);
  expect(step(['forward', 'backward', 'left', 'right'])).toEqual({ x: 0, z: 0 });
});
it('is frame independent and caps long gaps', () => {
  expect(step(['forward'], 0, 0.1).x).toBeCloseTo(step(['forward'], 0, 0.05).x * 2);
  expect(step(['forward'], 0, 10)).toEqual(step(['forward'], 0, 0.1));
  expect(step(['forward'], 0, -1)).toEqual({ x: -0, z: 0 });
  expect(step(['forward'], 0, NaN)).toEqual({ x: 0, z: 0 });
});
