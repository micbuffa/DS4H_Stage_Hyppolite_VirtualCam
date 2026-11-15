import type { ScreenId } from '../../domain/direction/screenRouting';
import { travelPose } from '../../domain/cameras/travelPath';
import type { TransitionFrame } from '../../domain/direction/transitionPlan';
import type { ScreenTexturePort } from '../ports/cameraFeed';
import type { TransitionCompositionPort, TravelSourcePort, TravelSourceLease } from '../ports/transition';
import { abortable } from './abortable';

export interface TravelPassResources<T> {
  sources: TravelSourcePort<T>;
  surfaces: ReadonlyMap<ScreenId, ScreenTexturePort<T>>;
  waitForPresentation(): { ready: Promise<void>; dispose(): void };
}

/** One mutable source, sequential surfaces, globally reversible until final presentation. */
export function createTravelPass<T>(resources: TravelPassResources<T>): TransitionCompositionPort<T> {
  return { async prepare(plan, pairs, signal) {
    const legs = plan.travel;
    if (plan.settings.mode !== 'virtual-travel' || plan.settings.order !== 'staggered' || !legs?.length || legs.length !== plan.steps.length ||
        plan.steps.some((step, i) => legs[i].screen !== step.screen || step.from === null || !resources.surfaces.has(step.screen) || !pairs.get(step.screen)?.from)) {
      throw new Error('Plan de trajet capturé incomplet.');
    }
    if (signal.aborted) throw new Error('Trajet annulé.');
    const original = new Map(plan.steps.map((step) => [step.screen, resources.surfaces.get(step.screen)!.getTexture()]));
    const lifetime = new AbortController();
    let temporary: TravelSourceLease<T> | undefined;
    let settled = false, changed = false, busy = false, presented = false;
    let index = 0, bound = false, progress = 0, globalProgress = 0;
    let presentation: ReturnType<TravelPassResources<T>['waitForPresentation']> | undefined;
    const assertActive = () => { if (settled || lifetime.signal.aborted) throw new Error('Trajet annulé.'); };
    const dispose = () => {
      signal.removeEventListener('abort', rollback); lifetime.abort(); presentation?.dispose(); temporary?.dispose();
    };
    const rollback = () => {
      if (settled) return;
      settled = true;
      // Detach borrowed temporary pixels before their owner can destroy the RTT.
      try { if (changed) for (const [screen, texture] of original) resources.surfaces.get(screen)!.setTexture(texture); }
      finally { dispose(); }
    };
    const present = async () => {
      assertActive(); const raw = resources.waitForPresentation(); let released = false;
      const pending = { ready: raw.ready, dispose() { if (!released) { released = true; raw.dispose(); } } }; presentation = pending;
      try { await abortable(pending.ready, lifetime.signal); assertActive(); }
      finally { pending.dispose(); if (presentation === pending) presentation = undefined; }
    };
    const bind = (screen: ScreenId, texture: T) => { assertActive(); changed = true; resources.surfaces.get(screen)!.setTexture(texture); };
    const pose = async (value: number) => {
      assertActive(); temporary!.setPose(travelPose(legs[index].path, value));
      await abortable(temporary!.waitForFrame(lifetime.signal), lifetime.signal); assertActive();
    };
    const validateFrame = (frame: TransitionFrame) => {
      if (!Number.isFinite(frame.progress) || frame.progress < globalProgress || frame.progress > 1 || frame.screens.length !== legs.length ||
          new Set(frame.screens.map((item) => item.screen)).size !== legs.length ||
          legs.some((leg) => !frame.screens.some((item) => item.screen === leg.screen && Number.isFinite(item.progress) && item.progress >= 0 && item.progress <= 1))) {
        throw new Error('Progression du trajet invalide.');
      }
    };
    signal.addEventListener('abort', rollback, { once: true });
    try {
      temporary = resources.sources.retainTemporary('travel-temporary', legs[0].path.from, lifetime.signal);
      await abortable(temporary.ready, lifetime.signal); assertActive();
      return {
        async render(frame) {
          assertActive(); if (busy) throw new Error('Attendre la présentation du trajet précédent.');
          validateFrame(frame); busy = true;
          try {
            globalProgress = frame.progress;
            while (index < legs.length) {
              const requested = frame.screens.find((item) => item.screen === legs[index].screen)!.progress;
              if (requested < progress) throw new Error('Progression du trajet rétrograde.');
              if (frame.progress * plan.totalMs < plan.steps[index].startMs) break;
              if (!bound) {
                if (index > 0) await pose(0);
                bind(legs[index].screen, temporary!.texture); bound = true; await present();
              }
              if (requested !== progress) {
                await pose(requested); progress = requested;
                // Keep the endpoint on the temporary viewpoint for a complete main frame.
                await present();
              }
              if (requested < 1) break;
              bind(legs[index].screen, pairs.get(legs[index].screen)!.to); await present();
              // The previous surface now shows B before this same camera moves elsewhere.
              index++; bound = false; progress = 0;
            }
          } finally { busy = false; }
        },
        async commit() {
          assertActive(); if (busy || index !== legs.length) throw new Error('Terminer les étapes avant présentation finale.');
          await present(); presented = true;
        },
        complete() {
          if (settled) return;
          if (!presented) throw new Error('Présenter le trajet avant validation.');
          settled = true; dispose();
        },
        rollback,
      };
    } catch (error) { rollback(); throw error; }
  } };
}
