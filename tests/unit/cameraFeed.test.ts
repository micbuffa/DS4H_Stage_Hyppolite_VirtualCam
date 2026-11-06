import { expect, it, vi } from 'vitest';
import { isFilmable, defaultFeedSize, validateFeedSize } from '../../src/domain/rendering/cameraFeed';
import { bindPreparedFeed } from '../../src/application/commands/bindPreparedFeed';

it('accepts only explicit concert meshes and excludes all video surfaces and editing aids', () => {
  for (const theme of ['stage', 'musicians', 'instruments', 'audience', 'lighting', 'screens']) expect(isFilmable({ category: 'concert', theme })).toBe(true);
  for (const category of ['video-surface', 'camera-helper', 'panel', 'frustum', 'gizmo', undefined]) expect(isFilmable({ category })).toBe(false);
  expect(isFilmable(null)).toBe(false);
  expect(isFilmable('concert')).toBe(false);
  expect(isFilmable(undefined)).toBe(false);
});
it('defines 1024x576 and a strictly validated 16:9 render target', () => {
  expect(defaultFeedSize).toEqual({ width: 1024, height: 576 });
  expect(() => validateFeedSize(defaultFeedSize)).not.toThrow();
  expect(() => validateFeedSize({ width: 512, height: 288 })).not.toThrow();
});
it.each([{ width: 0, height: 0 }, { width: NaN, height: 576 }, { width: 1000, height: 1000 }, { width: 8192, height: 4608 }, { width: 1024.5, height: 576 }])('refuses invalid target size %j', (size) => {
  expect(() => validateFeedSize(size)).toThrow('16:9');
});

function fixture() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const pending = new Promise<void>((ok, fail) => { resolve = ok; reject = fail; });
  const previous = { name: 'test-pattern' };
  const texture = { name: 'C1-live' };
  let current = previous;
  const screen = { getTexture: () => current, setTexture: vi.fn((value) => { current = value; }) };
  const feed = { texture, ready: pending, dispose: vi.fn() };
  const binding = bindPreparedFeed(feed, screen);
  return { feed, binding, screen, previous, resolve, reject };
}
it('keeps the test pattern until a valid image, then binds without destroying the old texture', async () => {
  const f = fixture();
  expect(f.screen.getTexture()).toBe(f.previous);
  expect(f.screen.setTexture).not.toHaveBeenCalled();
  f.resolve(); await f.binding.ready;
  expect(f.screen.getTexture()).toBe(f.feed.texture);
  expect(f.feed.dispose).not.toHaveBeenCalled();
  f.binding.dispose(); f.binding.dispose();
  expect(f.screen.getTexture()).toBe(f.previous);
  expect(f.feed.dispose).toHaveBeenCalledOnce();
});
it('preserves the previous image on preparation failure and propagates the cause', async () => {
  const f = fixture();
  const failure = new Error('shader unavailable');
  const result = expect(f.binding.ready).rejects.toBe(failure);
  f.reject(failure); await result;
  expect(f.screen.getTexture()).toBe(f.previous);
  expect(f.screen.setTexture).not.toHaveBeenCalled();
  expect(f.feed.dispose).toHaveBeenCalledOnce();
});
it('does not bind a late image after disposal', async () => {
  const f = fixture();
  f.binding.dispose(); f.resolve(); await f.binding.ready;
  expect(f.screen.setTexture).not.toHaveBeenCalled();
  expect(f.feed.dispose).toHaveBeenCalledOnce();
});
it('does not overwrite a newer screen assignment when its old binding is released', async () => {
  const f = fixture();
  f.resolve(); await f.binding.ready;
  const newer = { name: 'another-source' };
  f.screen.setTexture(newer); f.binding.dispose();
  expect(f.screen.getTexture()).toBe(newer);
});
