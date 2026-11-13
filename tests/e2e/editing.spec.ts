import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function locate(page: Page, axis: string) {
  const body = page.locator('body');
  const count = Number(await body.getAttribute('data-located'));
  await page.locator('#locate').click();
  await expect(body).toHaveAttribute('data-located', String(count + 1));
  const handles = JSON.parse((await body.getAttribute('data-handles'))!) as Record<string, { x: number; y: number }>;
  expect(handles[axis]).toBeDefined();
  return handles[axis];
}
async function begin(page: Page, axis = 'x') {
  const point = await locate(page, axis);
  await page.mouse.move(point.x, point.y); await page.mouse.down();
  await expect(page.locator('body')).toHaveAttribute('data-dragging', 'true');
  await page.mouse.move(point.x + 32, point.y - 25, { steps: 10 });
}

test('drags world axes and local rotation with observation locked, and updates every shared screen', async ({ page }) => {
  test.setTimeout(60_000); // Six real GPU-driven gestures plus pixel reads under parallel SwiftShader load.
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/tests/e2e/fixtures/editing.html');
  await expect(page.getByRole('status')).toHaveText('Prêt à explorer');
  const body = page.locator('body');
  const originalObserver = await body.getAttribute('data-observer');
  await page.locator('#measure').click(); await expect(body).toHaveAttribute('data-measure', '1');
  const originalHashes = await body.getAttribute('data-hashes');
  await page.locator('#edit-move').click();
  for (const [index, axis] of ['x', 'y', 'z'].entries()) {
    const before = JSON.parse((await body.getAttribute('data-camera'))!) as { pose: { position: number[] } };
    await begin(page, axis);
    if (index === 0) {
      await page.keyboard.down('z'); await page.mouse.wheel(0, -100); await page.keyboard.up('z');
    }
    await page.mouse.up();
    await expect(body).toHaveAttribute('data-dragging', 'false');
    const after = JSON.parse((await body.getAttribute('data-camera'))!) as { pose: { position: number[] } };
    expect(Math.abs(after.pose.position[index] - before.pose.position[index])).toBeGreaterThan(0.01);
    for (const other of [0, 1, 2].filter((value) => value !== index)) expect(after.pose.position[other]).toBeCloseTo(before.pose.position[other], 4);
    await expect(body).toHaveAttribute('data-observer', originalObserver!);
  }
  await page.locator('#edit-rotate').click();
  for (const axis of ['x', 'y', 'z']) {
    const beforeRotation = JSON.parse((await body.getAttribute('data-camera'))!) as { pose: { position: number[]; rotation: number[] } };
    await begin(page, axis); await page.mouse.up();
    const afterRotation = JSON.parse((await body.getAttribute('data-camera'))!) as typeof beforeRotation;
    expect(afterRotation.pose.rotation).not.toEqual(beforeRotation.pose.rotation);
    expect(afterRotation.pose.position).toEqual(beforeRotation.pose.position);
    await expect(body).toHaveAttribute('data-observer', originalObserver!);
  }
  await page.locator('#measure').click(); await expect(body).toHaveAttribute('data-measure', '2');
  const editedHashes = await body.getAttribute('data-hashes');
  expect(editedHashes).not.toBe(originalHashes);
  await page.locator('#fov-plus').click(); await expect(page.locator('#selected-camera')).toContainText('53°');
  await page.locator('#measure').click(); await expect(body).toHaveAttribute('data-measure', '3');
  const hashes = JSON.parse((await body.getAttribute('data-hashes'))!) as string[];
  expect(new Set(hashes).size).toBe(1); expect(await body.getAttribute('data-hashes')).not.toBe(editedHashes);
  const withHelpers = await body.getAttribute('data-hashes');
  await page.keyboard.press('Escape'); await page.locator('#camera-aids').click();
  await page.locator('#measure').click(); await expect(body).toHaveAttribute('data-measure', '4');
  await expect(body).toHaveAttribute('data-hashes', withHelpers!);
  await expect(body).toHaveAttribute('data-routes', '{"1":1,"2":1,"3":1}');
  await page.screenshot({ path: 'test-results/t07-editing.png' });
  await page.locator('#aim-stage').click();
  await page.locator('#reset-camera').click();
  await expect(page.locator('#selected-camera')).toContainText('48°');
  await expect(body).toHaveAttribute('data-routes', '{"1":1,"2":1,"3":1}');
  expect(errors).toEqual([]);
});

