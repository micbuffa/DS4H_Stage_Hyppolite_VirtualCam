import { expect, test } from '@playwright/test';
import { graphicTransitionModes, lumaWeight, smoothProgress } from '../../src/domain/direction/graphicTransitions';
import { transitionSettings } from '../../src/domain/direction/transitionDefinition';
import { harness, near, points } from './transitionHarness';
import { clickPanel } from './panelProjection';

for (const mode of graphicTransitionModes) {
  test(`validates ${mode} calibration frames, deterministic parameters and shader recovery`, async ({ page }) => {
    test.setTimeout(180000);
    await page.goto('/tests/e2e/fixtures/transitions.html'); await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
    const h = harness(page); await h.call('detailPatterns'); const cameras = await h.call('cameras');
    await h.call('cut', 4); const b = await h.call('samples'); await h.call('cut', 1); const a = await h.call('samples');
    const parameters = { columns: 4, rows: 2, seed: 19, strength: 0.8 };
    await h.call('start', mode, 'left', [1], parameters);
    const hashes: string[] = [];
    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      if (progress) await h.call('advance', progress);
      const image = await h.call('samples'); hashes.push(image.hash); expect(image.opaque).toBe(true);
      if (mode === 'split' && progress > 0 && progress < 1) expect(image.minColor).toBe(0);
      else expect(image.minColor).toBeGreaterThan(15);
      expect(image.maxChannel).toBeLessThan(250);
      await expect(page.locator('canvas')).toHaveScreenshot(`t15-${mode}-mire-${progress * 100}.png`, { maxDiffPixelRatio: 0.001 });
      expect(await h.call('cameras')).toEqual(cameras);
    }
    expect(hashes[0]).toBe(a.hash); expect(hashes[4]).toBe(b.hash);
    expect(new Set(hashes).size).toBe(mode === 'split' ? 3 : 5);
    expect(await h.call('status')).toMatchObject({ materials: 0, observer: true, stats: { active: 2, allocated: 2 } });
    await h.call('cut', 1); await h.call('start', mode, 'left', [1], parameters); await h.call('advance', 0.5);
    expect((await h.call('samples')).hash).toBe(hashes[2]); await h.call('cancel');
    expect((await h.call('samples')).hash).toBe(a.hash);
    const variations = mode === 'split' ? [] : mode === 'zoom' ? [{ strength: 0 }] : [{ seed: 20 }, { columns: 32, rows: 18, seed: 0xffffffff, strength: 1 }];
    for (const changed of variations) {
      await h.call('start', mode, 'left', [1], { ...parameters, ...changed }); await h.call('advance', 0.5);
      const image = await h.call('samples'); expect(image.hash).not.toBe(hashes[2]); expect(image.minColor).toBeGreaterThan(15);
      await h.call('cancel');
    }
    await h.call('fail', 'shader'); expect(await h.call('start', mode)).toMatchObject({ phase: 'error', materials: 0, effectsReady: true, stats: { active: 1, allocated: 1 } });
    expect((await h.call('samples')).hash).toBe(a.hash);
    await h.call('fail', 'none'); await h.call('start', mode); await h.call('advance', 1);
    expect((await h.call('status')).routes[1]).toBe(4); expect(await h.call('cameras')).toEqual(cameras);
  });

  test(`renders ${mode} on the animated concert with four shared live sources`, async ({ page }) => {
    test.setTimeout(180000);
    await page.goto('/tests/e2e/fixtures/transitions.html?concert'); await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
    const h = harness(page); const cameras = await h.call('cameras');
    await h.call('cut', 2, [2]); await h.call('cut', 3, [3]); await h.call('concertTime', 0);
    const before = await h.call('samples');
    await h.call('start', mode, 'left', [1, 2, 3], { columns: 4, rows: 2, seed: 19, strength: 0.8 });
    expect((await h.call('samples')).hash).toBe(before.hash);
    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      await h.call('concertTime', progress * 2); if (progress) await h.call('advance', progress);
      await expect(page.locator('canvas')).toHaveScreenshot(`t15-${mode}-concert-${progress * 100}.png`, { maxDiffPixelRatio: 0.002, timeout: 30000 });
      if (progress === 0.5) {
        const first = await h.call('samples'), frames = (await h.call('status')).frames;
        await h.call('concertTime', 3); expect((await h.call('samples')).hash).not.toBe(first.hash);
        const current = await h.call('status');
        for (const id of ['1', '2', '3', '4']) expect(current.frames[id]).toBeGreaterThan(frames[id]);
        expect(current).toMatchObject({ routes: { 1: 1, 2: 2, 3: 3 }, materials: 3, observer: true, stats: { active: 4, allocated: 4 } });
      }
      expect(await h.call('cameras')).toEqual(cameras);
    }
    const final = await h.call('samples'); await h.call('cut', 1); await h.call('cut', 4);
    expect((await h.call('samples')).hash).toBe(final.hash);
    expect(await h.call('status')).toMatchObject({ materials: 0, maxActive: 4, stats: { active: 1, allocated: 1 } });
  });
}

