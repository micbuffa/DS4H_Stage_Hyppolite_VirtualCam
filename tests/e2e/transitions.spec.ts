import { expect, test } from '@playwright/test';
import { basicTransitionWeights } from '../../src/domain/direction/basicTransitions';
import { transitionSettings } from '../../src/domain/direction/transitionDefinition';
import { gridCellProgress, gridTransitionModes } from '../../src/domain/direction/gridTransitions';
import { clickPanel } from './panelProjection';

import { harness, near, points } from './transitionHarness';

test('renders exact endpoints and linear intermediate images for all basic effects and wipe directions', async ({ page }) => {
  test.setTimeout(180000);
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/tests/e2e/fixtures/transitions.html'); await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const h = harness(page);
  await h.call('cut', 4); const b = await h.call('samples');
  await h.call('cut', 1); const a = await h.call('samples');
  expect(a.hash).not.toBe(b.hash);
  // This central point must see the pattern, not a screen frame in the fixture.
  near(a.samples[2], [30, 60, 120, 255]);
  near(b.samples[2], [220, 130, 35, 255]);
  for (const [mode, direction] of [['dissolve', 'left'], ['dip-black', 'left'], ['wipe', 'left'], ['wipe', 'right'], ['wipe', 'up'], ['wipe', 'down']] as const) {
    await h.call('cut', 1); await h.call('start', mode, direction);
    expect((await h.call('samples')).samples).toEqual(a.samples);
    for (const progress of [0.25, 0.5, 0.75]) {
      const state = await h.call('advance', progress);
      expect(state.routes).toEqual({ 1: 1, 2: 1, 3: 1 });
      const image = await h.call('samples');
      image.samples.forEach((sample, index) => {
        const [wa, wb] = basicTransitionWeights(mode, progress, [points[index][0], 1 - points[index][1]], direction);
        const expected = a.samples[index].map((value, channel) => channel === 3 ? 255 : Math.round(255 * ((wa * (value / 255) ** 2.2 + wb * (b.samples[index][channel] / 255) ** 2.2) ** (1 / 2.2))));
        near(sample, expected);
      });
      if (mode === 'dissolve' && progress === 0.5) await page.getByLabel('Écran de recette des transitions').screenshot({ path: 'test-results/t13-dissolve-midpoint.png' });
    }
    const state = await h.call('advance', 1);
    expect(state).toMatchObject({ routes: { 1: 4, 2: 1, 3: 1 }, phase: 'completed', materials: 0, observer: true });
    expect((await h.call('samples')).samples).toEqual(b.samples);
  }
  expect(errors).toEqual([]);
});

test('keeps four sources live during a grouped transition, restores them on cancellation and shares the final feed', async ({ page }) => {
  await page.goto('/tests/e2e/fixtures/transitions.html'); await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const h = harness(page);
  await h.call('cut', 2, [2]); await h.call('cut', 3, [3]);
  const before = await h.call('samples');
  const prepared = await h.call('start', 'dissolve', 'left', [1, 2, 3]);
  expect(prepared.stats).toMatchObject({ active: 4, allocated: 4 });
  await h.call('advance', 0.5);
  const first = await h.call('samples');
  await h.call('movePatterns');
  const moved = await h.call('samples');
  expect(moved.hash).not.toBe(first.hash);
  const moving = await h.call('status');
  for (const id of ['1', '2', '3', '4']) expect(moving.frames[id]).toBeGreaterThan(prepared.frames[id]);
  const cancelled = await h.call('cancel');
  expect(cancelled).toMatchObject({ routes: { 1: 1, 2: 2, 3: 3 }, phase: 'cancelled', materials: 0, stats: { active: 3, allocated: 3 } });
  // Patterns moved while live, so compare the restored source against a fresh direct frame.
  expect((await h.call('samples')).hash).not.toBe(before.hash);
  await h.call('start', 'wipe', 'left', [1, 2, 3]);
  const completed = await h.call('advance', 1);
  expect(completed).toMatchObject({ routes: { 1: 4, 2: 4, 3: 4 }, materials: 0, stats: { active: 1, allocated: 1 }, maxActive: 4 });
});

