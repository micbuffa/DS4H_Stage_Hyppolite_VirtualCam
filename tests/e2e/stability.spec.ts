import { expect, test } from '@playwright/test';
import { clickPanel } from './panelProjection';

test('changes quality through the help panel and retains all assignments', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('status')).toContainText('Prêt à explorer');
  await clickPanel(page, 'camera-9');
  await clickPanel(page, 'broadcast');
  const routes = 'Écran 1 ← C9 · Écran 2 ← C1 · Écran 3 ← C1';
  await expect(page.locator('#feed-status')).toHaveText(routes);
  await page.getByRole('button', { name: 'Aide', exact: true }).click();
  const select = page.getByLabel('Qualité vidéo');
  await select.selectOption('reduced');
  await expect(page.locator('#quality-status')).toHaveText('Qualité vidéo appliquée.');
  await expect(select).toHaveValue('reduced');
  await expect(page.locator('#feed-status')).toHaveText(routes);
});

test('releases GPU textures and observers after one hundred alternating cuts', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/tests/e2e/fixtures/routing.html?stress');
  await expect(page.locator('body')).toHaveAttribute('data-routes', '{"1":1,"2":1,"3":1}');
  const cuts = await page.evaluate(() => (window as unknown as { cycleCuts(): Promise<number> }).cycleCuts());
  expect(cuts).toBe(100);
  await expect(page.locator('body')).toHaveAttribute('data-max-active', '3');
});

test('mounts and disposes the production runtime twenty times', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/tests/e2e/fixtures/production.html');
  await page.waitForLoadState('networkidle');
  const cycles = await page.evaluate(() => (window as unknown as { cycleRuntime(times: number): Promise<number> }).cycleRuntime(20));
  expect(cycles).toBe(20);
});
