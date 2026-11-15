import type { CameraId } from '../../domain/cameras/cameraDefinition';
import type { TravelPose } from '../../domain/cameras/travelPath';
import type { RoutingTable, ScreenId } from '../../domain/direction/screenRouting';
import type { CameraFeedPort, ScreenTexturePort } from './cameraFeed';

export interface PreparedRouting {
  commit(): Promise<void>;
  complete(): void;
  rollback(): void;
}
export interface RoutingRenderPort {
  prepare(routes: RoutingTable, signal?: AbortSignal): Promise<PreparedRouting>;
  dispose(): void;
}
export interface RoutableFeed<T> extends CameraFeedPort<T> { setRenderingEnabled(enabled: boolean): void }
export interface TravelFeed<T> extends RoutableFeed<T> {
  setPose(pose: TravelPose): void;
  /** Resolves after an actual draw of the current pose, outside the GPU pass. */
  waitForFrame(signal: AbortSignal): Promise<void>;
}
export interface RoutingResources<T> {
  createFeed(camera: CameraId): RoutableFeed<T>;
  createTemporary?(pose: TravelPose): TravelFeed<T>;
  screens: ReadonlyMap<ScreenId, ScreenTexturePort<T>>;
  waitForPresentation(): { ready: Promise<void>; dispose(): void };
}
