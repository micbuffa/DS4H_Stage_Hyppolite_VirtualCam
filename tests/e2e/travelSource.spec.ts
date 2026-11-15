import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

interface State {
  routes: Record<number, number>; stats: { allocated: number; active: number }; maxActive: number;
  frames: Record<string, number>; observer: boolean; registryUnchanged: boolean;
  resources: { cameras: number; nodes: number; textures: number; before: number; after: number };
  targets: { excluded: boolean; layerCheck: boolean; width: number; height: number }[];
  phase: string; progress: number; error?: string; bindings: string[];
}
interface Recipe {
  status(): State; start(): Promise<State>; pose(progress: number, reference?: number): Promise<State & { temporary: string; reference: string }>;
  cancel(): State; stopPending(): Promise<State & { result: string }>;
  startPass(targets?: number[], delayMs?: number, screenOrder?: readonly (1 | 2 | 3)[]): Promise<State>; advancePass(time: number): Promise<State>; cancelPass(): Promise<State>; failPass(time: number): Promise<State>;
  screenHashes(): Promise<string[]>;
  endpointProof(): Promise<{ maxBound: number; endpoints: { screen: number; temporary: string; reference: string; before: string; after: string | null }[] }>;
}
const call = <K extends keyof Recipe>(page: Page, method: K, ...args: Parameters<Recipe[K]>) => page.evaluate(({ method, args }) => {
  const recipe = (window as unknown as { travelSource: Recipe }).travelSource;
  return (recipe[method] as (...args: unknown[]) => unknown)(...args);
}, { method, args }) as Promise<Awaited<ReturnType<Recipe[K]>>>;

test('reuses one temporary source through a user-ordered travel sequence with partial targets and a bounded delay', async ({ page }) => {
  test.setTimeout(180000);
  await page.goto('/tests/e2e/fixtures/travel-source.html'); await expect(page.locator('body')).toHaveAttribute('data-ready', 'true', { timeout: 60000 });
  const baseline = await call(page, 'status');
  const prepared = await call(page, 'startPass', [1, 3], 1000, [2, 1, 3]); expect(prepared.stats.active).toBe(5);
  const first = await call(page, 'advancePass', 2000); expect(first.bindings).toEqual(['feed-capture-camera-4', 'feed-capture-camera-2', 'feed-capture-camera-3']); expect(first.routes).toEqual(baseline.routes);
  const gap = await call(page, 'advancePass', 2500); expect(gap.bindings).toEqual(first.bindings); expect(gap.resources).toEqual(first.resources);
  const moving = await call(page, 'advancePass', 4000); expect(moving.bindings).toEqual(['feed-capture-camera-4', 'feed-capture-camera-2', 'feed-travel-camera']); expect(moving.resources).toEqual(prepared.resources);
  const end = await call(page, 'advancePass', 5000); expect(end.phase, end.error).toBe('completed'); expect(end.routes).toEqual({ 1: 4, 2: 2, 3: 4 }); expect(end.stats).toMatchObject({ active: 2, allocated: 2 });
  expect(end.maxActive).toBe(5); expect(end.observer).toBe(true); expect(end.registryUnchanged).toBe(true);
  const proof = await call(page, 'endpointProof'); expect(proof.maxBound).toBe(1); expect(proof.endpoints.map((entry) => entry.screen)).toEqual([1, 3]);
  for (const entry of proof.endpoints) expect(entry.temporary).toBe(entry.reference);
});

test('renders temporary concert endpoints identical to the numbered sources, with five live feeds and complete cancellation cleanup', async ({ page }) => {
  test.setTimeout(180000); const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/tests/e2e/fixtures/travel-source.html'); await expect(page.locator('body')).toHaveAttribute('data-ready', 'true', { timeout: 60000 });
  const baseline = await call(page, 'status'); expect(baseline.stats).toMatchObject({ allocated: 3, active: 3 });
  const prepared = await call(page, 'start'); expect(prepared.stats).toMatchObject({ allocated: 5, active: 5 });
  expect(prepared.targets).toHaveLength(5); expect(prepared.targets.every((target) => target.excluded && target.layerCheck && target.width === 512 && target.height === 288)).toBe(true);
  const start = await call(page, 'pose', 0, 1); expect(start.temporary).toBe(start.reference);
  const middle = await call(page, 'pose', 0.5, 1); expect(middle.temporary).not.toBe(start.temporary);
  const end = await call(page, 'pose', 1, 4); expect(end.temporary).toBe(end.reference); expect(end.temporary).not.toBe(start.temporary);
  expect(end.routes).toEqual(baseline.routes); expect(end.observer).toBe(true); expect(end.registryUnchanged).toBe(true); expect(end.maxActive).toBe(5);
  for (const name of ['capture-camera-1', 'capture-camera-2', 'capture-camera-3', 'capture-camera-4', 'travel-camera']) expect(end.frames[name]).toBeGreaterThan(prepared.frames[name]);
  const cancelled = await call(page, 'cancel'); expect(cancelled.resources).toEqual(baseline.resources); expect(cancelled.stats).toMatchObject({ allocated: 3, active: 3 });
  await call(page, 'start'); const pending = await call(page, 'stopPending'); expect(pending.result).toBe('cancelled');
  expect(pending.resources).toEqual(baseline.resources); expect(pending.stats).toMatchObject({ allocated: 3, active: 3 });
  expect(pending.observer).toBe(true); expect(pending.registryUnchanged).toBe(true); expect(errors).toEqual([]);
});

