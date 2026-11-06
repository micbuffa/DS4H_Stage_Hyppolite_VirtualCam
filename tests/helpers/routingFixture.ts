import { vi } from 'vitest';
import type { CameraId } from '../../src/domain/cameras/cameraDefinition';
import type { ScreenId } from '../../src/domain/direction/screenRouting';
import type { RoutableFeed } from '../../src/application/ports/routing';
import { CameraRegistry } from '../../src/domain/cameras/cameraRegistry';
import { createCameraPresets } from '../../src/domain/cameras/cameraPresets';
import { FeedRouter } from '../../src/application/commands/feedRouter';
import { RoutingDirector } from '../../src/application/commands/routingDirector';

export function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const ready = new Promise<void>((ok, fail) => { resolve = ok; reject = fail; });
  return { ready, resolve, reject };
}
export interface FakeTexture { label: string }
export interface FakeFeed extends RoutableFeed<FakeTexture> {
  id: CameraId; enabled: boolean; disposed: boolean; resolve(): void; reject(error: Error): void;
}
export function routingFixture() {
  const cameras = new CameraRegistry(createCameraPresets());
  const originals = new Map<ScreenId, FakeTexture>([1, 2, 3].map((id) => [id as ScreenId, { label: `offline-${id}` }]));
  const current = new Map(originals);
  const screens = new Map([...originals].map(([id]) => [id, {
    getTexture: () => current.get(id)!, setTexture: vi.fn((texture: FakeTexture | null) => { current.set(id, texture!); }),
  }]));
  const delayed = new Set<CameraId>();
  const failures = new Set<CameraId>();
  const feeds: FakeFeed[] = [];
  let maxActive = 0;
  const record = () => { maxActive = Math.max(maxActive, feeds.filter((feed) => feed.enabled && !feed.disposed).length); };
  const createFeed = vi.fn((id: CameraId): FakeFeed => {
    if (failures.has(id)) throw new Error(`Source ${id} unavailable`);
    const pending = deferred();
    const entry: FakeFeed = {
      id, texture: { label: `C${id}` }, ready: pending.ready,
      enabled: true, disposed: false, resolve: pending.resolve, reject: pending.reject,
      setRenderingEnabled: vi.fn((enabled) => { entry.enabled = enabled; record(); }),
      dispose: vi.fn(() => { entry.disposed = true; entry.enabled = false; pending.reject(new Error('cancelled')); }),
    };
    feeds.push(entry); record();
    if (!delayed.has(id)) pending.resolve();
    return entry;
  });
  const waitForPresentation = vi.fn((): { ready: Promise<void>; dispose(): void } => ({ ready: Promise.resolve(), dispose: vi.fn() }));
  const router = new FeedRouter({ screens, createFeed, waitForPresentation });
  const director = new RoutingDirector(cameras, router);
  return { cameras, router, director, originals, current, screens, delayed, failures, feeds, createFeed, waitForPresentation, maxActive: () => maxActive };
}