for (const reason of ['Escape', 'blur', 'canvas-blur', 'pointercancel', 'lostpointercapture']) {
  test(`cancels a mouse gesture on ${reason} and restores navigation`, async ({ page }) => {
    await page.goto('/tests/e2e/fixtures/editing.html');
    await expect(page.getByRole('status')).toHaveText('Prêt à explorer');
    const body = page.locator('body');
    const original = await body.getAttribute('data-camera');
    const observer = await body.getAttribute('data-observer');
    await page.locator('#edit-move').click();
    await begin(page);
    expect(await body.getAttribute('data-camera')).not.toBe(original);
    if (reason === 'Escape') await page.keyboard.press('Escape');
    else if (reason === 'canvas-blur') await page.locator('canvas').evaluate((element) => element.blur());
    else if (reason === 'blur') await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    else await page.locator('canvas').dispatchEvent(reason, { pointerId: 1, pointerType: 'mouse' });
    await expect(body).toHaveAttribute('data-dragging', 'false');
    await expect(body).toHaveAttribute('data-camera', original!);
    await page.mouse.up();
    await expect(body).toHaveAttribute('data-observer', observer!);
    await page.keyboard.press('Escape'); await expect(body).toHaveAttribute('data-mode', 'null');
    await page.mouse.move(800, 420); await page.mouse.down();
    await page.mouse.move(850, 450, { steps: 12 }); await page.mouse.up();
    await expect(body).not.toHaveAttribute('data-observer', observer!);
  });
}

test('moves and turns C4 during pause, then changes the framing of C8 on all screens', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/tests/e2e/fixtures/editing.html');
  await expect(page.getByRole('status')).toHaveText('Prêt à explorer');
  const body = page.locator('body');
  const measure = async () => {
    const previous = await body.getAttribute('data-measure');
    await page.locator('#measure').click();
    await expect.poll(() => body.getAttribute('data-measure')).not.toBe(previous);
    return JSON.parse((await body.getAttribute('data-hashes'))!) as string[];
  };
  await page.locator('#routing-camera').selectOption('4');
  await page.locator('#broadcast').click();
  await expect(body).toHaveAttribute('data-routes', '{"1":4,"2":1,"3":1}');
  const before = await measure();
  const observer = await body.getAttribute('data-observer');
  await page.locator('#edit-move').click();
  await begin(page);
  await page.mouse.up();
  await expect(body).toHaveAttribute('data-dragging', 'false');
  const translated = await measure();
  expect(translated[0]).not.toBe(before[0]);
  expect(translated.slice(1)).toEqual(before.slice(1));
  await page.locator('#edit-rotate').click();
  await begin(page, 'y');
  await page.mouse.up();
  await expect(body).toHaveAttribute('data-dragging', 'false');
  const turned = await measure();
  expect(turned[0]).not.toBe(translated[0]);
  expect(turned.slice(1)).toEqual(before.slice(1));
  await expect(body).toHaveAttribute('data-observer', observer!);

  await page.locator('#routing-camera').selectOption('8');
  await page.locator('#all-screens').click();
  await page.locator('#broadcast').click();
  await expect(body).toHaveAttribute('data-routes', '{"1":8,"2":8,"3":8}');
  const shared = await measure();
  expect(new Set(shared).size).toBe(1);
  await page.locator('#fov-minus').click();
  const reframed = await measure();
  expect(new Set(reframed).size).toBe(1);
  expect(reframed[0]).not.toBe(shared[0]);
});
