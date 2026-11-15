import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { TransitionMode, TransitionSettings, WipeDirection } from '../../src/domain/direction/transitionDefinition';
import type { PreviewStatus } from '../../src/application/ports/preview';
import type { ScreenId } from '../../src/domain/direction/screenRouting';
import type { Position3 } from '../../src/domain/cameras/cameraDefinition';

interface Status { routes: Record<number, number>; phase: string; progress: number; error: string | null; stats: { allocated: number; active: number }; maxActive: number; materials: number; observer: boolean; effectsReady: boolean; frames: Record<string, number>; liveMaterials: boolean; renderTargets: { id: number; name: string; size: { width: number; height: number }; includesMonitor: boolean }[]; resources: { meshes: number; materials: number; textures: number; before: number; after: number } }
interface Harness {
  sequence(mode: TransitionMode, targets: number[], screenOrder: readonly ScreenId[], delayMs: number, durationMs?: number): Promise<Status>;
  advanceSequence(time: number): Promise<Status>;
  inspectScreen(id: ScreenId): Promise<void>;
  status(): Status;
  cameras(): unknown;
  cut(camera: number, targets?: number[]): Promise<Status>;
  start(mode: TransitionMode, direction?: WipeDirection, targets?: number[], parameters?: Partial<TransitionSettings['parameters']>): Promise<Status>;
  advance(progress: number): Promise<Status>;
  cancel(): Promise<Status>;
  samples(points?: readonly (readonly [number, number])[]): Promise<{ samples: number[][]; hash: string; minColor: number; opaque: boolean; maxChannel: number }>;
  detailPatterns(): void;
  concertTime(seconds: number): void;
  movePatterns(): void;
  fail(kind: 'none' | 'source' | 'shader'): void;
  failDuring(): void;
  realtime(): void;
  visibility(hidden: boolean): void;
  select(id: number): void;
  target(id: number): void;
  activatePreview(): Promise<PreviewStatus>;
  disablePreview(): Promise<PreviewStatus>;
  previewState(): PreviewStatus;
  liveHashes(): Promise<string[]>;
  startPreviewTest(mode?: TransitionMode, waypoints?: readonly Position3[]): Promise<PreviewStatus>;
  advancePreview(progress: number): Promise<PreviewStatus>;
  stopPreviewTest(): Promise<PreviewStatus>;
  quality(profile: string): Promise<PreviewStatus>;
  inspect(view: 'monitor' | 'screen', id?: ScreenId): Promise<void>;
  observerPose(): unknown;
  stopPreview(): Promise<void>;
  failSource(id: number): void;
  delaySource(id: number): void;
  resolveSource(id: number): void;
}
export const harness = (page: Page) => ({
  call: <K extends keyof Harness>(method: K, ...args: Parameters<Harness[K]>) => page.evaluate(({ method, args }) => {
    const api = (window as unknown as { transitions: Harness }).transitions;
    return (api[method] as (...args: unknown[]) => unknown)(...args);
  }, { method, args }) as Promise<Awaited<ReturnType<Harness[K]>>>,
});
export const points = [[0.13, 0.13], [0.87, 0.13], [0.37, 0.63], [0.13, 0.87], [0.87, 0.87]] as const;
export const near = (actual: number[], expected: number[], tolerance = 2) => actual.forEach((value, index) => expect(Math.abs(value - expected[index])).toBeLessThanOrEqual(tolerance));
