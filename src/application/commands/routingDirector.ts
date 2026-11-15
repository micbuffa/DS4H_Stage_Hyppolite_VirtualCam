import type { CameraRegistry } from '../../domain/cameras/cameraRegistry';
import type { CameraId } from '../../domain/cameras/cameraDefinition';
import { assertScreenId, emptyRouting, screenIds } from '../../domain/direction/screenRouting';
import type { RoutingTable, ScreenId } from '../../domain/direction/screenRouting';
import type { RoutingRenderPort } from '../ports/routing';
import { planTransition } from '../../domain/direction/transitionPlan';
import type { TransitionPlan } from '../../domain/direction/transitionPlan';
import { transitionSettings } from '../../domain/direction/transitionDefinition';
import type { TransitionInput, TransitionSettings } from '../../domain/direction/transitionDefinition';
import type { TransitionDriver } from '../ports/transition';
import { TransitionOperation } from './transitionOperation';
import { TransitionCancelledError } from './abortable';
import type { TransitionSnapshot } from './transitionOperation';
import type { PreviewCoordinator } from '../ports/preview';
import { captureTravelPlan } from '../../domain/direction/captureTravelPlan';
import { createConcertTravelObstacles } from '../../domain/concert/travelObstacles';
import type { TravelObstacle } from '../../domain/cameras/travelCollision';

export interface DirectorSnapshot {
  selectedId: CameraId;
  targets: ScreenId[];
  routes: RoutingTable;
  pending: CameraId | null;
  error: string | null;
  transition?: TransitionSnapshot;
  settings?: TransitionSettings;
  qualityPending?: boolean;
}

export class RoutingDirector {
  private routes = emptyRouting();
  private readonly targets = new Set<ScreenId>([1]);
  private pending: CameraId | null = null;
  private error: string | null = null;
  private disposed = false;
  private readonly listeners = new Set<(state: DirectorSnapshot) => void>();
  private readonly unsubscribeCamera: () => void;
  private readonly operation: TransitionOperation;
  private settings = transitionSettings();
  private qualityPending = false;
  private pendingPlan: TransitionPlan | undefined;
  private cancelled = false;

  constructor(private readonly cameras: CameraRegistry, renderer: RoutingRenderPort, driver?: TransitionDriver, isDragging?: () => boolean, private readonly preview?: PreviewCoordinator,
    private readonly travelObstacles: readonly TravelObstacle[] = createConcertTravelObstacles()) {
    this.operation = new TransitionOperation(renderer, driver, () => this.emit(), isDragging);
    this.unsubscribeCamera = cameras.subscribe(() => this.emit());
  }
  snapshot(): DirectorSnapshot {
    return { selectedId: this.cameras.snapshot().selectedId, targets: [...this.targets].sort(), routes: { ...this.routes }, pending: this.pending, error: this.error, transition: this.operation.snapshot(), settings: this.settings, qualityPending: this.qualityPending };
  }
  transitionSnapshot() { return this.operation.snapshot(); }
  configureTransition(input: TransitionInput): void { this.assertAlive(); this.settings = transitionSettings(input); this.emit(); }
  transitionSettings(): TransitionSettings { return this.settings; }
  cancelTransition(): void { this.cancelled = this.pending !== null; this.operation.cancel(this.pendingPlan); }
  isCameraLocked(id: CameraId): boolean { return this.pending !== null && !!this.pendingPlan?.participants.includes(id) || this.operation.busy && !!this.operation.snapshot().plan?.participants.includes(id) || !!this.preview?.isCameraLocked(id); }
  assertQualityChangeAllowed(): void {
    this.assertAlive();
    if (this.pending !== null || this.operation.busy || this.qualityPending) throw new Error('Attendre la fin du passage avant de changer la qualité.');
  }
  async changeQuality(change: () => Promise<void>): Promise<void> {
    this.assertQualityChangeAllowed(); this.qualityPending = true; this.emit();
    try { await this.preview?.suspend('Changement de qualité'); this.assertAlive(); await change(); }
    finally { this.qualityPending = false; if (!this.disposed) { this.preview?.resume(); this.emit(); } }
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
  initialize(): Promise<void> { return this.assign(1, screenIds, { mode: 'cut' }); }
  broadcast(): Promise<void> { return this.assign(this.snapshot().selectedId, [...this.targets]); }

  async assign(camera: number, targets: readonly number[], settings: TransitionInput = this.settings): Promise<void> {
    this.assertAlive();
    if (this.pending !== null || this.qualityPending) throw new Error('Une coupe ou un changement de qualité est déjà en préparation.');
    let plan = planTransition(this.routes, camera, targets, settings);
    this.error = null; this.operation.assertCanStart(plan);
    try { plan = captureTravelPlan(plan, this.cameras.snapshot().cameras, this.travelObstacles); }
    catch (error) {
      this.error = error instanceof Error ? error.message : 'Validation du trajet impossible.';
      this.emit(); throw error;
    }
    if (!plan.steps.length && !this.preview) { await this.operation.execute(plan); this.error = null; this.emit(); return; }
    this.cancelled = false; this.pendingPlan = plan; this.pending = camera as CameraId; this.error = null; this.emit();
    let suspended = false;
    try {
      if (this.preview) {
        if (plan.steps.length) { suspended = true; await this.preview.suspend('Diffusion'); }
        else await this.preview.stopTest();
      }
      this.assertAlive();
      if (this.cancelled) throw new TransitionCancelledError();
      await this.operation.execute(plan);
      if (this.disposed) throw new Error('La régie est arrêtée.');
      this.routes = { ...plan.after };
      this.pending = null;
      this.emit();
    } catch (error) {
      if (!this.disposed) {
        this.pending = null;
        this.error = error instanceof TransitionCancelledError ? null : Object.values(this.routes).every((id) => id === null)
          ? `C${camera} indisponible. Écrans sans signal.`
          : `Préparation de C${camera} impossible. La diffusion précédente est conservée.`;
        if (this.error && error instanceof Error) this.error += ` ${error.message.split('\n')[0].slice(0, 160)}`;
        this.emit();
      }
      throw error;
    } finally { this.pendingPlan = undefined; if (!this.disposed && suspended) this.preview?.resume(); }
  }
  subscribe(listener: (state: DirectorSnapshot) => void): () => void {
    this.assertAlive(); this.listeners.add(listener); listener(this.snapshot());
    return () => { this.listeners.delete(listener); };
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribeCamera(); this.listeners.clear(); this.operation.dispose();
  }
  private assertAlive() { if (this.disposed) throw new Error('La régie est arrêtée.'); }
  private emit() { if (!this.disposed) this.listeners.forEach((listener) => listener(this.snapshot())); }
}
