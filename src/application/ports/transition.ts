import type { TransitionMode } from '../../domain/direction/transitionDefinition';
import type { TransitionFrame, TransitionPlan } from '../../domain/direction/transitionPlan';
import type { PreparedRouting } from './routing';
import type { CameraFeedPort } from './cameraFeed';
import type { SourceConsumer } from '../../domain/rendering/sourceBudget';
import type { ScreenId } from '../../domain/direction/screenRouting';
import type { TravelPose } from '../../domain/cameras/travelPath';

export interface TransitionSourcePair<T> { readonly from: T | null; readonly to: T }
export interface TransitionCompositionPort<T> {
  prepare(plan: TransitionPlan, sources: ReadonlyMap<ScreenId, TransitionSourcePair<T>>, signal: AbortSignal): Promise<PreparedTransition>;
}

/** Contract for T13: implemented by the existing resource owner, never a second pool. */
export interface SourceLease<T> extends CameraFeedPort<T> {
  readonly consumer: SourceConsumer;
  /** A shared source renders while at least one lease requests rendering. */
  setRenderingEnabled(enabled: boolean): void;
  /** Releases this lease only, without destroying another consumer's texture. */
  dispose(): void;
}
export interface SharedSourcePort<T> {
  /** Returns ownership immediately; ready rejects and the lease releases on abort. */
  retain(consumer: SourceConsumer, signal: AbortSignal): SourceLease<T>;
}
export interface TravelSourceLease<T> extends SourceLease<T> {
  setPose(pose: TravelPose): void;
  waitForFrame(signal: AbortSignal): Promise<void>;
}
export interface TravelSourcePort<T> extends SharedSourcePort<T> {
  /** Exclusive mutable point of view; shares the same pool and budget as numbered sources. */
  retainTemporary(owner: string, pose: TravelPose, signal: AbortSignal): TravelSourceLease<T>;
}

/** prepare must release partial resources on failure/abort, even before returning. */
export interface PreparedTransition extends PreparedRouting {
  render(frame: TransitionFrame): void | Promise<void>;
}
export interface TransitionDriver {
  readonly supportedModes: readonly TransitionMode[];
  prepare(plan: TransitionPlan, signal: AbortSignal): Promise<PreparedTransition>;
  sample(): { nowMs: number; visible: boolean };
  /** Includes visibility events while RAF is paused; detaches listeners on abort. */
  nextSample(signal: AbortSignal): Promise<{ nowMs: number; visible: boolean }>;
}
