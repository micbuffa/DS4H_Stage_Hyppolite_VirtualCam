import { expect, it } from 'vitest';
import { gridCellOrder, gridCellProgress, gridTransitionModes, shaderSeed } from '../../src/domain/direction/gridTransitions';
import { transitionSettings } from '../../src/domain/direction/transitionDefinition';

it.each(gridTransitionModes)('bounds and freezes the parameters of %s', (mode) => {
  const input = { columns: 99, rows: -1, strength: 2, seed: 0xffffffff };
  const settings = transitionSettings({ mode, parameters: input }); input.seed = 0;
  expect(settings.parameters).toMatchObject({ columns: 32, rows: 1, strength: 1, seed: 0xffffffff });
  expect(Object.isFrozen(settings.parameters)).toBe(true);
  expect(transitionSettings({ mode, parameters: { columns: 1.6, rows: 3.4, strength: -1 } }).parameters).toMatchObject({ columns: 2, rows: 3, strength: 0 });
});
it.each([NaN, Infinity, -1, 0x100000000, 1.5])('rejects invalid seed %s before rendering', (seed) => {
  expect(() => transitionSettings({ mode: 'mosaic', parameters: { seed } })).toThrow('Graine');
});
it('uses the whole seed through a documented fold and reproduces the cell schedule', () => {
  const schedule = (seed: number) => Array.from({ length: 32 * 18 }, (_, i) => gridCellOrder(i % 32, Math.floor(i / 32), 32, seed));
  const first = schedule(0xffffffff);
  expect(first).toEqual(schedule(0xffffffff)); expect(first).not.toEqual(schedule(0));
  expect(schedule(4093)).not.toEqual(schedule(0));
  expect(new Set(first).size).toBe(576);
  expect(first.every((value) => value >= 0 && value < 1)).toBe(true);
  expect(shaderSeed(0xffffffff)).toBeLessThan(4093);
});
it('progresses every cell monotonically from A to B at all supported grid sizes', () => {
  for (const [columns, rows] of [[1, 1], [8, 4], [32, 18]]) {
    const settings = transitionSettings({ mode: 'grid-morph', parameters: { columns, rows, seed: 4294967295 } });
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      const values = [0, 0.25, 0.5, 0.75, 1].map((progress) => gridCellProgress(settings, progress, column, row));
      expect(values[0]).toBe(0); expect(values[4]).toBe(1);
      expect(values).toEqual([...values].sort((a, b) => a - b));
    }
  }
});
it.each([[-1, 0], [8, 0], [0, -1], [0, 18], [0.5, 0]])('rejects invalid cell %j %j', (column, row) => {
  expect(() => gridCellOrder(column, row, 8, 0)).toThrow('Case');
});
it('rejects invalid progression and cells beyond the configured rows', () => {
  const settings = transitionSettings({ mode: 'mosaic' });
  for (const value of [-1, NaN, Infinity, 1.1]) expect(() => gridCellProgress(settings, value, 0, 0)).toThrow();
  expect(() => gridCellProgress(settings, 0.5, 0, 4)).toThrow();
});
