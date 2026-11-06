import { describe, expect, it } from 'vitest';
import { stageLayout, screenLayout, validateConcertLayout } from '../../src/domain/concert/concertLayout';
import { validateScreens } from '../../src/domain/screens/screenDefinition';
import type { ScreenDefinition } from '../../src/domain/screens/screenDefinition';
import { createTestPattern, patternWidth, patternHeight } from '../../src/infrastructure/babylon/models/screens/testPattern';

describe('concert layout', () => {
  it('defines exactly three distinct 16:9 screens in audience coordinates', () => {
    expect(() => validateConcertLayout(stageLayout, screenLayout)).not.toThrow();
    expect(screenLayout.map((screen) => screen.id)).toEqual([1, 2, 3]);
    screenLayout.forEach((screen) => expect(screen.width / screen.height).toBeCloseTo(16 / 9));
    expect(screenLayout[0].position.x).toBeLessThan(0);
    expect(screenLayout[1].position.x).toBeGreaterThan(0);
    expect(screenLayout[2].position.x).toBe(0);
    expect(screenLayout[2].position.z).toBeGreaterThan(stageLayout.centerZ);
  });
  it.each([0, -1, NaN, Infinity])('rejects invalid stage dimension %s', (width) => {
    expect(() => validateConcertLayout({ ...stageLayout, width }, screenLayout)).toThrow('scène');
  });
  it('rejects a roof below the deck and a ground smaller than the deck', () => {
    expect(() => validateConcertLayout({ ...stageLayout, roofY: 1 }, screenLayout)).toThrow('scène');
    expect(() => validateConcertLayout({ ...stageLayout, groundSize: 5 }, screenLayout)).toThrow('scène');
  });
  it.each([
    { id: 4 }, { id: 2 }, { width: -8 }, { height: 0 }, { width: Infinity },
    { height: 4 }, { name: ' ' }, { position: { x: NaN, y: 1, z: 1 } },
  ])('rejects invalid screen configuration %j', (patch) => {
    const screens = [{ ...screenLayout[0], ...patch }, ...screenLayout.slice(1)] as ScreenDefinition[];
    expect(() => validateScreens(screens)).toThrow();
  });
  it('rejects missing screens', () => { expect(() => validateScreens(screenLayout.slice(1))).toThrow('Trois'); });
});

it('creates deterministic, opaque and asymmetric test patterns with distinct screen labels', () => {
  const pattern = createTestPattern(1, 'GAUCHE');
  expect(pattern.length).toBe(patternWidth * patternHeight * 4);
  expect(pattern).toEqual(createTestPattern(1, 'GAUCHE'));
  expect(pattern).not.toEqual(createTestPattern(2, 'DROITE'));
  for (let index = 3; index < pattern.length; index += 4) expect(pattern[index]).toBe(255);
  const pixel = (x: number, y: number) => [...pattern.slice(((patternHeight - 1 - y) * patternWidth + x) * 4, ((patternHeight - 1 - y) * patternWidth + x) * 4 + 3)];
  expect(pixel(5, 5)).toEqual([75, 197, 203]); // Cyan top-left landmark.
  expect(pixel(505, 280)).toEqual([214, 89, 82]); // Red bottom-right landmark.
  expect(pixel(505, 5)).toEqual([12, 22, 34]);
});