test('restores the direct after source, shader preparation and in-flight shader failures', async ({ page }) => {
  await page.goto('/tests/e2e/fixtures/transitions.html'); await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const h = harness(page); const before = await h.call('samples');
  for (const failure of ['source', 'shader'] as const) {
    await h.call('fail', failure);
    const state = await h.call('start', 'dissolve');
    expect(state).toMatchObject({ phase: 'error', routes: { 1: 1, 2: 1, 3: 1 }, materials: 0, effectsReady: true, stats: { active: 1, allocated: 1 } });
    expect((await h.call('samples')).hash).toBe(before.hash);
  }
  await h.call('fail', 'none'); await h.call('start', 'dissolve'); await h.call('advance', 0.5);
  await h.call('failDuring'); const failed = await h.call('advance', 0.75);
  expect(failed).toMatchObject({ phase: 'error', materials: 0, stats: { active: 1, allocated: 1 } });
  expect((await h.call('samples')).hash).toBe(before.hash);
  await h.call('start', 'dissolve'); expect((await h.call('advance', 1)).routes[1]).toBe(4);
});

test('uses the physical transition page, preserves selection independence and completes a fade while the concert is paused', async ({ page }) => {
  test.setTimeout(120000);
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/'); await expect(page.getByRole('status')).toContainText('Prêt à explorer');
  await clickPanel(page, 'pause');
  await clickPanel(page, 'transition-page');
  await clickPanel(page, 'transition-next');
  await expect(page.locator('#transition-status')).toContainText('Fondu enchaîné · 600 ms');
  await clickPanel(page, 'duration-plus');
  await expect(page.locator('#transition-status')).toContainText('700 ms');
  await clickPanel(page, 'camera-4');
  await expect(page.locator('#feed-status')).toHaveText('Écran 1 ← C1 · Écran 2 ← C1 · Écran 3 ← C1');
  await page.screenshot({ path: 'test-results/t13-transition-panel.png' });
  await clickPanel(page, 'broadcast');
  await expect(page.locator('#route-1')).toHaveText('Écran 1 ← C4');
  await expect(page.locator('#panel-message')).toContainText('Concert en pause');
  await clickPanel(page, 'transition-next'); await expect(page.locator('#transition-status')).toContainText('Fondu au noir');
  await clickPanel(page, 'transition-next'); await expect(page.locator('#transition-status')).toContainText('Volet');
  await clickPanel(page, 'wipe-direction');
  await clickPanel(page, 'camera-7'); await clickPanel(page, 'broadcast');
  await expect(page.locator('#route-1')).toHaveText('Écran 1 ← C7');
  for (let index = 0; index < 23; index++) await clickPanel(page, 'duration-plus');
  await expect(page.locator('#transition-status')).toContainText('3000 ms');
  await clickPanel(page, 'camera-8'); await clickPanel(page, 'broadcast');
  await expect(page.getByLabel('Qualité vidéo')).toBeDisabled();
  await clickPanel(page, 'cancel-transition');
  await expect(page.locator('#panel-message')).toContainText('Transition annulée');
  await expect(page.locator('#route-1')).toHaveText('Écran 1 ← C7');
  await expect(page.getByLabel('Qualité vidéo')).toBeEnabled();
  await clickPanel(page, 'transition-page');
  await clickPanel(page, 'fov-plus');
  await expect(page.locator('#panel-message')).not.toHaveAttribute('data-state', 'error');
  expect(errors).toEqual([]);
});

