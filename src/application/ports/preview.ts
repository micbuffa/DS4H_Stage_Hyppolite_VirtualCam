import type { CameraId } from '../../domain/cameras/cameraDefinition';
import type { RoutingTable, ScreenId } from '../../domain/direction/screenRouting';
import type { TransitionSettings } from '../../domain/direction/transitionDefinition';
import type { TransitionPlan } from '../../domain/direction/transitionPlan';
import type { PreparedTransition, TransitionDriver } from './transition';

export interface PreviewContext { routes: RoutingTable; targets: readonly ScreenId[]; settings: TransitionSettings; blocked: boolean }
export interface PreviewViewPort<T> {
  readonly supportsTravel?: boolean;
  show(texture: T | null): void;
  present(signal: AbortSignal): Promise<void>;
  prepare(plan: TransitionPlan, from: T | null, to: T, signal: AbortSignal): Promise<PreparedTransition>;
}
export type PreviewTiming = Pick<TransitionDriver, 'supportedModes' | 'sample' | 'nextSample'>;
export interface PreviewCoordinator {
  suspend(reason: string): Promise<void>;
  resume(): void;
  isCameraLocked(id: CameraId): boolean;
  stopTest(): Promise<void>;
}
export interface PreviewStatus {
  enabled: boolean;
  phase: 'off' | 'preparing' | 'ready' | 'testing' | 'suspended' | 'error' | 'stopped';
  source: CameraId | null;
  requested: CameraId | null;
  reference: ScreenId | null;
  referenceSource: CameraId | null;
  progress: number;
  reason: string;
  error: string | null;
  temporary?: boolean;
  destination?: CameraId | null;
}
export interface PreviewActions {
  snapshot(): PreviewStatus;
  activate(): Promise<void>;
  deactivate(): Promise<void>;
  test(): Promise<void>;
  stopTest(): Promise<void>;
  subscribe(listener: () => void): () => void;
}
