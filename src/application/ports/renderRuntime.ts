export interface RenderRuntime {
  start(): void;
  resize(pixelRatio: number): void;
  dispose(): void;
}

export interface ApplicationHost {
  pixelRatio(): number;
  subscribeResize(callback: () => void): () => void;
  subscribeExit(callback: () => void): () => void;
}
