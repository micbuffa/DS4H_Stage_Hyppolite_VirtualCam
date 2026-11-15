import type { Scene } from '@babylonjs/core/scene';
import type { TransitionDriver, TransitionCompositionPort } from '../../../application/ports/transition';
import type { FeedRouter } from '../../../application/commands/feedRouter';
import { TransitionCancelledError } from '../../../application/commands/abortable';
import { availableTransitionModes } from '../../../domain/direction/basicTransitions';

/** Visibility events are sampled even when the scene's render loop is suspended. */
export function createTransitionDriver<T>(scene: Scene, document: Document, router: FeedRouter<T>, composition: TransitionCompositionPort<T>, travel?: TransitionCompositionPort<T>): TransitionDriver {
  let clockStarted = false, hiddenAt: number | undefined, hiddenMs = 0;
  const ensureClock = () => {
    if (clockStarted) return;
    clockStarted = true;
    const updateClock = () => {
      const now = document.defaultView!.performance.now();
      if (document.hidden && hiddenAt === undefined) hiddenAt = now;
      else if (!document.hidden && hiddenAt !== undefined) { hiddenMs += now - hiddenAt; hiddenAt = undefined; }
    };
    updateClock();
    // This listener also runs while an async draw/presentation is awaiting its frame.
    document.addEventListener('visibilitychange', updateClock);
    scene.onDisposeObservable.addOnce(() => document.removeEventListener('visibilitychange', updateClock));
  };
  const sample = () => {
    if (scene.isDisposed) throw new TransitionCancelledError();
    ensureClock(); const now = document.defaultView!.performance.now();
    return { nowMs: now - hiddenMs - (hiddenAt === undefined ? 0 : now - hiddenAt), visible: !document.hidden };
  };
  return {
    supportedModes: availableTransitionModes.filter((mode) => mode !== 'virtual-travel' || !!travel),
    prepare: (plan, signal) => plan.settings.mode === 'virtual-travel'
      ? travel ? router.prepareTransition(plan, travel, signal) : Promise.reject(new Error('Adaptateur de trajet indisponible.'))
      : router.prepareTransition(plan, composition, signal),
    sample,
    nextSample: (signal) => {
      if (signal.aborted || scene.isDisposed) return Promise.reject(new TransitionCancelledError());
      ensureClock(); return new Promise((resolve, reject) => {
      const cleanup = () => {
        scene.onAfterRenderObservable.remove(frame);
        scene.onDisposeObservable.remove(stopped);
        document.removeEventListener('visibilitychange', update);
        signal.removeEventListener('abort', abort);
      };
      const update = () => { cleanup(); resolve(sample()); };
      const abort = () => { cleanup(); reject(new TransitionCancelledError()); };
      const frame = scene.onAfterRenderObservable.add(update);
      const stopped = scene.onDisposeObservable.add(abort);
      document.addEventListener('visibilitychange', update);
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
      });
    },
  };
}
