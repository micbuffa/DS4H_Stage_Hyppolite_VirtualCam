import { defaultFeedSize } from './cameraFeed';

export type FeedQuality = 'standard' | 'reduced';

export function feedSizeFor(quality: string) {
  if (quality === 'standard') return defaultFeedSize;
  if (quality === 'reduced') return { width: 512, height: 288 };
  throw new RangeError('Qualité vidéo inconnue.');
}
