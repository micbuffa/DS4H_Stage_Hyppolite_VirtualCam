import { expect, it, vi } from 'vitest';
import { Observable } from '@babylonjs/core/Misc/observable';
import type { Scene } from '@babylonjs/core/scene';
import type { Effect } from '@babylonjs/core/Materials/effect';
import { watchSceneReadiness } from '../../src/infrastructure/babylon/engine/watchSceneReadiness';

function fixture() {
  const errors = new Observable<{ effect: Effect; errors: string }>();
  const afterRender = new Observable<Scene>();
  const afterDispose = new Observable<Scene>();
  const isReady = vi.fn(() => false);
  const scene = {
    getEngine: () => ({ onEffectErrorObservable: errors }),
    onAfterRenderObservable: afterRender,
    onDisposeObservable: afterDispose,
    isReady,
  } as unknown as Scene;
  return { scene, errors, afterRender, afterDispose, isReady };
}

it('keeps readiness pending until an actual ready frame is presented', async () => {
  const f = fixture();
  const watcher = watchSceneReadiness(f.scene);
  const ready = vi.fn();
  watcher.ready.then(ready);
  f.afterRender.notifyObservers(f.scene);
  await Promise.resolve();
  expect(ready).not.toHaveBeenCalled();
  f.isReady.mockReturnValue(true);
  f.afterRender.notifyObservers(f.scene);
  await watcher.ready;
  expect(ready).toHaveBeenCalledOnce();
  expect(f.afterRender.hasObservers()).toBe(false);
  expect(f.errors.hasObservers()).toBe(false);
  watcher.dispose(); // Completed startup is not changed by later disposal.
});

it('rejects shader preparation failures and removes its observers', async () => {
  const f = fixture();
  const watcher = watchSceneReadiness(f.scene);
  const failed = expect(watcher.ready).rejects.toThrow('module not found');
  f.errors.notifyObservers({ effect: {} as Effect, errors: 'module not found' });
  await failed;
  expect(f.afterRender.hasObservers()).toBe(false);
  expect(f.errors.hasObservers()).toBe(false);
});

it('cancels startup on disposal without leaving active observers', async () => {
  const f = fixture();
  const watcher = watchSceneReadiness(f.scene);
  const failed = expect(watcher.ready).rejects.toThrow('annulée');
  f.afterDispose.notifyObservers(f.scene);
  await failed;
  watcher.dispose();
  expect(f.afterRender.hasObservers()).toBe(false);
  expect(f.errors.hasObservers()).toBe(false);
});
