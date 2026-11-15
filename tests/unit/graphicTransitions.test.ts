import { expect, it } from 'vitest';
import { glitchOffset, graphicTransitionModes, lumaWeight, proceduralLuminance, smoothProgress, splitBoundary, splitSample, zoomFrame } from '../../src/domain/direction/graphicTransitions';
import { transitionSettings } from '../../src/domain/direction/transitionDefinition';

it.each(graphicTransitionModes)('normalizes and freezes parameters for %s before rendering', (mode) => {
  const settings = transitionSettings({ mode, parameters: { columns: 99, rows: 0, strength: 2, seed: 4294967295 } });
  expect(settings.parameters).toMatchObject({ columns: 32, rows: 1, strength: 1, seed: 4294967295 });
  expect(Object.isFrozen(settings.parameters)).toBe(true);
  for (const parameters of [{ strength: NaN }, { seed: 0.5 }, { seed: -1 }, { rows: Infinity }]) expect(() => transitionSettings({ mode, parameters })).toThrow();
});
it('bounds the glitch displacement and reproduces all eight phases without a brightness multiplier', () => {
  const parameters = transitionSettings({ mode: 'glitch', parameters: { rows: 18, strength: 1, seed: 4294967295 } }).parameters;
  const samples = Array.from({ length: 129 }, (_, i) => Array.from({ length: 19 }, (_, j) => glitchOffset(i / 128, j / 18, parameters)));
  expect(samples.every((row) => row.every((offset) => Math.abs(offset) <= 0.08))).toBe(true);
  expect(samples[0].every((offset) => offset === 0)).toBe(true); expect(samples[128].every((offset) => offset === 0)).toBe(true);
  expect(glitchOffset(0.5, 0.5, parameters)).toBe(glitchOffset(0.5, 0.5, parameters));
  expect(glitchOffset(0.5, 0.5, parameters)).not.toBe(glitchOffset(0.5, 0.5, { ...parameters, seed: 3 }));
  expect(glitchOffset(0.5, 0.5, { ...parameters, strength: 0 })).toBe(0);
});
it('zooms around the center with bounded in-image UVs and monotone mixing', () => {
  const frames = [0, 0.25, 0.5, 0.75, 1].map((p) => zoomFrame(p, 1));
  expect(frames[0]).toEqual({ scaleA: 1, scaleB: 2, weight: 0 }); expect(frames[4]).toEqual({ scaleA: 2, scaleB: 1, weight: 1 });
  for (const frame of frames) for (const scale of [frame.scaleA, frame.scaleB]) for (const uv of [0, 0.5, 1]) {
    const sample = (uv - 0.5) / scale + 0.5; expect(sample).toBeGreaterThanOrEqual(0); expect(sample).toBeLessThanOrEqual(1);
  }
  expect(zoomFrame(0.5, 0)).toEqual({ scaleA: 1, scaleB: 1, weight: 0.5 });
});
it('builds a bounded continuous luminance mask with deterministic seeded details', () => {
  const p = transitionSettings({ mode: 'luma-wipe' }).parameters;
  const values = Array.from({ length: 81 }, (_, i) => proceduralLuminance([i % 9 / 8, Math.floor(i / 9) / 8], p));
  expect(values.every((value) => value >= 0 && value <= 1)).toBe(true); expect(new Set(values).size).toBeGreaterThan(20);
  expect(proceduralLuminance([0.2, 0.7], p)).toBe(proceduralLuminance([0.2, 0.7], p));
  expect(proceduralLuminance([0.2, 0.7], p)).not.toBe(proceduralLuminance([0.2, 0.7], { ...p, seed: 1 }));
  for (let column = 1; column < p.columns; column++) expect(Math.abs(proceduralLuminance([column / p.columns - 1e-7, 0.37], p) - proceduralLuminance([column / p.columns + 1e-7, 0.37], p))).toBeLessThan(1e-8);
});
it('reveals luminance monotonically, including the hard-mask limit and exact endpoints', () => {
  for (const strength of [0, 0.3, 1]) {
    const p = transitionSettings({ mode: 'luma-wipe', parameters: { strength } }).parameters;
    for (const x of [0, 0.3, 0.6, 1]) {
      const values = Array.from({ length: 101 }, (_, i) => lumaWeight(i / 100, [x, 0.37], p));
      expect(values[0]).toBe(0); expect(values[100]).toBe(1); expect(values).toEqual([...values].sort((a, b) => a - b));
      if (strength === 0) expect(values.every((value) => value === 0 || value === 1)).toBe(true);
    }
  }
});
it('allocates the first quarter to opening, the middle half to both frames and the final quarter to B', () => {
  expect([0, 0.125, 0.25, 0.5, 0.75, 0.875, 1].map(splitBoundary)).toEqual([1, 0.75, 0.5, 0.5, 0.5, 0.25, 0]);
  const widths = Array.from({ length: 101 }, (_, i) => splitBoundary(i / 100));
  expect(widths).toEqual([...widths].sort((a, b) => b - a));
});
it('fits both complete 16:9 frames into their split regions with equal X/Y scale and explicit bars', () => {
  for (const progress of [0.125, 0.5, 0.875]) {
    const boundary = splitBoundary(progress);
    for (const source of ['a', 'b'] as const) for (const u of [0.01, 0.99]) for (const v of [0.01, 0.99]) {
      const width = source === 'a' ? boundary : 1 - boundary;
      const result = splitSample(progress, [(source === 'a' ? 0 : boundary) + u * width, 0.5 + (v - 0.5) * width]);
      expect(result.source).toBe(source); expect(result.uv[0]).toBeCloseTo(u, 12); expect(result.uv[1]).toBeCloseTo(v, 12);
    }
  }
  expect(splitSample(0.5, [0.25, 0.1]).source).toBe('black'); expect(splitSample(0.5, [0.75, 0.9]).source).toBe('black');
  expect(splitSample(0, [1, 1])).toEqual({ source: 'a', uv: [1, 1] }); expect(splitSample(1, [0, 0])).toEqual({ source: 'b', uv: [0, 0] });
  expect(splitSample(Number.MIN_VALUE, [1, 1])).toEqual({ source: 'a', uv: [1, 1] });
});
it.each([-0.1, NaN, Infinity, 1.1])('rejects invalid graphic progression or UV %s', (value) => {
  const p = transitionSettings().parameters;
  for (const operation of [() => smoothProgress(value), () => glitchOffset(value, 0.5, p), () => zoomFrame(value, 0.5), () => splitBoundary(value), () => splitSample(0.5, [value, 0.5]), () => lumaWeight(value, [0.5, 0.5], p), () => proceduralLuminance([value, 0.5], p)]) expect(operation).toThrow();
});
