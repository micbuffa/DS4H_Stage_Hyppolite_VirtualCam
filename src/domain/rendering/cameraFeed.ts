export interface FeedSize { width: number; height: number }
export const defaultFeedSize: Readonly<FeedSize> = Object.freeze({ width: 1024, height: 576 });

export function validateFeedSize(size: FeedSize): void {
  if (![size.width, size.height].every((value) => Number.isInteger(value) && value > 0 && value <= 4096) || Math.abs(size.width / size.height - 16 / 9) > 0.001) {
    throw new Error('Le flux doit avoir une résolution 16:9, entre 1 et 4096 pixels.');
  }
}

/** Only explicitly tagged concert meshes are allowed into a camera feed. */
export function isFilmable(metadata: unknown): boolean {
  return typeof metadata === 'object' && metadata !== null && 'category' in metadata && metadata.category === 'concert';
}
