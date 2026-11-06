import { test, expect } from '@playwright/test';
import { createServer, resolveConfig } from 'vite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

// Reproduce the real failure: a second optimizer changes its shader chunks while
// a development page still holds URLs from the first optimizer generation.
test('keeps development shaders available while a test server reoptimizes dependencies', async ({ browser }) => {
  test.setTimeout(60000);
  const temporary = await mkdtemp(join(tmpdir(), 'virtual-cameras-cache-'));
  const devConfig = await resolveConfig({ mode: 'development' }, 'serve');
  const testConfig = await resolveConfig({ mode: 'e2e' }, 'serve');
  expect(devConfig.cacheDir).not.toBe(testConfig.cacheDir);
  const development = await createServer({
    mode: 'development', cacheDir: join(temporary, basename(devConfig.cacheDir)),
    server: { host: '127.0.0.1', port: 0, hmr: false }, logLevel: 'error',
  });
  const companion = await createServer({
    mode: 'e2e', cacheDir: join(temporary, basename(testConfig.cacheDir)),
    optimizeDeps: { include: ['@babylonjs/core/Debug/axesViewer'], force: true },
    server: { host: '127.0.0.1', port: 0, hmr: false }, logLevel: 'error',
  });
  const page = await browser.newPage();
  const companionPage = await browser.newPage();
  try {
    await development.listen();
    const shaderUrls = new Set<string>();
    const errors: string[] = [];
    page.on('response', (response) => {
      if (/\/default\.(vertex|fragment)[^/]*\.js(?:\?|$)/.test(response.url())) shaderUrls.add(response.url());
    });
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(development.resolvedUrls!.local[0]);
    await expect(page.getByRole('status')).toContainText('Prêt à explorer');
    expect(shaderUrls.size).toBeGreaterThanOrEqual(2);
    await companion.listen();
    await companionPage.goto(companion.resolvedUrls!.local[0]);
    await expect(companionPage.getByRole('status')).toContainText('Prêt à explorer');
    // Bypass the browser's immutable cache: the original URLs must still be served.
    for (const url of shaderUrls) {
      const response = await page.request.get(url, { headers: { 'Cache-Control': 'no-cache' } });
      expect(response.status(), url).toBe(200);
      expect(response.headers()['content-type']).toContain('javascript');
    }
    await page.reload();
    await expect(page.getByRole('status')).toContainText('Prêt à explorer');
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await companionPage.close();
    await companion.close();
    await development.close();
    await rm(temporary, { recursive: true, force: true });
  }
});
