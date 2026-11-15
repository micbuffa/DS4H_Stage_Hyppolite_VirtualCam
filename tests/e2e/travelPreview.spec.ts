import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { harness } from './transitionHarness';
import { clickPanel } from './panelProjection';

async function open(page: Page) {
  await page.goto('/tests/e2e/fixtures/transitions.html?concert&preview');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true', { timeout: 60000 });
  const h = harness(page); await h.call('cut', 2, [2]); await h.call('cut', 3, [3]); await h.call('select', 4); await h.call('activatePreview'); return h;
}

test('tests real concert travel on the monitor with five sources, exact B arrival and unchanged direct images', async ({ page }) => {
  test.setTimeout(180000); const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  const h = await open(page), original = await h.call('liveHashes'), cameras = await h.call('cameras'), observer = await h.call('observerPose');
  const b = await h.call('samples');
  expect(await h.call('startPreviewTest', 'virtual-travel')).toMatchObject({ phase: 'testing', temporary: true, destination: 4, reference: 1, referenceSource: 1, source: null });
  const prepared = await h.call('status'), arrivalId = prepared.renderTargets.find((target) => target.name === 'feed-capture-camera-4')!.id;
  expect(prepared.stats).toMatchObject({ active: 5, allocated: 5 }); expect(prepared.renderTargets.every((target) => !target.includesMonitor)).toBe(true);
  for (const progress of [0.25, 0.5, 0.75]) {
    await h.call('advancePreview', progress); expect((await h.call('samples')).hash).not.toBe(b.hash);
    await page.locator('canvas').screenshot({ path: `test-results/t17-trajet-${Math.round(progress * 100)}.png` });
  }
  expect(await h.call('liveHashes')).toEqual(original); await page.locator('canvas').screenshot({ path: 'test-results/t17-moniteur-trajet.png' });
  for (const id of ['1', '2', '3', '4', 'temporary']) expect((await h.call('status')).frames[id]).toBeGreaterThan(prepared.frames[id]);
  await h.call('advancePreview', 1); expect((await h.call('samples')).hash).toBe(b.hash);
  const end = await h.call('status'); expect(end.stats).toMatchObject({ active: 4, allocated: 4 }); expect(end.maxActive).toBe(5);
  expect(end.renderTargets.find((target) => target.name === 'feed-capture-camera-4')!.id).toBe(arrivalId);
  expect(await h.call('previewState')).toMatchObject({ phase: 'ready', source: 4 }); expect(await h.call('liveHashes')).toEqual(original);
  expect(await h.call('cameras')).toEqual(cameras); expect(await h.call('observerPose')).toEqual(observer); expect(errors).toEqual([]);
});

for (const outcome of ['cancel', 'selection', 'quality', 'broadcast'] as const) test(`releases a monitor travel before ${outcome} and restores the right preview`, async ({ page }) => {
  test.setTimeout(180000); const h = await open(page); const routes = (await h.call('status')).routes;
  await h.call('startPreviewTest', 'virtual-travel'); await h.call('advancePreview', 0.5);
  if (outcome === 'cancel') await h.call('stopPreviewTest');
  else if (outcome === 'selection') await h.call('select', 7);
  else if (outcome === 'quality') await h.call('quality', 'standard');
  else await h.call('cut', 6, [1]);
  await expect.poll(async () => (await h.call('previewState')).phase).toBe('ready');
  expect((await h.call('previewState')).source).toBe(outcome === 'selection' ? 7 : 4);
  const state = await h.call('status'); expect(state.renderTargets.some((target) => target.name === 'feed-travel-camera')).toBe(false);
  expect(state.stats.active).toBeLessThanOrEqual(4); expect(state.maxActive).toBeLessThanOrEqual(5);
  expect(state.routes).toEqual(outcome === 'broadcast' ? { 1: 6, 2: 2, 3: 3 } : routes);
});

