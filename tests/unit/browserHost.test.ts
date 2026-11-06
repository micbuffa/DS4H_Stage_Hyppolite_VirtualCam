import { expect, it, vi } from 'vitest';
import { createBrowserHost } from '../../src/app/browserHost';

it('removes DOM listeners and keeps a page cached by the browser alive', () => {
  const target = new EventTarget();
  const host = createBrowserHost(target as unknown as Window);
  const resize = vi.fn();
  const exit = vi.fn();
  const offResize = host.subscribeResize(resize);
  const offExit = host.subscribeExit(exit);
  target.dispatchEvent(new Event('resize'));
  const cachedExit = new Event('pagehide');
  Object.defineProperty(cachedExit, 'persisted', { value: true });
  target.dispatchEvent(cachedExit);
  expect(exit).not.toHaveBeenCalled();
  target.dispatchEvent(new Event('pagehide'));
  expect(exit).toHaveBeenCalledOnce();
  offResize();
  offExit();
  target.dispatchEvent(new Event('resize'));
  target.dispatchEvent(new Event('pagehide'));
  expect(resize).toHaveBeenCalledOnce();
  expect(exit).toHaveBeenCalledOnce();
});
