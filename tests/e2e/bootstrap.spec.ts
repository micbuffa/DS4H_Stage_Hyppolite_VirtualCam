import { expect, test } from '@playwright/test';

test('renders WebGL2, orbits and resizes without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await expect(page.getByRole('status')).toContainText('Prêt à explorer');
  await page.waitForLoadState('networkidle');
  const canvas = page.getByLabel('Vue 3D navigable du laboratoire');
  await expect(canvas).toBeVisible();
  await expect(canvas).toBeFocused();
  await expect(canvas).toHaveScreenshot('stage-and-test-patterns.png', { maxDiffPixelRatio: 0.005 });
  await page.screenshot({ path: 'test-results/t02-initial.png' });
  const before = await canvas.screenshot();
  await page.mouse.move(650, 360);
  await page.mouse.down();
  await page.mouse.move(820, 410, { steps: 15 });
  await page.mouse.up();
  await expect(async () => { expect((await canvas.screenshot()).equals(before)).toBe(false); }).toPass();
  await page.setViewportSize({ width: 960, height: 600 });
  await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => [element.width, element.height])).toEqual([960, 600]);
  await page.screenshot({ path: 'test-results/t02-orbit.png' });
  expect(errors).toEqual([]);
});

test('reports unavailable WebGL without an uncaught exception', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
      if (String(args[0]).includes('webgl')) return null;
      return original.apply(this, args);
    } as typeof original;
  });
  await page.goto('/');
  await expect(page.getByRole('status')).toContainText('Impossible de démarrer');
});

for (const key of ['z', 'q', 's', 'd', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']) {
  test(`translates the view using ${key}`, async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('status')).toContainText('Prêt à explorer');
  await page.waitForLoadState('networkidle');
    const canvas = page.getByLabel('Vue 3D navigable du laboratoire');
    await canvas.focus();
    const before = await canvas.screenshot();
    await page.keyboard.down(key);
    await expect(async () => { expect((await canvas.screenshot()).equals(before)).toBe(false); }).toPass();
    await page.keyboard.up(key);
    const stopped = await canvas.screenshot();
    // No inertia for keyboard translation; the view remains stable after release.
    expect((await canvas.screenshot()).equals(stopped)).toBe(true);
  });
}

test('zooms with wheel and small two-finger trackpad-style deltas, without scrolling the page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('status')).toContainText('Prêt à explorer');
  await page.waitForLoadState('networkidle');
  const canvas = page.getByLabel('Vue 3D navigable du laboratoire');
  await page.mouse.move(640, 360);
  const before = await canvas.screenshot();
  await page.mouse.wheel(0, -180);
  await expect(async () => { expect((await canvas.screenshot()).equals(before)).toBe(false); }).toPass();
  // Reload to eliminate wheel inertia before testing the small pixel deltas from a trackpad.
  await page.reload();
  await expect(page.getByRole('status')).toContainText('Prêt à explorer');
  await page.waitForLoadState('networkidle');
  const trackpadBefore = await canvas.screenshot();
  for (let i = 0; i < 12; i++) await canvas.dispatchEvent('wheel', { deltaY: -3, deltaMode: 0, bubbles: true, cancelable: true });
  await expect(async () => { expect((await canvas.screenshot()).equals(trackpadBefore)).toBe(false); }).toPass();
  await page.reload();
  await expect(page.getByRole('status')).toContainText('Prêt à explorer');
  await page.waitForLoadState('networkidle');
  const pinchBefore = await canvas.screenshot();
  await canvas.dispatchEvent('wheel', { deltaY: -60, deltaMode: 0, ctrlKey: true, bubbles: true, cancelable: true });
  await expect(async () => { expect((await canvas.screenshot()).equals(pinchBefore)).toBe(false); }).toPass();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});
