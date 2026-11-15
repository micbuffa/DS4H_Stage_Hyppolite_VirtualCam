import { expect, it } from 'vitest';
import { transitionModes, transitionSettings } from '../../src/domain/direction/transitionDefinition';
import { planTransition, transitionFrame } from '../../src/domain/direction/transitionPlan';
import { TransitionClock } from '../../src/domain/direction/transitionClock';
import { sourceBudget } from '../../src/domain/rendering/sourceBudget';
import type { SourceConsumer } from '../../src/domain/rendering/sourceBudget';

it('defines the full catalogue without enabling an effect in the renderer', () => {
  expect(transitionModes).toHaveLength(12);
  expect(new Set(transitionModes).size).toBe(12);
  expect(transitionSettings()).toMatchObject({ mode: 'cut', durationMs: 0 });
  expect(transitionSettings({ mode: 'dissolve' }).durationMs).toBe(600);
  expect(transitionSettings({ mode: 'virtual-travel' })).toMatchObject({ durationMs: 2000, order: 'staggered' });
});
it.each([
  ['dissolve', -10, 100], ['dissolve', 9000, 3000], ['dissolve', 651, 700],
  ['virtual-travel', 100, 500], ['virtual-travel', 15000, 10000], ['cut', 1000, 0],
])('bounds duration for %s at %s to %s ms', (mode, duration, expected) => {
  expect(transitionSettings({ mode: String(mode), durationMs: Number(duration) }).durationMs).toBe(expected);
});
it.each([
  { mode: 'unknown' }, { durationMs: NaN }, { mode: 'cut', durationMs: Infinity },
  { order: 'shuffle' }, { screenOrder: [1, 1, 2] }, { screenOrder: [1, 2, 4] },
  { delayMs: NaN }, { parameters: { seed: -1 } }, { parameters: { direction: 'diagonal' } },
  { parameters: { columns: Infinity } }, { parameters: { strength: NaN } },
])('rejects invalid transition settings %j before acquiring resources', (settings) => {
  expect(() => transitionSettings(settings)).toThrow();
});
it('captures immutable sources, unique targets, settings and only the changing screens', () => {
  const routes = { 1: 4, 2: 2, 3: null } as const;
  const targets = [1, 2, 3, 3];
  const parameters = { columns: 9 };
  const plan = planTransition(routes, 4, targets, { mode: 'mosaic', parameters });
  targets.pop(); parameters.columns = 2;
  expect(plan.targets).toEqual([1, 2, 3]);
  expect(plan.steps.map((step) => [step.screen, step.from])).toEqual([[3, null], [2, 2]]);
  expect(plan.settings.parameters.columns).toBe(9);
  expect(plan.after).toEqual({ 1: 4, 2: 4, 3: 4 });
  expect(plan.before).toEqual(routes);
  expect(plan.participants).toEqual([2, 4]);
  expect(() => Object.assign(plan.before, { 2: 9 })).toThrow();
});
it.each([[0, [1]], [10, [1]], [4, []], [4, [1, 9]]])('rejects invalid camera/targets %j %j', (camera, targets) => {
  expect(() => planTransition({ 1: 1, 2: 1, 3: 1 }, camera as number, targets as number[])).toThrow();
});
it('handles unchanged sources as no-ops and plans three distinct live inputs toward one destination', () => {
  expect(planTransition({ 1: 1, 2: 1, 3: 1 }, 1, [1, 3]).steps).toEqual([]);
  const routes = { 1: 2, 2: 5, 3: 9 } as const;
  const plan = planTransition(routes, 8, [1, 2, 3], { mode: 'dissolve' });
  expect(plan.maxActiveSources).toBe(4);
  expect(transitionFrame(plan, 300).screens.map((screen) => screen.progress)).toEqual([0.5, 0.5, 0.5]);
  expect(transitionFrame(plan, 900).progress).toBe(1);
  expect(planTransition(routes, 8, [1, 2, 3], { mode: 'virtual-travel' }).maxActiveSources).toBe(5);
});
it('filters the staggered order and includes delays without progressing the next screen early', () => {
  const plan = planTransition({ 1: 1, 2: 2, 3: 3 }, 8, [1, 3], { mode: 'dissolve', order: 'staggered', delayMs: 200 });
  expect(plan.totalMs).toBe(1400);
  expect(transitionFrame(plan, 700).screens).toEqual([{ screen: 3, progress: 1 }, { screen: 1, progress: 0 }]);
  expect(transitionFrame(plan, 1100).screens[1].progress).toBe(0.5);
  expect(() => transitionFrame(plan, NaN)).toThrow();
});
it('uses an independent clock, stops hidden time and resumes without catch-up', () => {
  const clock = new TransitionClock();
  expect(clock.sample(1000, true)).toBe(0);
  expect(clock.sample(1300, true)).toBe(300);
  expect(clock.sample(1400, false)).toBe(400);
  expect(clock.sample(90000, false)).toBe(400);
  expect(clock.sample(91000, true)).toBe(400);
  expect(clock.sample(91300, true)).toBe(700);
  expect(() => clock.sample(10, true)).toThrow();
  expect(() => clock.sample(Infinity, true)).toThrow();
});
const live: SourceConsumer[] = [1, 2, 3].map((id) => ({ owner: `screen-${id}`, source: id as 1 | 2 | 3, use: 'live', rendering: true }));
it('counts consumers independently of shared allocations and suspended rollback references', () => {
  const state = sourceBudget([...live, { owner: 'preview', source: 1, use: 'preview', rendering: true },
    { owner: 'saved', source: 4, use: 'rollback', rendering: false }], 'preview');
  expect(state).toEqual({ allocated: 4, active: 3, consumers: [{ source: 1, count: 2 }, { source: 2, count: 1 }, { source: 3, count: 1 }, { source: 4, count: 1 }] });
});
it('enforces source budgets and refuses a preview consumer during a transition', () => {
  const destination: SourceConsumer = { owner: 'destination', source: 8, use: 'transition', rendering: true };
  expect(sourceBudget([...live, destination], 'transition').active).toBe(4);
  const travel: SourceConsumer = { owner: 'travelling', source: 'temporary', use: 'travel', rendering: true };
  expect(sourceBudget([...live, destination, travel], 'travel').active).toBe(5);
  expect(() => sourceBudget([...live, destination, travel], 'transition')).toThrow('Budget');
  expect(() => sourceBudget([...live, { ...destination, use: 'preview' }], 'transition')).toThrow('prévisualisation');
  expect(() => sourceBudget([...live, live[0]], 'live')).toThrow('dupliqué');
});