test('presents sequential concert travel with exact visible handoffs, one temporary source and globally committed routes', async ({ page }) => {
  test.setTimeout(180000); const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/tests/e2e/fixtures/travel-source.html'); await expect(page.locator('body')).toHaveAttribute('data-ready', 'true', { timeout: 60000 });
  const baseline = await call(page, 'status'), original = await call(page, 'screenHashes');
  const prepared = await call(page, 'startPass'); expect(prepared.phase, prepared.error).toBe('transitioning');
  expect(prepared.stats).toMatchObject({ active: 5, allocated: 5 }); expect(prepared.routes).toEqual(baseline.routes);
  const middle = await call(page, 'advancePass', 1000); expect(middle.bindings[2]).toBe('feed-travel-camera');
  const moved = await call(page, 'screenHashes'); expect(moved[2]).not.toBe(original[2]); expect(moved.slice(0, 2)).toEqual(original.slice(0, 2));
  const first = await call(page, 'advancePass', 2000); expect(first.bindings).toEqual(['feed-capture-camera-1', 'feed-capture-camera-2', 'feed-capture-camera-4']); expect(first.routes).toEqual(baseline.routes);
  const second = await call(page, 'advancePass', 3200); expect(second.bindings).toEqual(['feed-travel-camera', 'feed-capture-camera-2', 'feed-capture-camera-4']);
  const end = await call(page, 'advancePass', 6400); expect(end.phase, end.error).toBe('completed');
  expect(end.routes).toEqual({ 1: 4, 2: 4, 3: 4 }); expect(end.stats).toMatchObject({ active: 1, allocated: 1 }); expect(end.maxActive).toBe(5);
  expect(end.observer).toBe(true); expect(end.registryUnchanged).toBe(true);
  const proof = await call(page, 'endpointProof'); expect(proof.maxBound).toBe(1); expect(proof.endpoints.map((entry) => entry.screen)).toEqual([3, 1, 2]);
  for (const entry of proof.endpoints) { expect(entry.temporary).toBe(entry.reference); expect(entry.after).toBe(entry.before); }
  expect(new Set(await call(page, 'screenHashes')).size).toBe(1); expect(errors).toEqual([]);
});

for (const outcome of ['cancel', 'error'] as const) test(`restores every concert screen and resource after a later travel ${outcome}`, async ({ page }) => {
  test.setTimeout(180000);
  await page.goto('/tests/e2e/fixtures/travel-source.html'); await expect(page.locator('body')).toHaveAttribute('data-ready', 'true', { timeout: 60000 });
  const baseline = await call(page, 'status'), original = await call(page, 'screenHashes');
  await call(page, 'startPass'); const first = await call(page, 'advancePass', 2000); expect(first.bindings[2]).toBe('feed-capture-camera-4');
  const restored = outcome === 'cancel' ? await call(page, 'advancePass', 3200).then(() => call(page, 'cancelPass')) : await call(page, 'failPass', 3200);
  expect(restored.phase).toBe(outcome === 'cancel' ? 'cancelled' : 'error'); expect(restored.routes).toEqual(baseline.routes);
  expect(restored.stats).toMatchObject({ active: 3, allocated: 3 }); expect(restored.resources).toEqual(baseline.resources);
  expect(await call(page, 'screenHashes')).toEqual(original); expect(restored.observer).toBe(true); expect(restored.registryUnchanged).toBe(true);
  // Recovery must not keep a stale reservation or an abandoned draw/presentation observer.
  await call(page, 'startPass', [1]); const recovered = await call(page, 'advancePass', 2000); expect(recovered.phase, recovered.error).toBe('completed');
  expect(recovered.routes).toEqual({ 1: 4, 2: 2, 3: 3 }); expect(recovered.stats.active).toBe(3);
});
