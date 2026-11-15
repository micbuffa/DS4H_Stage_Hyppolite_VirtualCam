import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { harness, near } from './transitionHarness';
import { clickPanel } from './panelProjection';

async function open(page: Page) {
  await page.goto('/tests/e2e/fixtures/transitions.html?preview'); await expect(page.locator('body')).toHaveAttribute('data-ready', 'true'); return harness(page);
}
async function previewReady(h: ReturnType<typeof harness>, source?: number) {
  await expect.poll(async () => (await h.call('previewState')).phase).toBe('ready');
  if (source) expect((await h.call('previewState')).source).toBe(source);
}

test('shares live sources, follows selection, labels the actual image and keeps the monitor out of all feeds', async ({ page }) => {
  const h = await open(page); const cameras = await h.call('cameras'), observer = await h.call('observerPose');
  await h.call('activatePreview'); expect((await h.call('status')).stats).toMatchObject({ active: 1, allocated: 1 });
  await h.call('select', 4); await previewReady(h, 4);
  near((await h.call('samples')).samples[2], [220, 130, 35, 255]);
  const state = await h.call('status'); expect(state).toMatchObject({ routes: { 1: 1, 2: 1, 3: 1 }, liveMaterials: true, stats: { active: 2, allocated: 2 } });
  expect(state.renderTargets.every((item) => !item.includesMonitor)).toBe(true);
  const textures = state.renderTargets.map((item) => item.id).sort();
  await h.call('cut', 1, [1]); await previewReady(h, 4);
  expect((await h.call('status')).renderTargets.map((item) => item.id).sort()).toEqual(textures);
  expect(await h.call('cameras')).toEqual(cameras); expect(await h.call('observerPose')).toEqual(observer);
  await page.locator('canvas').screenshot({ path: 'test-results/t16-apercu-c4.png' });
  await h.call('target', 1); expect((await h.call('previewState')).reference).toBe(null);
  await expect(h.call('startPreviewTest')).rejects.toThrow('écran cible');
  await h.call('disablePreview'); expect((await h.call('status')).stats).toMatchObject({ active: 1, allocated: 1 });
});

for (const mode of ['dissolve', 'rolling-cubes', 'luma-wipe', 'split'] as const) {
  test(`tests ${mode} on the monitor from the smallest target while every live screen stays unchanged`, async ({ page }) => {
    const h = await open(page); await h.call('cut', 2, [2]); await h.call('cut', 3, [3]);
    await h.call('target', 1); await h.call('target', 3); await h.call('target', 2);
    await h.call('inspect', 'screen', 2); const before = await h.call('samples');
    await h.call('inspect', 'monitor'); const cameras = await h.call('cameras'), observer = await h.call('observerPose');
    await h.call('select', 4); await h.call('activatePreview'); const b = await h.call('samples');
    const started = await h.call('startPreviewTest', mode); expect(started).toMatchObject({ reference: 2, referenceSource: 2, source: 4 });
    expect((await h.call('samples')).hash).toBe(before.hash);
    await h.call('advancePreview', 0.5); const middle = await h.call('samples'); expect(middle.hash).not.toBe(before.hash); expect(middle.hash).not.toBe(b.hash);
    await expect(page.locator('canvas')).toHaveScreenshot(`t16-test-${mode}-50.png`, { maxDiffPixelRatio: 0.001 });
    const status = await h.call('status'); expect(status).toMatchObject({ routes: { 1: 1, 2: 2, 3: 3 }, liveMaterials: true, materials: 1, stats: { active: 4, allocated: 4 } });
    expect(status.renderTargets.every((item) => !item.includesMonitor)).toBe(true);
    await h.call('inspect', 'screen', 2); expect((await h.call('samples')).hash).toBe(before.hash);
    await h.call('inspect', 'monitor'); expect(await h.call('observerPose')).toEqual(observer);
    const complete = await h.call('advancePreview', 1); expect(complete).toMatchObject({ phase: 'ready', source: 4 });
    expect((await h.call('samples')).hash).toBe(b.hash); expect(await h.call('cameras')).toEqual(cameras);
    expect((await h.call('status')).materials).toBe(0);
  });
}

for (const action of ['complete', 'cancel'] as const) {
  test(`suspends preview and its test before broadcasting, then restores the latest selection after ${action}`, async ({ page }) => {
    const h = await open(page); await h.call('cut', 2, [2]); await h.call('cut', 3, [3]);
    await h.call('select', 7); await h.call('activatePreview'); await h.call('startPreviewTest'); await h.call('advancePreview', 0.5);
    await h.call('start', 'dissolve', 'left', [1, 2, 3]);
    expect(await h.call('previewState')).toMatchObject({ phase: 'suspended', source: null });
    expect((await h.call('status')).stats).toMatchObject({ active: 4, allocated: 4 });
    await h.call('select', 8); expect((await h.call('previewState')).requested).toBe(8);
    if (action === 'complete') await h.call('advance', 1); else await h.call('cancel');
    await previewReady(h, 8);
    expect((await h.call('status')).routes).toEqual(action === 'complete' ? { 1: 4, 2: 4, 3: 4 } : { 1: 1, 2: 2, 3: 3 });
    expect((await h.call('status')).maxActive).toBe(4);
  });
}

