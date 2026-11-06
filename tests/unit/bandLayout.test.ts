import { describe, expect, it } from 'vitest';
import { createBandLayout, musicianAnchors, validateBandLayout, worldAnchor } from '../../src/domain/concert/bandLayout';
import type { MusicianDefinition } from '../../src/domain/concert/bandLayout';
import { drumRiserLayout, stageLayout } from '../../src/domain/concert/concertLayout';

describe('band descriptions and poses', () => {
  it('assigns four different roles their own instruments and positions on the deck/riser', () => {
    const band = createBandLayout(stageLayout);
    expect(band.map(({ role, instrument }) => [role, instrument])).toEqual([
      ['singer', 'microphone'], ['guitarist', 'guitar'], ['bassist', 'bass'], ['drummer', 'drums'],
    ]);
    expect(band[1].position[0]).toBeLessThan(band[0].position[0]);
    expect(band[2].position[0]).toBeGreaterThan(band[0].position[0]);
    expect(band[3].position[2]).toBeGreaterThan(band[0].position[2]);
    expect(band[3].position[1]).toBe(stageLayout.height + drumRiserLayout(stageLayout).height);
    expect(() => validateBandLayout(band, stageLayout)).not.toThrow();
  });
  it('follows a change in deck elevation and depth', () => {
    const stage = { ...stageLayout, height: 2.5, centerZ: 12 };
    const band = createBandLayout(stage);
    expect(band[0].position).toEqual([0, 2.5, 8.2]);
    expect(band[3].position[1]).toBe(3.1);
  });
  it.each([
    { role: 'guitarist' }, { role: 'unknown' }, { instrument: 'drums' },
    { position: [NaN, 1.5, 7] }, { position: [0, Infinity, 7] }, { yaw: Infinity },
    { position: [30, 1.5, 7] }, { position: [0, 0, 7] }, { position: [0, 1.5, -7] },
  ])('rejects invalid performer data %j', (patch) => {
    const band = createBandLayout(stageLayout);
    band[0] = { ...band[0], ...patch } as MusicianDefinition;
    expect(() => validateBandLayout(band, stageLayout)).toThrow();
  });
  it('rejects incomplete groups and a drummer outside the riser', () => {
    const band = createBandLayout(stageLayout);
    expect(() => validateBandLayout(band.slice(1), stageLayout)).toThrow('Quatre');
    band[3] = { ...band[3], position: [5, 2.1, 14.1] };
    expect(() => validateBandLayout(band, stageLayout)).toThrow('plateau');
  });
  it('computes world anchors with translation and yaw, preserving local coordinates', () => {
    const musician = { ...createBandLayout(stageLayout)[0], position: [3, 2, 4] as const, yaw: Math.PI / 2 };
    const anchor = [1, 0.5, -2] as const;
    const world = worldAnchor(musician, anchor);
    expect(world[0]).toBeCloseTo(1);
    expect(world[1]).toBe(2.5);
    expect(world[2]).toBeCloseTo(3);
    expect(anchor).toEqual([1, 0.5, -2]);
  });
  it('provides lower seated anchors and fretboard hand placement', () => {
    const drummer = musicianAnchors('drummer');
    const guitarist = musicianAnchors('guitarist');
    expect(drummer.hip[1]).toBeLessThan(guitarist.hip[1]);
    expect(drummer.head[1]).toBeLessThan(guitarist.head[1]);
    expect(guitarist.hands[1][0]).toBeGreaterThan(0);
    expect(guitarist.hands[1][1]).toBeGreaterThan(guitarist.hands[0][1]);
  });
});
