import { expect, test } from '@playwright/test';
import type { ScreenId } from '../../src/domain/direction/screenRouting';
import { screenOrderPresets } from '../../src/domain/direction/screenSequence';
import { harness } from './transitionHarness';
import { clickPanel } from './panelProjection';

test('renders all six delayed cut orders with filtered targets, distinct live sources and an atomic final commit', async ({ page }) => {
  test.setTimeout(180000);
  await page.goto('/tests/e2e/fixtures/transitions.html'); await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const h = harness(page);
  const samples = async (id: ScreenId) => { await h.call('inspectScreen', id); return (await h.call('samples')).samples; };
  await h.call('cut', 4); const b = await samples(1);
  for (const order of screenOrderPresets) {
    await h.call('cut', 1); await h.call('cut', 2, [2]); await h.call('cut', 3, [3]);
    const before = [await samples(1), await samples(2), await samples(3)];
    const start = await h.call('sequence', 'cut', [1, 2, 3], order, 200);
    expect(start.routes).toEqual({ 1: 1, 2: 2, 3: 3 }); expect(start.stats.active).toBe(4);
    for (let index = 0; index < 3; index++) {
      if (index) await h.call('advanceSequence', index * 200);
      for (const id of [1, 2, 3] as const) expect(await samples(id)).toEqual(order.indexOf(id) <= index ? b : before[id - 1]);
      expect((await h.call('status')).routes).toEqual(index < 2 ? { 1: 1, 2: 2, 3: 3 } : { 1: 4, 2: 4, 3: 4 });
    }
    expect(await h.call('status')).toMatchObject({ phase: 'completed', stats: { active: 1, allocated: 1 }, materials: 0, maxActive: 4 });
    // Screen 2 is already B; it must neither consume a step nor delay another screen.
    await h.call('cut', 1, [1]); await h.call('cut', 3, [3]);
    await h.call('sequence', 'cut', [1, 2, 3], order, 200);
    const first = order.filter((id) => id !== 2)[0]; expect(await samples(first)).toEqual(b);
    const end = await h.call('advanceSequence', 200); expect(end.phase).toBe('completed'); expect(end.routes).toEqual({ 1: 4, 2: 4, 3: 4 });
  }
  // A proper subset leaves the third source unchanged.
  await h.call('cut', 1); await h.call('cut', 2, [2]); await h.call('cut', 3, [3]);
  const untouched = await samples(2);
  await h.call('sequence', 'cut', [1, 3], [2, 3, 1], 1000);
  expect(await samples(2)).toEqual(untouched);
  const end = await h.call('advanceSequence', 1000); expect(end.routes).toEqual({ 1: 4, 2: 2, 3: 4 }); expect(end.stats.active).toBe(2);
});

for (const outcome of ['cancel', 'error'] as const) test(`restores every visible screen after a late sequence ${outcome}, then recovers without accumulating resources`, async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/tests/e2e/fixtures/transitions.html'); await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const h = harness(page);
  const samples = async (id: ScreenId) => { await h.call('inspectScreen', id); return (await h.call('samples')).samples; };
  await h.call('cut', 4); const b = await samples(3);
  await h.call('cut', 1); await h.call('cut', 2, [2]); await h.call('cut', 3, [3]);
  const before = [await samples(1), await samples(2), await samples(3)], baseline = await h.call('status');
  const start = await h.call('sequence', 'dissolve', [1, 2, 3], [3, 1, 2], 200);
  await h.call('advanceSequence', 600); expect(await samples(3)).toEqual(b); expect(await samples(1)).toEqual(before[0]);
  const middle = await h.call('advanceSequence', 1100); expect(middle.routes).toEqual(baseline.routes);
  expect(await samples(1)).not.toEqual(before[0]); expect(await samples(1)).not.toEqual(b); expect(await samples(2)).toEqual(before[1]);
  for (const id of ['1', '2', '3', '4']) expect(middle.frames[id]).toBeGreaterThan(start.frames[id]);
  if (outcome === 'error') await h.call('failDuring');
  const restored = outcome === 'cancel' ? await h.call('cancel') : await h.call('advanceSequence', 1200);
  expect(restored).toMatchObject({ phase: outcome === 'cancel' ? 'cancelled' : 'error', routes: baseline.routes, stats: { active: 3, allocated: 3 }, materials: 0 });
  expect(restored.resources).toEqual(baseline.resources);
  expect([await samples(1), await samples(2), await samples(3)]).toEqual(before);
  await h.call('sequence', 'dissolve', [1, 2, 3], [3, 1, 2], 200);
  const end = await h.call('advanceSequence', 2200); expect(end.phase).toBe('completed'); expect(end.stats.active).toBe(1); expect(end.maxActive).toBe(4);
});

