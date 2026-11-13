import { expect, test } from '@playwright/test';
import { clickPanel } from './panelProjection';

test('directs independent selections to one, two or three screens through the visible controls', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await expect(page.getByRole('status')).toContainText('Prêt à explorer');
  for (const id of [1, 2, 3]) await expect(page.locator(`#route-${id}`)).toHaveText(`Écran ${id} ← C1`);
  await clickPanel(page, 'camera-4');
  await expect(page.locator('#route-1')).toHaveText('Écran 1 ← C1');
  await clickPanel(page, 'broadcast');
  await expect(page.locator('#route-1')).toHaveText('Écran 1 ← C4');
  await clickPanel(page, 'screen-1');
  await clickPanel(page, 'broadcast');
  await expect(page.locator('#panel-message')).toContainText('au moins');
  await clickPanel(page, 'screen-2'); await clickPanel(page, 'screen-3');
  await clickPanel(page, 'camera-7'); await clickPanel(page, 'broadcast');
  await expect(page.locator('#route-2')).toHaveText('Écran 2 ← C7');
  await expect(page.locator('#route-3')).toHaveText('Écran 3 ← C7');
  await expect(page.locator('#route-1')).toHaveText('Écran 1 ← C4');
  await clickPanel(page, 'screen-3'); await clickPanel(page, 'camera-5'); await clickPanel(page, 'broadcast');
  await expect(page.locator('#route-2')).toHaveText('Écran 2 ← C5');
  await expect(page.locator('#panel-message')).toHaveAttribute('data-state', 'ready');
  await clickPanel(page, 'screen-2'); await clickPanel(page, 'screen-1');
  await clickPanel(page, 'camera-2'); await clickPanel(page, 'broadcast');
  await expect(page.locator('#route-1')).toHaveText('Écran 1 ← C2');
  await clickPanel(page, 'screen-1'); await clickPanel(page, 'screen-3');
  await clickPanel(page, 'camera-9'); await clickPanel(page, 'broadcast');
  await expect(page.locator('#route-3')).toHaveText('Écran 3 ← C9');
  await page.screenshot({ path: 'test-results/t06-three-sources.png' });
  await clickPanel(page, 'all'); await clickPanel(page, 'all');
  await clickPanel(page, 'camera-8'); await clickPanel(page, 'broadcast');
  for (const id of [1, 2, 3]) await expect(page.locator(`#route-${id}`)).toHaveText(`Écran ${id} ← C8`);
  expect(errors).toEqual([]);
});

test('retains initialized images until a grouped cut is ready and shares the moving source', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/tests/e2e/fixtures/routing.html?delay');
  const body = page.locator('body');
  await expect(body).toHaveAttribute('data-routes', '{"1":1,"2":1,"3":1}');
  await expect(body).toHaveAttribute('data-active', '1');
  await page.locator('#three').click();
  await expect(body).toHaveAttribute('data-routes', '{"1":1,"2":4,"3":7}');
  await expect(body).toHaveAttribute('data-active', '3');
  await page.locator('#measure').click(); await expect(body).toHaveAttribute('data-measure', '1');
  const oldHashes = await body.getAttribute('data-hashes');
  expect(new Set(JSON.parse(oldHashes!) as string[]).size).toBe(3);
  const previous = await body.getAttribute('data-textures');
  await page.locator('#c8').click();
  await expect(body).toHaveAttribute('data-pending', '8');
  await expect(body).toHaveAttribute('data-allocated', '4');
  await expect(body).toHaveAttribute('data-textures', previous!);
  await expect(body).toHaveAttribute('data-valid', 'true');
  await page.locator('#measure').click(); await expect(body).toHaveAttribute('data-measure', '2');
  await expect(body).toHaveAttribute('data-hashes', oldHashes!);
  await page.locator('#release').click();
  await expect(body).toHaveAttribute('data-routes', '{"1":8,"2":8,"3":8}');
  await expect(body).toHaveAttribute('data-active', '1');
  await page.locator('#measure').click(); await expect(body).toHaveAttribute('data-measure', '3');
  const hashes = JSON.parse((await body.getAttribute('data-hashes'))!) as string[];
  expect(new Set(hashes).size).toBe(1);
  await page.locator('#move').click();
  await expect(async () => {
    const count = Number(await body.getAttribute('data-measure'));
    await page.locator('#measure').click(); await expect(body).toHaveAttribute('data-measure', String(count + 1));
    const changed = JSON.parse((await body.getAttribute('data-hashes'))!) as string[];
    expect(changed[0]).not.toBe(hashes[0]); expect(new Set(changed).size).toBe(1);
  }).toPass();
  await expect(body).toHaveAttribute('data-max-active', '3');
  await expect(body).toHaveAttribute('data-observer', 'true');
  await page.locator('#stop').click(); await expect(body).toHaveAttribute('data-stopped', '0');
  expect(errors).toEqual([]);
});

for (const startup of [false, true]) {
  test(`recovers from an unavailable source ${startup ? 'on startup' : 'during a cut'}`, async ({ page }) => {
    await page.goto(`/tests/e2e/fixtures/routing.html?failure${startup ? '&startup' : ''}`);
    const body = page.locator('body');
    if (!startup) {
      await expect(body).toHaveAttribute('data-routes', '{"1":1,"2":1,"3":1}');
      await page.locator('#three').click();
      await expect(body).toHaveAttribute('data-routes', '{"1":1,"2":4,"3":7}');
      const textures = await body.getAttribute('data-textures');
      await page.locator('#c8').click();
      await expect(body).toHaveAttribute('data-error', /diffusion précédente/);
      await expect(body).toHaveAttribute('data-textures', textures!);
      await expect(body).toHaveAttribute('data-active', '3');
    } else {
      await expect(body).toHaveAttribute('data-error', /sans signal/);
      await expect(body).toHaveAttribute('data-routes', '{"1":null,"2":null,"3":null}');
      await expect(body).toHaveAttribute('data-textures', /no-signal.*no-signal.*no-signal/);
      await expect(body).toHaveAttribute('data-active', '0');
    }
    await page.locator('#release').click(); await page.locator('#c8').click();
    await expect(body).toHaveAttribute('data-routes', '{"1":8,"2":8,"3":8}');
    await expect(body).toHaveAttribute('data-error', '');
    await expect(body).toHaveAttribute('data-active', '1');
    await expect(body).toHaveAttribute('data-valid', 'true');
  });
}