test('suspends the real browser driver on a simulated visibility event and resumes without catch-up', async ({ page }) => {
  await page.goto('/tests/e2e/fixtures/transitions.html'); await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const h = harness(page); await h.call('realtime'); await h.call('start', 'dissolve');
  await h.call('visibility', true);
  const hidden = await h.call('status');
  // A real wall-clock delay is necessary to distinguish a paused clock from progression.
  await page.waitForTimeout(400);
  const frozen = await h.call('status'); expect(frozen.progress).toBe(hidden.progress);
  expect(frozen.routes[1]).toBe(1);
  await h.call('visibility', false);
  const resumed = await h.call('status'); expect(resumed.progress - frozen.progress).toBeLessThan(0.05);
  await expect.poll(async () => (await h.call('status')).phase, { timeout: 7000 }).toBe('completed');
  expect((await h.call('status')).routes[1]).toBe(4);
});

for (const mode of gridTransitionModes) {
  test(`validates ${mode} on a detailed calibration grid, deterministic frames, bounds and shader recovery`, async ({ page }) => {
    test.setTimeout(180000);
    await page.goto('/tests/e2e/fixtures/transitions.html'); await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
    const h = harness(page); await h.call('detailPatterns');
    await h.call('cut', 4); const b = await h.call('samples');
    await h.call('cut', 1); const a = await h.call('samples');
    const parameters = { columns: 4, rows: 2, seed: 19, strength: 0.8 };
    const hashes: string[] = [];
    await h.call('start', mode, 'left', [1], parameters);
    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      if (progress) await h.call('advance', progress);
      const image = await h.call('samples'); hashes.push(image.hash);
      expect(image.opaque).toBe(true); expect(image.minColor).toBeGreaterThan(15);
      await expect(page.locator('canvas')).toHaveScreenshot(`t14-${mode}-mire-${progress * 100}.png`, { maxDiffPixelRatio: 0.001 });
    }
    expect(hashes[0]).toBe(a.hash); expect(hashes[4]).toBe(b.hash);
    expect(new Set(hashes).size).toBe(5);
    expect(await h.call('status')).toMatchObject({ phase: 'completed', materials: 0, observer: true, stats: { allocated: 2, active: 2 } });
    await h.call('cut', 1); await h.call('start', mode, 'left', [1], parameters); await h.call('advance', 0.5);
    expect((await h.call('samples')).hash).toBe(hashes[2]); await h.call('cancel');
    expect((await h.call('samples')).hash).toBe(a.hash);
    for (const changed of [{ seed: 20 }, { columns: 32, rows: 18, seed: 0xffffffff, strength: 1 }, ...(mode === 'mosaic' ? [] : [{ strength: 0 }])]) {
      await h.call('start', mode, 'left', [1], { ...parameters, ...changed }); await h.call('advance', 0.5);
      const image = await h.call('samples'); expect(image.hash).not.toBe(hashes[2]); expect(image.minColor).toBeGreaterThan(15);
      await h.call('cancel');
    }
    await h.call('fail', 'shader'); const failed = await h.call('start', mode);
    expect(failed).toMatchObject({ phase: 'error', materials: 0, effectsReady: true, stats: { allocated: 1, active: 1 } });
    expect((await h.call('samples')).hash).toBe(a.hash);
    await h.call('fail', 'none'); await h.call('start', mode); await h.call('advance', 1);
    expect((await h.call('status')).routes[1]).toBe(4);
  });

  test(`renders ${mode} on the animated concert with shared live sources`, async ({ page }) => {
    test.setTimeout(180000);
    await page.goto('/tests/e2e/fixtures/transitions.html?concert'); await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
    const h = harness(page);
    await h.call('cut', 2, [2]); await h.call('cut', 3, [3]);
    await h.call('concertTime', 0); const before = await h.call('samples');
    await h.call('start', mode, 'left', [1, 2, 3], { columns: 4, rows: 2, strength: 0.8, seed: 19 });
    expect((await h.call('samples')).hash).toBe(before.hash);
    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      await h.call('concertTime', progress * 2);
      if (progress) await h.call('advance', progress);
      await expect(page.locator('canvas')).toHaveScreenshot(`t14-${mode}-concert-${progress * 100}.png`, { maxDiffPixelRatio: 0.002, timeout: 30000 });
      if (progress === 0.5) {
        const first = await h.call('samples'); const frames = (await h.call('status')).frames;
        await h.call('concertTime', 3); const moved = await h.call('samples');
        expect(moved.hash).not.toBe(first.hash);
        const current = await h.call('status');
        for (const id of ['1', '2', '3', '4']) expect(current.frames[id]).toBeGreaterThan(frames[id]);
        expect(current).toMatchObject({ materials: 3, stats: { active: 4, allocated: 4 }, observer: true });
        expect(current.routes).toEqual({ 1: 1, 2: 2, 3: 3 });
      }
    }
    const final = await h.call('samples');
    await h.call('cut', 1); await h.call('cut', 4);
    expect((await h.call('samples')).hash).toBe(final.hash);
    expect(await h.call('status')).toMatchObject({ materials: 0, maxActive: 4, stats: { active: 1, allocated: 1 } });
  });
}