test('exposes the spatial travel controls, editable points, blocked-path refusal and a live travel after monitor testing', async ({ page }) => {
  test.setTimeout(240000); const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/'); await expect(page.getByRole('status')).toContainText('Prêt à explorer', { timeout: 60000 }); await clickPanel(page, 'pause');
  await clickPanel(page, 'camera-4'); await clickPanel(page, 'preview-toggle');
  await expect(page.locator('#preview-status')).toContainText('Aperçu C4', { timeout: 30000 });
  await clickPanel(page, 'transition-page'); await clickPanel(page, 'transition-prev');
  await expect(page.locator('#transition-status')).toContainText('Trajet virtuel · 2000 ms · Séquentiel');
  await clickPanel(page, 'duration-plus'); await expect(page.locator('#transition-status')).toContainText('2500 ms'); await clickPanel(page, 'duration-minus');
  await clickPanel(page, 'wipe-direction'); await clickPanel(page, 'travel-add');
  await clickPanel(page, 'travel-plus'); await clickPanel(page, 'travel-axis'); await clickPanel(page, 'travel-plus');
  await page.screenshot({ path: 'test-results/t17-pupitre-points.png' });
  await clickPanel(page, 'travel-add'); await clickPanel(page, 'travel-point'); await clickPanel(page, 'travel-remove');
  await clickPanel(page, 'travel-back'); await clickPanel(page, 'preview-test');
  await expect(page.locator('#preview-status')).toContainText('Trajet C1 → C4');
  await expect(page.locator('#preview-status')).toContainText('Aperçu C4', { timeout: 30000 });
  await expect(page.locator('#route-1')).toHaveText('Écran 1 ← C1');
  await clickPanel(page, 'broadcast'); await expect(page.locator('#route-1')).toHaveText('Écran 1 ← C4', { timeout: 30000 });
  // A C8→C4 path with a low intermediate point enters the stage deck.
  await clickPanel(page, 'camera-8'); await clickPanel(page, 'transition-next'); // cut
  await clickPanel(page, 'broadcast'); await expect(page.locator('#route-1')).toHaveText('Écran 1 ← C8', { timeout: 30000 });
  await clickPanel(page, 'camera-4'); await clickPanel(page, 'transition-prev'); await clickPanel(page, 'wipe-direction');
  // Remove the prior point, add a new midpoint, and lower Y into the plateau envelope.
  await clickPanel(page, 'travel-remove'); await clickPanel(page, 'travel-add');
  for (let i = 0; i < 13; i++) await clickPanel(page, 'travel-minus');
  await clickPanel(page, 'travel-back'); await clickPanel(page, 'broadcast');
  await expect(page.locator('#panel-message')).toContainText('Trajet bloqué'); await expect(page.locator('#route-1')).toHaveText('Écran 1 ← C8');
  await page.screenshot({ path: 'test-results/t17-pupitre-refus.png' }); expect(errors).toEqual([]);
});

test('previews authorised paths near the ground and a structure, and refuses an obstacle crossing without disturbing preview', async ({ page }) => {
  test.setTimeout(180000); const h = await open(page), original = await h.call('liveHashes');
  // The direct approach to the left structure crosses the monitor's declared envelope.
  await expect(h.call('startPreviewTest', 'virtual-travel', [[-8.7, 4, 4]])).rejects.toThrow('moniteur');
  for (const [name, progress, waypoints] of [['sol', 0.66, [[0, 0.6, -6]]], ['structure', 0.78, [[0, 9, 0], [-8.7, 4, 4]]]] as const) {
    await h.call('startPreviewTest', 'virtual-travel', waypoints); await h.call('advancePreview', progress);
    await page.locator('canvas').screenshot({ path: `test-results/t17-proche-${name}.png` });
    await h.call('advancePreview', 1); expect((await h.call('previewState')).source).toBe(4); expect(await h.call('liveHashes')).toEqual(original);
  }
  await h.call('target', 1); await h.call('target', 3); await h.call('target', 2);
  expect(await h.call('startPreviewTest', 'virtual-travel')).toMatchObject({ reference: 2, referenceSource: 2, destination: 4 });
  await h.call('advancePreview', 0.5); await h.call('advancePreview', 1); expect(await h.call('liveHashes')).toEqual(original);
  const before = (await h.call('samples')).hash, ids = (await h.call('status')).renderTargets.map((target) => target.id).sort();
  await expect(h.call('startPreviewTest', 'virtual-travel', [[0, 1.6, 10]])).rejects.toThrow('Trajet bloqué');
  expect((await h.call('samples')).hash).toBe(before); expect((await h.call('status')).renderTargets.map((target) => target.id).sort()).toEqual(ids);
});
