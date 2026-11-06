import { describe, expect, it, vi } from 'vitest';
import { createApplication } from '../../src/app/createApplication';
import { effectivePixelRatio } from '../../src/app/config';
import type { ApplicationHost } from '../../src/application/ports/renderRuntime';

function setup() {
  const resizeListeners = new Set<() => void>();
  const exitListeners = new Set<() => void>();
  const runtime = { start: vi.fn(), whenReady: vi.fn().mockResolvedValue(undefined), resize: vi.fn(), dispose: vi.fn() };
  const host: ApplicationHost = {
    pixelRatio: () => 3,
    subscribeResize(callback) { resizeListeners.add(callback); return () => { resizeListeners.delete(callback); }; },
    subscribeExit(callback) { exitListeners.add(callback); return () => { exitListeners.delete(callback); }; },
  };
  return { runtime, host, resizeListeners, exitListeners };
}

describe('application lifecycle', () => {
  it.each([0, -1, NaN, Infinity, 2.1])('rejects invalid configuration %s before allocating resources', (maxPixelRatio) => {
    const factory = vi.fn();
    expect(() => createApplication(factory, setup().host, { maxPixelRatio })).toThrow('ratio');
    expect(factory).not.toHaveBeenCalled();
  });

  it('reports engine initialization failure with its original cause', () => {
    const cause = new Error('GPU unavailable');
    const { host, resizeListeners, exitListeners } = setup();
    expect(() => createApplication(() => { throw cause; }, host)).toThrow(expect.objectContaining({ cause, message: expect.stringContaining('WebGL2') }));
    expect(resizeListeners.size + exitListeners.size).toBe(0);
  });

  it('resizes once initially and once per event, capping the pixel ratio', () => {
    const s = setup();
    const app = createApplication(() => s.runtime, s.host);
    expect(s.runtime.start).toHaveBeenCalledOnce();
    expect(s.runtime.resize).toHaveBeenCalledExactlyOnceWith(1.5);
    s.resizeListeners.forEach((callback) => callback());
    expect(s.runtime.resize).toHaveBeenCalledTimes(2);
    app.dispose();
  });

  it('stops once and removes subscriptions on exit', () => {
    const s = setup();
    const app = createApplication(() => s.runtime, s.host);
    const lateResize = [...s.resizeListeners][0];
    s.exitListeners.forEach((callback) => callback());
    app.dispose();
    lateResize();
    expect(s.runtime.dispose).toHaveBeenCalledOnce();
    expect(s.resizeListeners.size + s.exitListeners.size).toBe(0);
    expect(s.runtime.resize).toHaveBeenCalledOnce();
  });

  it('cleans up a runtime and subscriptions if startup fails', () => {
    const s = setup();
    s.runtime.start.mockImplementation(() => { throw new Error('render failed'); });
    expect(() => createApplication(() => s.runtime, s.host)).toThrow('Impossible');
    expect(s.runtime.dispose).toHaveBeenCalledOnce();
    expect(s.resizeListeners.size + s.exitListeners.size).toBe(0);
  });

  it('unsubscribes earlier handlers if a later subscription fails', () => {
    const s = setup();
    s.host.subscribeExit = () => { throw new Error('subscription failed'); };
    expect(() => createApplication(() => s.runtime, s.host)).toThrow('Impossible');
    expect(s.resizeListeners.size).toBe(0);
    expect(s.runtime.dispose).toHaveBeenCalledOnce();
  });

  it.each([[NaN, 1], [0, 1], [1.25, 1.25], [3, 1.5]])('normalizes device ratio %s', (input, expected) => {
    expect(effectivePixelRatio(input, 1.5)).toBe(expected);
  });
});

it('waits for asynchronous rendering readiness and cleans up if shader loading fails', async () => {
  const s = setup();
  let rejectReady!: (error: Error) => void;
  const pending = new Promise<void>((_, reject) => { rejectReady = reject; });
  s.runtime.whenReady.mockReturnValue(pending);
  const app = createApplication(() => s.runtime, s.host);
  const cause = new Error('Failed to fetch dynamically imported shader');
  const result = expect(app.ready).rejects.toThrow(expect.objectContaining({ cause, message: expect.stringContaining('préparer le rendu') }));
  rejectReady(cause);
  await result;
  expect(s.runtime.dispose).toHaveBeenCalledOnce();
  expect(s.resizeListeners.size + s.exitListeners.size).toBe(0);
});