test('selects and broadcasts all grid effects using the physical pupitre and its parameter page', async ({ page }) => {
  test.setTimeout(180000);
  await page.goto('/'); await expect(page.getByRole('status')).toContainText('Prêt à explorer');
  await clickPanel(page, 'pause'); await clickPanel(page, 'transition-page');
  for (let index = 0; index < 6; index++) await clickPanel(page, 'transition-next');
  await expect(page.locator('#transition-status')).toContainText('Grid Morph');
  await clickPanel(page, 'wipe-direction'); await clickPanel(page, 'grid-size'); await clickPanel(page, 'seed-plus'); await clickPanel(page, 'grid-strength');
  await page.screenshot({ path: 'test-results/t14-pupitre-grille.png' });
  await expect(page.locator('#route-1')).toHaveText('Écran 1 ← C1');
  await clickPanel(page, 'wipe-direction');
  for (const [name, camera] of [['Grid Morph', 4], ['Mosaïque', 7], ['Rolling Cubes', 8]] as const) {
    await expect(page.locator('#transition-status')).toContainText(name);
    await clickPanel(page, `camera-${camera}`); await clickPanel(page, 'broadcast');
    await expect(page.locator('#route-1')).toHaveText(`Écran 1 ← C${camera}`);
    await expect(page.locator('#panel-message')).not.toHaveAttribute('data-state', 'error');
    await clickPanel(page, 'transition-prev');
  }
});

test('matches the mosaic GPU schedule to the domain reference at all intermediate progressions', async ({ page }) => {
  await page.goto('/tests/e2e/fixtures/transitions.html'); await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const h = harness(page); await h.call('cut', 4); const b = await h.call('samples'); await h.call('cut', 1); const a = await h.call('samples');
  const settings = transitionSettings({ mode: 'mosaic', parameters: { seed: 0xffffffff } });
  await h.call('start', 'mosaic', 'left', [1], settings.parameters);
  for (const progress of [0.25, 0.5, 0.75]) {
    await h.call('advance', progress); const image = await h.call('samples');
    image.samples.forEach((sample, index) => {
      // Match pixel-center UVs of the full-screen orthographic surface.
      const x = (Math.floor(points[index][0] * 640) + 0.5) / 640;
      const y = 1 - (Math.floor(points[index][1] * 360) + 0.5) / 360;
      const p = gridCellProgress(settings, progress, Math.floor(x * settings.parameters.columns), Math.floor(y * settings.parameters.rows));
      const weight = p * p * (3 - 2 * p);
      const expected = a.samples[index].map((value, channel) => channel === 3 ? 255 : Math.round(255 * (((1 - weight) * (value / 255) ** 2.2 + weight * (b.samples[index][channel] / 255) ** 2.2) ** (1 / 2.2))));
      near(sample, expected);
    });
  }
  await h.call('cancel');
});