test('uses the actual no-signal image when the reference has no live source', async ({ page }) => {
  await page.goto('/tests/e2e/fixtures/transitions.html?preview&offline'); await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const h = harness(page); await h.call('inspect', 'screen'); const offline = await h.call('samples');
  await h.call('inspect', 'monitor'); await h.call('select', 4); await h.call('activatePreview'); const b = await h.call('samples');
  expect(await h.call('startPreviewTest')).toMatchObject({ referenceSource: null, source: 4 });
  expect((await h.call('samples')).hash).toBe(offline.hash); await h.call('advancePreview', 1);
  expect((await h.call('samples')).hash).toBe(b.hash); expect((await h.call('status')).routes).toEqual({ 1: null, 2: null, 3: null });
});

test('discards stale preparations and recovers the previous image after source and shader failures', async ({ page }) => {
  const h = await open(page); await h.call('cut', 2, [2]); await h.call('cut', 3, [3]);
  await h.call('select', 4); await h.call('activatePreview'); const before = await h.call('samples');
  await h.call('delaySource', 7); await h.call('select', 7);
  await expect.poll(async () => (await h.call('status')).stats.allocated).toBe(5);
  expect((await h.call('status')).stats.active).toBe(4); expect((await h.call('samples')).hash).toBe(before.hash);
  await h.call('select', 8); await previewReady(h, 8); const latest = await h.call('samples');
  await h.call('resolveSource', 7); expect((await h.call('samples')).hash).toBe(latest.hash);
  await h.call('failSource', 9); await h.call('select', 9);
  await expect.poll(async () => (await h.call('previewState')).phase).toBe('error');
  expect(await h.call('previewState')).toMatchObject({ source: 8, requested: 9 }); expect((await h.call('samples')).hash).toBe(latest.hash);
  await h.call('fail', 'none'); await h.call('select', 4); await previewReady(h, 4);
  await h.call('fail', 'shader'); const failed = await h.call('startPreviewTest'); expect(failed).toMatchObject({ phase: 'error', source: 4 });
  expect(await h.call('status')).toMatchObject({ materials: 0, effectsReady: true, liveMaterials: true });
  await h.call('fail', 'none'); await h.call('startPreviewTest', 'cut'); await previewReady(h, 4);
  expect((await h.call('status')).maxActive).toBe(4);
});

test('suspends preview during quality replacement and restores it after a quality or broadcast failure', async ({ page }) => {
  const h = await open(page); await h.call('cut', 2, [2]); await h.call('cut', 3, [3]); await h.call('select', 4); await h.call('activatePreview');
  const routes = (await h.call('status')).routes;
  await h.call('startPreviewTest'); await h.call('advancePreview', 0.5);
  await h.call('quality', 'standard'); await previewReady(h, 4);
  expect((await h.call('status')).renderTargets.every((item) => item.size.width === 1024 && item.size.height === 576)).toBe(true);
  await expect(h.call('quality', 'unknown')).rejects.toThrow(); await previewReady(h, 4);
  await h.call('failSource', 7); await expect(h.call('cut', 7, [1])).rejects.toThrow(); await previewReady(h, 4);
  expect((await h.call('status')).routes).toEqual(routes); expect((await h.call('status')).maxActive).toBeLessThanOrEqual(4);
});

test('releases preview leases, shaders and observers across repeated tests and deactivations', async ({ page }) => {
  const h = await open(page); const baseline = (await h.call('status')).resources; await h.call('select', 4);
  for (let cycle = 0; cycle < 5; cycle++) {
    await h.call('activatePreview'); await h.call('startPreviewTest'); await h.call('advancePreview', 0.5); await h.call('stopPreviewTest'); await h.call('disablePreview');
    expect(await h.call('status')).toMatchObject({ materials: 0, stats: { active: 1, allocated: 1 }, resources: baseline });
  }
  await h.call('stopPreview'); expect((await h.call('status')).resources.meshes).toBeLessThan(baseline.meshes);
});

test('uses the spatial preview controls, shows the actual source and leaves live assignments unchanged during testing', async ({ page }) => {
  test.setTimeout(180000);
  await page.goto('/'); await expect(page.getByRole('status')).toContainText('Prêt à explorer'); await clickPanel(page, 'pause');
  await clickPanel(page, 'camera-4'); await clickPanel(page, 'preview-toggle');
  await expect(page.locator('#preview-status')).toContainText('Aperçu C4'); await expect(page.locator('#preview-status')).toContainText('Écran 1');
  await expect(page.locator('#route-1')).toHaveText('Écran 1 ← C1');
  await page.screenshot({ path: 'test-results/t16-pupitre-apercu.png' });
  await clickPanel(page, 'transition-page'); await clickPanel(page, 'transition-next');
  for (let index = 0; index < 24; index++) await clickPanel(page, 'duration-plus');
  await clickPanel(page, 'preview-test'); await expect(page.locator('#preview-status')).toContainText('Test C1 → C4');
  await expect(page.locator('#route-1')).toHaveText('Écran 1 ← C1'); await clickPanel(page, 'preview-cancel');
  await expect(page.locator('#preview-status')).toContainText('Aperçu C4');
  await clickPanel(page, 'broadcast'); await expect(page.locator('#route-1')).toHaveText('Écran 1 ← C4');
  await expect(page.locator('#preview-status')).toContainText('Aperçu C4');
  await clickPanel(page, 'screen-1'); await clickPanel(page, 'camera-7'); await expect(page.locator('#preview-status')).toContainText('Aperçu C7');
  await expect(page.locator('#preview-status')).toContainText('Sans écran cible');
  await clickPanel(page, 'preview-toggle'); await expect(page.locator('#preview-status')).toContainText('désactivé');
});
