import { expect, test } from '@playwright/test';

test('reports an asynchronous shader download failure instead of announcing readiness', async ({ page }) => {
  await page.route(/\/default\.(vertex|fragment)[^/]*\.js(?:\?|$)/, (route) => route.abort('failed'));
  await page.goto('/');
  const status = page.getByRole('status');
  await expect(status).toHaveAttribute('data-state', 'error');
  await expect(status).toContainText('Impossible de préparer le rendu');
  await expect(status).not.toContainText('Prêt à explorer');
});
