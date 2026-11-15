import { expect, it } from 'vitest';
import { screenOrderPresets, nextScreenOrder } from '../../src/domain/direction/screenSequence';
import { planTransition, transitionFrame } from '../../src/domain/direction/transitionPlan';
import { sequencePanelModel } from '../../src/application/presentation/sequencePanelModel';
import { transitionSettings } from '../../src/domain/direction/transitionDefinition';

it('cycles every permutation once, preserving the default and immutable presets', () => {
  let order = screenOrderPresets[0]; const found = new Set<string>();
  for (let i = 0; i < 6; i++) { found.add(order.join()); expect(new Set(order).size).toBe(3); order = nextScreenOrder(order); }
  expect(found.size).toBe(6); expect(order).toEqual([3, 1, 2]);
  expect(() => Object.assign(order, { 0: 2 })).toThrow();
});

it.each(screenOrderPresets.map((order) => [order]))('filters order %j for subsets and removes unchanged sources without unused delays', (screenOrder) => {
  for (const targets of [[1], [2], [3], [1, 2], [1, 3], [2, 3], [1, 2, 3]]) {
    for (const mode of ['dissolve', 'cut', 'virtual-travel'] as const) {
      const plan = planTransition({ 1: 1, 2: 4, 3: 3 }, 4, targets, { mode, order: 'staggered', screenOrder, durationMs: 1000, delayMs: 300 });
      const expected = screenOrder.filter((id) => targets.includes(id) && id !== 2);
      expect(plan.steps.map((step) => step.screen)).toEqual(expected);
      expect(plan.totalMs).toBe(expected.length ? expected.length * plan.settings.durationMs + (expected.length - 1) * 300 : 0);
      for (const [index, step] of plan.steps.entries()) {
        expect(step.startMs).toBe(index * (plan.settings.durationMs + 300));
        if (index) expect(transitionFrame(plan, step.startMs - 1).screens[index].progress).toBe(0);
        expect(transitionFrame(plan, step.endMs).screens[index].progress).toBe(1);
      }
    }
  }
});

it('summarizes the effective order and total, and handles no target or no change', () => {
  const base = { selectedId: 4 as const, targets: [1, 2, 3] as const, routes: { 1: 1, 2: 4, 3: 3 } as const, pending: null, error: null };
  const settings = transitionSettings({ mode: 'dissolve', order: 'staggered', delayMs: 200 });
  expect(sequencePanelModel({ ...base, targets: [...base.targets], settings })).toMatchObject({ effective: 'Décalé', order: '3 → 1', total: 1400 });
  expect(sequencePanelModel({ ...base, targets: [], settings }).total).toBe(0);
  expect(sequencePanelModel({ ...base, targets: [2], settings }).order).toBe('aucun changement');
  expect(sequencePanelModel({ ...base, targets: [...base.targets], settings: transitionSettings({ mode: 'dissolve', delayMs: 1000 }) }).total).toBe(600);
});
