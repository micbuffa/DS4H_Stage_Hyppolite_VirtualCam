import { cloneCamera } from '../../domain/cameras/cameraDefinition';
import type { CameraDefinition, CameraPose } from '../../domain/cameras/cameraDefinition';
import type { CameraRegistry } from '../../domain/cameras/cameraRegistry';
import { aimAt, boundedFov, boundedPose } from '../../domain/cameras/cameraEditing';

export type EditingMode = 'move' | 'rotate' | null;
export interface EditingSnapshot { mode: EditingMode; dragging: boolean; error: string | null }
export interface EditingNavigation { suspend(): void; resume(): void }

/** Owns gesture transactions; Babylon only provides validated candidate poses. */
export class CameraEditor {
  private mode: EditingMode = null;
  private before: CameraDefinition | undefined;
  private error: string | null = null;
  private disposed = false;
  private readonly listeners = new Set<(state: EditingSnapshot) => void>();
  private readonly unsubscribe: () => void;
  constructor(private readonly cameras: CameraRegistry, private readonly navigation: EditingNavigation) {
    this.unsubscribe = cameras.subscribe((state) => {
      if (this.before && this.before.id !== state.selectedId) this.cancel();
    });
  }
  snapshot(): EditingSnapshot { return { mode: this.mode, dragging: !!this.before, error: this.error }; }
  selected(): CameraDefinition {
    const state = this.cameras.snapshot();
    return state.cameras.find((camera) => camera.id === state.selectedId)!;
  }
  setMode(mode: EditingMode): void { this.assertAlive(); this.cancel(); this.mode = mode; this.error = null; this.emit(); }
  begin(): void {
    this.assertAlive();
    if (!this.mode || this.before) return;
    this.before = cloneCamera(this.selected()); this.error = null;
    try { this.navigation.suspend(); this.emit(); }
    catch (error) { this.cancel(); throw error; }
  }
  preview(pose: CameraPose): void {
    this.assertAlive();
    if (!this.before) return;
    try { this.cameras.updatePose(this.before.id, boundedPose(pose)); }
    catch (error) { this.cancel(); this.report(error); throw error; }
  }
  finish(): void {
    if (!this.before) return;
    this.before = undefined;
    try { this.navigation.resume(); } finally { this.emit(); }
  }
  cancel(): void {
    const previous = this.before;
    if (!previous) return;
    this.before = undefined;
    try { this.cameras.updateCamera(previous); }
    finally { try { this.navigation.resume(); } finally { this.emit(); } }
  }
  escape(): void { if (this.before) this.cancel(); else this.setMode(null); }
  adjustFov(delta: number): void {
    this.assertAlive(); this.cancel();
    const camera = this.selected();
    this.cameras.updateCamera({ ...camera, fovDegrees: boundedFov(camera.fovDegrees + delta) });
    this.error = null; this.emit();
  }
  aim(): void { this.assertAlive(); this.cancel(); this.cameras.updatePose(this.selected().id, aimAt(this.selected())); this.error = null; this.emit(); }
  reset(): void { this.assertAlive(); this.cancel(); this.cameras.resetSelected(); this.error = null; this.emit(); }
  report(error: unknown): void { this.error = error instanceof Error ? error.message : 'Édition impossible.'; this.emit(); }
  subscribe(listener: (state: EditingSnapshot) => void): () => void {
    this.listeners.add(listener); listener(this.snapshot()); return () => { this.listeners.delete(listener); };
  }
  dispose(): void { if (this.disposed) return; this.cancel(); this.disposed = true; this.unsubscribe(); this.listeners.clear(); }
  private emit(): void { this.listeners.forEach((listener) => listener(this.snapshot())); }
  private assertAlive(): void { if (this.disposed) throw new Error('Éditeur arrêté.'); }
}
