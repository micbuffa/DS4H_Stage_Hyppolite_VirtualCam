import { expect, test } from '@playwright/test';
import { clickPanel, panelButtonPosition } from './panelProjection';
import { cameraLabelPosition } from './cameraProjection';

test('directs the concert using physical panel buttons, with no orbit or duplicate command', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/'); await expect(page.getByRole('status')).toContainText('Prêt à explorer');
  await page.screenshot({ path: 'test-results/t08-initial.png' });
  await clickPanel(page, 'pause');
  await expect(page.locator('#panel-message')).toContainText('Concert en pause');
  await clickPanel(page, 'camera-4'); await expect(page.locator('#selected-camera')).toContainText('C4');
  await expect(page.locator('#feed-status')).toContainText('Écran 1 ← C1');
  await clickPanel(page, 'broadcast'); await expect(page.locator('#feed-status')).toContainText('Écran 1 ← C4');
  await clickPanel(page, 'fov-plus'); await expect(page.locator('#selected-camera')).toContainText('39°');
  await clickPanel(page, 'fov-minus'); await expect(page.locator('#selected-camera')).toContainText('34°');
  await clickPanel(page, 'move'); await expect(page.locator('#panel-message')).toContainText('Déplacement monde');
  await clickPanel(page, 'rotate'); await expect(page.locator('#panel-message')).toContainText('Rotation locale');
  await clickPanel(page, 'aim'); await clickPanel(page, 'reset');
  await clickPanel(page, 'help'); await expect(page.locator('#help-text')).toBeVisible();
  await clickPanel(page, 'help'); await expect(page.locator('#help-text')).toBeHidden();
  for (let id = 1; id <= 9; id++) {
    await clickPanel(page, `camera-${id}`); await expect(page.locator('#selected-camera')).toContainText(`C${id}`);
  }
  const label = cameraLabelPosition(2); await page.mouse.click(label.x, label.y);
  await expect(page.locator('#selected-camera')).toContainText('C2');
  await clickPanel(page, 'all'); await clickPanel(page, 'camera-8'); await clickPanel(page, 'broadcast');
  await expect(page.locator('#feed-status')).toHaveText('Écran 1 ← C8 · Écran 2 ← C8 · Écran 3 ← C8');
  await page.screenshot({ path: 'test-results/t08-panel.png' });
  const stageClip = { x: 405, y: 210, width: 470, height: 34 };
  const stageBefore = await page.screenshot({ clip: stageClip });
  const point = panelButtonPosition('camera-4');
  await page.mouse.move(point.x, point.y); await page.mouse.down();
  await page.mouse.move(point.x + 80, point.y - 20, { steps: 8 }); await page.mouse.up();
  await expect(page.locator('#selected-camera')).toContainText('C8');
  expect((await page.screenshot({ clip: stageClip })).equals(stageBefore)).toBe(true);
  await clickPanel(page, 'pause');
  await expect(page.locator('#panel-message')).not.toContainText('Concert en pause');
  expect(errors).toEqual([]);
});


test('excludes the spatial panel from each of three distinct GPU feeds', async ({ page }) => {
  await page.goto('/tests/e2e/fixtures/routing.html?panel');
  const body = page.locator('body');
  await expect(body).toHaveAttribute('data-routes', '{"1":1,"2":1,"3":1}');
  await page.locator('#three').click();
  await expect(body).toHaveAttribute('data-routes', '{"1":1,"2":4,"3":7}');
  await page.locator('#measure').click();
  await expect(body).toHaveAttribute('data-measure', '1');
  const excluded = JSON.parse((await body.getAttribute('data-hashes'))!) as string[];
  expect(new Set(excluded).size).toBe(3);
  // Positive control: temporarily allow the panel into the three framed views.
  await page.locator('#film-panel').click();
  await expect(body).toHaveAttribute('data-panel-filmable', 'true');
  await page.locator('#measure').click();
  await expect(body).toHaveAttribute('data-measure', '2');
  const included = JSON.parse((await body.getAttribute('data-hashes'))!) as string[];
  expect(included.every((hash, index) => hash !== excluded[index])).toBe(true);
});
