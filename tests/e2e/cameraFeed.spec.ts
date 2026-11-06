import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function measure(page: Page) {
  const previous = await page.locator('body').getAttribute('data-measure');
  await page.getByRole('button', { name: 'Mesurer le flux' }).click();
  await expect.poll(() => page.locator('body').getAttribute('data-measure')).not.toBe(previous);
  return (await page.locator('body').getAttribute('data-hash'))!;
}

function checkErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  return errors;
}

test('displays an asymmetric calibration image without mirroring, color drift or canvas-aspect distortion', async ({ page }) => {
  const errors = checkErrors(page);
  await page.goto('/tests/e2e/fixtures/feed.html?calibration');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const originalHash = await measure(page);
  const samples = JSON.parse((await page.locator('body').getAttribute('data-samples'))!);
  const closeColor = (actual: number[], expected: number[]) => expected.forEach((value, index) => expect(Math.abs(actual[index] - value)).toBeLessThanOrEqual(2));
  closeColor(samples.topLeft, [75, 197, 203, 255]);
  closeColor(samples.bottomRight, [214, 89, 82, 255]);
  closeColor(samples.topRight, [12, 22, 34, 255]);
  closeColor(samples.centerBlank, [12, 22, 34, 255]);
  const expectedBars = [[230, 235, 235], [232, 201, 82], [75, 197, 203], [84, 176, 115], [187, 105, 183], [214, 89, 82], [70, 113, 196], [40, 51, 66]];
  expectedBars.forEach((color, index) => closeColor(samples.bars[index], [...color, 255]));
  const hideControls = await page.addStyleTag({ content: 'nav{visibility:hidden}' });
  await expect(page.getByLabel('Écran gauche en direct')).toHaveScreenshot('calibration-on-screen.png', { maxDiffPixelRatio: 0.005 });
  await hideControls.evaluate((element) => element.parentNode?.removeChild(element));
  await expect.poll(async () => Number(await page.locator('body').getAttribute('data-aspect'))).toBeCloseTo(16 / 9, 4);
  await page.setViewportSize({ width: 800, height: 800 });
  await expect.poll(async () => Number(await page.locator('body').getAttribute('data-aspect'))).toBeCloseTo(16 / 9, 4);
  expect(await measure(page)).toBe(originalHash);
  await expect(page.locator('body')).toHaveAttribute('data-observer', 'true');
  await expect(page.locator('body')).toHaveAttribute('data-duplicate-pass', 'false');
  await page.getByRole('button', { name: 'Ajouter un objet filmable' }).click();
  await expect.poll(() => measure(page)).not.toBe(originalHash);
  expect(errors).toEqual([]);
});

test('updates the physical screen live while keeping camera selection independent from C1', async ({ page }) => {
  const errors = checkErrors(page);
  await page.goto('/tests/e2e/fixtures/feed.html');
  await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
  const originalHash = await measure(page);
  const canvas = page.getByLabel('Écran gauche en direct');
  const originalScreen = await canvas.screenshot({ style: 'nav{visibility:hidden}' });
  await page.getByRole('button', { name: 'Sélectionner C4' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-selected', '4');
  expect(await measure(page)).toBe(originalHash);
  expect((await canvas.screenshot({ style: 'nav{visibility:hidden}' })).equals(originalScreen)).toBe(true);
  await page.getByRole('button', { name: 'Déplacer le chanteur' }).click();
  await expect.poll(() => measure(page)).not.toBe(originalHash);
  await expect(async () => { expect((await canvas.screenshot({ style: 'nav{visibility:hidden}' })).equals(originalScreen)).toBe(false); }).toPass();
  await expect(page.locator('body')).toHaveAttribute('data-observer', 'true');
  await expect(page.locator('body')).toHaveAttribute('data-duplicate-pass', 'false');
  await page.getByRole('button', { name: 'Arrêter le flux' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-targets', '0');
  await expect(page.locator('body')).toHaveAttribute('data-restored', 'true');
  const stoppedFrame = await page.locator('body').getAttribute('data-frame');
  await canvas.screenshot({ style: 'nav{visibility:hidden}' });
  await expect(page.locator('body')).toHaveAttribute('data-frame', stoppedFrame!);
  expect(errors).toEqual([]);
});