for (const mode of ['glitch', 'zoom', 'luma-wipe'] as const) {
  test(`matches ${mode} intermediate colors to the domain reference without full-screen flashes`, async ({ page }) => {
    await page.goto('/tests/e2e/fixtures/transitions.html'); await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
    const h = harness(page);
    const positions = mode === 'luma-wipe' ? points : [[0.33, 0.4], [0.65, 0.4], [0.5, 0.6]] as const;
    await h.call('cut', 4); const b = await h.call('samples', positions); await h.call('cut', 1); const a = await h.call('samples', positions);
    const progressions = mode === 'glitch' ? Array.from({ length: 8 }, (_, i) => (i + 0.5) / 8) : [0.25, 0.5, 0.75];
    for (const strength of [1, 0]) {
      const parameters = transitionSettings({ mode, parameters: { seed: 0xffffffff, strength, rows: 18 } }).parameters;
      await h.call('start', mode, 'left', [1], parameters);
      for (const progress of progressions) {
        await h.call('advance', progress); const image = await h.call('samples', positions);
        expect(image.minColor).toBeGreaterThan(15); expect(image.maxChannel).toBeLessThan(250); expect(image.opaque).toBe(true);
        image.samples.forEach((sample, index) => {
          const x = (Math.floor(positions[index][0] * 640) + 0.5) / 640, y = 1 - (Math.floor(positions[index][1] * 360) + 0.5) / 360;
          const weight = mode === 'luma-wipe' ? lumaWeight(progress, [x, y], parameters) : smoothProgress(progress);
          const expected = a.samples[index].map((value, channel) => channel === 3 ? 255 : Math.round(255 * (((1 - weight) * (value / 255) ** 2.2 + weight * (b.samples[index][channel] / 255) ** 2.2) ** (1 / 2.2))));
          near(sample, expected);
        });
      }
      await h.call('cancel');
    }
  });
}

test('preserves both complete asymmetric frames in the split and draws defined letterbox bars', async ({ page }) => {
  await page.goto('/tests/e2e/fixtures/transitions.html'); await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const h = harness(page); await h.call('detailPatterns');
  const corners = [[0.05, 0.05], [0.95, 0.05], [0.05, 0.95], [0.95, 0.95]] as const;
  await h.call('cut', 4); const b = await h.call('samples', corners); await h.call('cut', 1); const a = await h.call('samples', corners);
  await h.call('start', 'split'); await h.call('advance', 0.5);
  for (const [source, image] of [[0, a], [1, b]] as const) {
    const output = await h.call('samples', corners.map(([x, y]) => [source * 0.5 + x * 0.5, 0.25 + y * 0.5] as const));
    output.samples.forEach((sample, index) => near(sample, image.samples[index], 3));
  }
  const bars = await h.call('samples', [[0.25, 0.1], [0.75, 0.1], [0.25, 0.9], [0.75, 0.9]]);
  for (const sample of bars.samples) expect(sample).toEqual([0, 0, 0, 255]);
  await h.call('cancel');
});

test('selects and broadcasts the four complementary modes using the physical pupitre', async ({ page }) => {
  test.setTimeout(180000);
  await page.goto('/'); await expect(page.getByRole('status')).toContainText('Prêt à explorer');
  await clickPanel(page, 'pause'); await clickPanel(page, 'transition-page'); await clickPanel(page, 'transition-prev'); await clickPanel(page, 'transition-prev');
  for (const [name, camera] of [['Écran partagé', 4], ['Volet de luminance', 7], ['Zoom', 8], ['Glitch', 9]] as const) {
    await expect(page.locator('#transition-status')).toContainText(name);
    if (name !== 'Écran partagé') {
      await clickPanel(page, 'wipe-direction'); await clickPanel(page, 'grid-strength');
      if (name !== 'Zoom') { await clickPanel(page, 'grid-size'); await clickPanel(page, 'seed-plus'); }
      if (name === 'Glitch') await page.screenshot({ path: 'test-results/t15-pupitre-effets.png' });
      await clickPanel(page, 'wipe-direction');
    }
    await clickPanel(page, `camera-${camera}`); await clickPanel(page, 'broadcast');
    await expect(page.locator('#route-1')).toHaveText(`Écran 1 ← C${camera}`);
    await expect(page.locator('#panel-message')).not.toHaveAttribute('data-state', 'error');
    await clickPanel(page, 'transition-prev');
  }
});
