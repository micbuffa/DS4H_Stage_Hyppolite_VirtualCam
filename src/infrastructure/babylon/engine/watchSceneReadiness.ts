import type { Scene } from '@babylonjs/core/scene';

/** Resolve only after a complete ready frame; reject GPU errors instead of announcing success. */
export function watchSceneReadiness(scene: Scene) {
  const engine = scene.getEngine();
  let finish: (() => void) | undefined;
  let fail: ((reason: Error) => void) | undefined;
  const ready = new Promise<void>((resolve, reject) => { finish = resolve; fail = reject; });
  const cleanup = () => {
    scene.onAfterRenderObservable.remove(renderObserver);
    engine.onEffectErrorObservable.remove(errorObserver);
    scene.onDisposeObservable.remove(disposeObserver);
  };
  const complete = (error?: Error) => {
    if (!finish) return;
    const resolve = finish;
    const reject = fail!;
    finish = undefined;
    cleanup();
    if (error) reject(error); else resolve();
  };
  const renderObserver = scene.onAfterRenderObservable.add(() => {
    if (scene.isReady(true)) complete();
  });
  const errorObserver = engine.onEffectErrorObservable.add(({ errors }) => {
    complete(new Error(`Préparation du shader impossible : ${errors}`));
  });
  const disposeObserver = scene.onDisposeObservable.add(() => complete(new Error('Préparation du rendu annulée.')));
  return { ready, dispose: () => complete(new Error('Préparation du rendu annulée.')) };
}
