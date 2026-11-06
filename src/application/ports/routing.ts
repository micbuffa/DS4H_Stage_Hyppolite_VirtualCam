import type { CameraId } from '../../domain/cameras/cameraDefinition';
import type { RoutingTable, ScreenId } from '../../domain/direction/screenRouting';
import type { CameraFeedPort, ScreenTexturePort } from './cameraFeed';

export interface PreparedRouting {
  commit(): Promise<void>;
  complete(): void;
  rollback(): void;
}
export interface RoutingRenderPort {
  prepare(routes: RoutingTable): Promise<PreparedRouting>;
  dispose(): void;
}
export interface RoutableFeed<T> extends CameraFeedPort<T> { setRenderingEnabled(enabled: boolean): void }
export interface RoutingResources<T> {
  createFeed(camera: CameraId): RoutableFeed<T>;
  screens: ReadonlyMap<ScreenId, ScreenTexturePort<T>>;
  waitForPresentation(): { ready: Promise<void>; dispose(): void };
}
