export interface CameraFeedPort<T> {
  readonly texture: T;
  readonly ready: Promise<void>;
  dispose(): void;
}

export interface ScreenTexturePort<T> {
  getTexture(): T | null;
  setTexture(texture: T | null): void;
}
