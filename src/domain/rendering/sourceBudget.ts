import { assertCameraId } from '../cameras/cameraDefinition';
import type { CameraId } from '../cameras/cameraDefinition';

export type SourceUse = 'live' | 'transition' | 'preview' | 'travel' | 'rollback';
export interface SourceConsumer { readonly owner: string; readonly source: CameraId | 'temporary'; readonly use: SourceUse; readonly rendering: boolean }
export const sourceLimits = Object.freeze({ live: 3, preview: 4, transition: 4, travel: 5 });

/** Pure accounting; the existing feed manager remains the sole resource owner. */
export function sourceBudget(consumers: readonly SourceConsumer[], context: keyof typeof sourceLimits) {
  const owners = new Set<string>();
  for (const consumer of consumers) {
    if (!consumer.owner || owners.has(consumer.owner)) throw new Error('Consommateur de flux invalide ou dupliqué.');
    owners.add(consumer.owner);
    if (consumer.source !== 'temporary') assertCameraId(consumer.source);
    if (!['live', 'transition', 'preview', 'travel', 'rollback'].includes(consumer.use)) throw new Error('Usage de flux invalide.');
  }
  if ((context === 'transition' || context === 'travel') && consumers.some((entry) => entry.use === 'preview')) throw new Error('Suspendre la prévisualisation avant le passage.');
  const sources = [...new Set(consumers.map((entry) => entry.source))];
  const active = new Set(consumers.filter((entry) => entry.rendering).map((entry) => entry.source)).size;
  if (active > sourceLimits[context]) throw new Error('Budget de captation dépassé.');
  return { allocated: sources.length, active, consumers: sources.map((source) => ({ source, count: consumers.filter((entry) => entry.source === source).length })) };
}
