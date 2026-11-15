import { assertCameraId } from '../cameras/cameraDefinition';
import type { CameraId } from '../cameras/cameraDefinition';
import type { TravelPath } from '../cameras/travelPath';
import { planRouting, routingSources, screenIds } from './screenRouting';
import type { RoutingTable, ScreenId } from './screenRouting';
import { transitionSettings } from './transitionDefinition';
import type { TransitionInput, TransitionSettings } from './transitionDefinition';

export interface TransitionStep {
  readonly screen: ScreenId;
  readonly from: CameraId | null;
  readonly startMs: number;
  readonly endMs: number;
}
export interface TransitionPlan {
  readonly before: Readonly<RoutingTable>;
  readonly after: Readonly<RoutingTable>;
  readonly destination: CameraId;
  readonly targets: readonly ScreenId[];
  readonly settings: TransitionSettings;
  readonly steps: readonly TransitionStep[];
  readonly totalMs: number;
  readonly participants: readonly CameraId[];
  readonly maxActiveSources: number;
  readonly travel?: readonly { readonly screen: ScreenId; readonly path: TravelPath }[];
}
export interface TransitionFrame {
  readonly progress: number;
  readonly screens: readonly { readonly screen: ScreenId; readonly progress: number }[];
}

export function planTransition(current: RoutingTable, camera: number, targets: readonly number[], input: TransitionInput = {}): TransitionPlan {
  // Validate even unchanged routes; invalid state must not become a GPU request.
  for (const id of screenIds) if (current[id] !== null) assertCameraId(current[id]);
  const after = planRouting(current, camera, targets);
  const settings = transitionSettings(input);
  const uniqueTargets = [...new Set(targets)] as ScreenId[];
  const changed = settings.screenOrder.filter((id) => uniqueTargets.includes(id) && current[id] !== camera);
  const steps = changed.map((screen, index) => {
    const startMs = settings.order === 'staggered' ? index * (settings.durationMs + settings.delayMs) : 0;
    return Object.freeze({ screen, from: current[screen], startMs, endMs: startMs + settings.durationMs });
  });
  const participants = steps.length ? [...new Set([...steps.flatMap((step) => step.from === null ? [] : [step.from]), camera as CameraId])] : [];
  return Object.freeze({ before: Object.freeze({ ...current }), after: Object.freeze(after), destination: camera as CameraId,
    targets: Object.freeze(uniqueTargets), settings, steps: Object.freeze(steps), totalMs: Math.max(0, ...steps.map((step) => step.endMs)),
    participants: Object.freeze(participants), maxActiveSources: steps.length ? new Set([...routingSources(current), camera]).size + (settings.mode === 'virtual-travel' ? 1 : 0) : routingSources(current).length });
}

export function transitionFrame(plan: TransitionPlan, elapsedMs: number): TransitionFrame {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) throw new Error('Temps de transition invalide.');
  return Object.freeze({ progress: plan.totalMs === 0 ? 1 : Math.min(1, elapsedMs / plan.totalMs),
    screens: Object.freeze(plan.steps.map((step) => Object.freeze({ screen: step.screen,
      progress: elapsedMs < step.startMs ? 0 : step.endMs === step.startMs ? 1 : Math.min(1, (elapsedMs - step.startMs) / (step.endMs - step.startMs)) }))) });
}