test('performs the multi-screen directing exercise entirely through the physical sequence panel', async ({ page }) => {
  test.setTimeout(180000); const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/'); await expect(page.getByRole('status')).toContainText('Prêt à explorer');
  await clickPanel(page, 'pause');
  await clickPanel(page, 'transition-page'); await clickPanel(page, 'transition-prev'); await clickPanel(page, 'transition-prev');
  await expect(page.locator('#transition-status')).toContainText('Écran partagé');
  await clickPanel(page, 'camera-4'); await clickPanel(page, 'broadcast'); await expect(page.locator('#route-1')).toHaveText('Écran 1 ← C4');
  await clickPanel(page, 'transition-next'); await clickPanel(page, 'transition-next'); // travel, then cut
  await clickPanel(page, 'camera-1'); await clickPanel(page, 'broadcast'); await expect(page.locator('#route-1')).toHaveText('Écran 1 ← C1');
  await clickPanel(page, 'transition-page');
  await clickPanel(page, 'screen-1'); await clickPanel(page, 'screen-2'); await clickPanel(page, 'camera-2'); await clickPanel(page, 'broadcast');
  await expect(page.locator('#route-2')).toHaveText('Écran 2 ← C2');
  await clickPanel(page, 'screen-2'); await clickPanel(page, 'screen-3'); await clickPanel(page, 'camera-3'); await clickPanel(page, 'broadcast');
  await expect(page.locator('#route-3')).toHaveText('Écran 3 ← C3');
  await clickPanel(page, 'all'); await clickPanel(page, 'camera-4'); await clickPanel(page, 'transition-page'); await clickPanel(page, 'transition-next');
  for (let index = 0; index < 12; index++) await clickPanel(page, 'duration-plus');
  await clickPanel(page, 'sequence-page'); await clickPanel(page, 'sequence-mode'); await clickPanel(page, 'delay-plus'); await clickPanel(page, 'delay-plus');
  await expect(page.locator('#panel-message')).toContainText('Décalé · 3 → 1 → 2');
  await expect(page.locator('#panel-message')).toContainText('Total 5800 ms');
  await page.screenshot({ path: 'test-results/t18-pupitre-sequence.png' });
  await clickPanel(page, 'broadcast');
  await expect(page.locator('#panel-message')).toContainText('É3 100 %', { timeout: 15000 });
  await clickPanel(page, 'sequence-cancel'); await expect(page.locator('#panel-message')).toContainText('Transition annulée');
  await expect(page.locator('#feed-status')).toHaveText('Écran 1 ← C1 · Écran 2 ← C2 · Écran 3 ← C3');
  // Change the order and complete the singer passage, then cut to the soloist and audience.
  await clickPanel(page, 'sequence-order'); await expect(page.locator('#panel-message')).toContainText('1 → 2 → 3');
  await clickPanel(page, 'broadcast'); await expect(page.locator('#feed-status')).toHaveText('Écran 1 ← C4 · Écran 2 ← C4 · Écran 3 ← C4', { timeout: 30000 });
  await clickPanel(page, 'sequence-mode'); await expect(page.locator('#transition-status')).toContainText('Simultané');
  await clickPanel(page, 'sequence-back'); await clickPanel(page, 'transition-prev');
  for (const id of [5, 9] as const) {
    await clickPanel(page, `camera-${id}`); await clickPanel(page, 'broadcast');
    await expect(page.locator('#feed-status')).toHaveText(`Écran 1 ← C${id} · Écran 2 ← C${id} · Écran 3 ← C${id}`);
  }
  expect(errors).toEqual([]);
});
