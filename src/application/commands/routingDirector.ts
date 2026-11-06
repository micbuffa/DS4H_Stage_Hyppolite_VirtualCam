import type { CameraRegistry } from '../../domain/cameras/cameraRegistry';
import type { CameraId } from '../../domain/cameras/cameraDefinition';
import { assertScreenId, emptyRouting, planRouting, sameRouting, screenIds } from '../../domain/direction/screenRouting';
import type { RoutingTable, ScreenId } from '../../domain/direction/screenRouting';
import type { PreparedRouting, RoutingRenderPort } from '../ports/routing';

export interface DirectorSnapshot {
  selectedId: CameraId;
  targets: ScreenId[];
  routes: RoutingTable;
  pending: CameraId | null;
  error: string | null;
}

export class RoutingDirector {
  private routes = emptyRouting();
  private readonly targets = new Set<ScreenId>([1]);
  private pending: CameraId | null = null;
  private error: string | null = null;
  private disposed = false;
  private readonly listeners = new Set<(state: DirectorSnapshot) => void>();
  private readonly unsubscribeCamera: () => void;

  constructor(private readonly cameras: CameraRegistry, private readonly renderer: RoutingRenderPort) {
    this.unsubscribeCamera = cameras.subscribe(() => this.emit());
  }
  snapshot(): DirectorSnapshot {
    return { selectedId: this.cameras.snapshot().selectedId, targets: [...this.targets].sort(), routes: { ...this.routes }, pending: this.pending, error: this.error };
  }
  toggleTarget(id: number): void {
    this.assertAlive(); assertScreenId(id);
    if (this.targets.has(id)) this.targets.delete(id); else this.targets.add(id);
    this.emit();
  }
  selectAllTargets(): void {
    this.assertAlive();
    if (this.targets.size === 3) return;
    screenIds.forEach((id) => this.targets.add(id)); this.emit();
  }
  initialize(): Promise<void> { return this.assign(1, screenIds); }
  broadcast(): Promise<void> { return this.assign(this.snapshot().selectedId, [...this.targets]); }

  async assign(camera: number, targets: readonly number[]): Promise<void> {
    this.assertAlive();
    if (this.pending !== null) throw new Error('Une coupe est déjà en préparation.');
    const next = planRouting(this.routes, camera, targets);
    if (sameRouting(next, this.routes)) { this.error = null; this.emit(); return; }
    this.pending = camera as CameraId; this.error = null; this.emit();
    let transaction: PreparedRouting | undefined;
    try {
      transaction = await this.renderer.prepare(next);
      if (this.disposed) throw new Error('La régie est arrêtée.');
      await transaction.commit();
      if (this.disposed) throw new Error('La régie est arrêtée.');
      transaction.complete();
      this.routes = { ...next };
      this.pending = null;
      this.emit();
    } catch (error) {
      transaction?.rollback();
      if (!this.disposed) {
        this.pending = null;
        this.error = Object.values(this.routes).every((id) => id === null)
          ? `C${camera} indisponible. Écrans sans signal.`
          : `Préparation de C${camera} impossible. La diffusion précédente est conservée.`;
        this.emit();
      }
      throw error;
    }
  }
  subscribe(listener: (state: DirectorSnapshot) => void): () => void {
    this.assertAlive(); this.listeners.add(listener); listener(this.snapshot());
    return () => { this.listeners.delete(listener); };
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribeCamera(); this.listeners.clear(); this.renderer.dispose();
  }
  private assertAlive() { if (this.disposed) throw new Error('La régie est arrêtée.'); }
  private emit() { if (!this.disposed) this.listeners.forEach((listener) => listener(this.snapshot())); }
}
