import { expect, test } from '@playwright/test';
import { cameraLabelPosition } from './cameraProjection';

test('selects a 3D camera without orbiting, toggles framing aids and returns to the home view', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await expect(page.getByRole('status')).toContainText('Prêt à explorer');
  await page.waitForLoadState('networkidle');
  const selection = page.locator('#selected-camera');
  await expect(selection).toContainText('C1');
  const clip = { x: 880, y: 240, width: 180, height: 120 };
  const initialScreen = await page.screenshot({ clip });
  const position = cameraLabelPosition(2);
  await page.mouse.move(position.x, position.y);
  await page.mouse.down();
  await page.mouse.move(position.x + 70, position.y + 20, { steps: 10 });
  await page.mouse.up();
  await expect(selection).toContainText('C2');
  expect((await page.screenshot({ clip })).equals(initialScreen)).toBe(true);
  await page.getByRole('button', { name: 'Masquer les aides' }).click();
  await expect(page.getByRole('button', { name: 'Afficher les aides' })).toHaveAttribute('aria-pressed', 'false');
  await page.getByLabel('Vue 3D navigable du laboratoire').focus();
  await page.keyboard.press('h');
  await expect(page.getByRole('button', { name: 'Masquer les aides' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.down('q');
  await expect(async () => { expect((await page.screenshot({ clip })).equals(initialScreen)).toBe(false); }).toPass();
  await page.keyboard.up('q');
  await page.keyboard.press('r');
  await expect(selection).toContainText('C2');
  await expect(async () => { expect((await page.screenshot({ clip })).equals(initialScreen)).toBe(true); }).toPass();
  await page.getByRole('button', { name: 'Réinitialiser C2' }).click();
  await expect(selection).toContainText('C2');
  await page.mouse.move(1100, 400);
  await page.mouse.down();
  await page.mouse.move(1170, 440, { steps: 10 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Vue régie' }).click();
  expect((await page.screenshot({ clip })).equals(initialScreen)).toBe(true);
  expect(errors).toEqual([]);
});

test('renders nine distinct capture presets with editor helpers excluded', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  const views = new Set<string>();
  for (let id = 1; id <= 9; id++) {
    await page.goto(`/tests/e2e/fixtures/cameras.html?camera=${id}`);
    await expect(page.locator('body')).toHaveAttribute('data-ready', 'true');
    const canvas = page.getByLabel('Vue caméra de captation');
    const screenshot = await canvas.screenshot({ path: `test-results/t04-camera-${id}.png` });
    views.add(screenshot.toString('base64'));
    if ([4, 7, 8].includes(id)) await expect(canvas).toHaveScreenshot(`capture-C${id}.png`, { maxDiffPixelRatio: 0.005 });
  }
  expect(views.size).toBe(9);
  expect(errors).toEqual([]);
});

test('selects every numbered 3D label from the observation view', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('status')).toContainText('Prêt à explorer');
  for (let id = 1; id <= 9; id++) {
    const position = cameraLabelPosition(id);
    await page.mouse.click(position.x, position.y);
    await expect(page.locator('#selected-camera')).toContainText(`C${id} ·`);
    await expect(page.locator('#routing-camera')).toHaveValue(String(id));
  }
});
