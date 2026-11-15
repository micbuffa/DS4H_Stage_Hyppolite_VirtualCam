import type { CameraRegistry } from '../../domain/cameras/cameraRegistry';
import type { CameraId } from '../../domain/cameras/cameraDefinition';
import { planTransition } from '../../domain/direction/transitionPlan';
import type { TransitionPlan } from '../../domain/direction/transitionPlan';
import type { PreviewContext, PreviewCoordinator, PreviewTiming, PreviewViewPort, PreviewStatus } from '../ports/preview';
import type { SharedSourcePort, SourceLease, PreparedTransition } from '../ports/transition';
import { abortable } from './abortable';
import { TransitionOperation } from './transitionOperation';
import type { TransitionSnapshot } from './transitionOperation';
import { captureTravelPlan } from '../../domain/direction/captureTravelPlan';
import { createConcertTravelObstacles } from '../../domain/concert/travelObstacles';
import type { TravelObstacle } from '../../domain/cameras/travelCollision';

export interface PreviewSnapshot extends PreviewStatus {
  transition: TransitionSnapshot;
}
interface Candidate<T> { id: CameraId; lease: SourceLease<T>; abort: AbortController; bound: boolean }

/** Owns preview consumers, never the feeds themselves or the committed routes. */
export class PreviewController<T> implements PreviewCoordinator {
  private enabled = false;
  private suspended = false;
  private disposed = false;
  private revision = 0;
  private current: Candidate<T> | undefined;
  private candidate: Candidate<T> | undefined;
  private phase: PreviewSnapshot['phase'] = 'off';
  private requested: CameraId | null = null;
  private reason = '';
  private error: string | null = null;
  private running: Promise<void> | undefined;
  private pendingTest: TransitionPlan | undefined;
  private readonly operation: TransitionOperation;
  private readonly listeners = new Set<() => void>();
  private readonly detach: () => void;
  private selected: CameraId;

  constructor(private readonly cameras: CameraRegistry, private readonly sources: SharedSourcePort<T>, private readonly view: PreviewViewPort<T>, timing: PreviewTiming,
    private readonly context: () => PreviewContext, private readonly isDragging?: () => boolean, private readonly travelObstacles: readonly TravelObstacle[] = createConcertTravelObstacles()) {
    this.selected = cameras.snapshot().selectedId;
    this.operation = new TransitionOperation({ prepare: async (_routes, signal) => ({
      commit: () => this.view.present(signal ?? new AbortController().signal), complete() {}, rollback() {},
    }), dispose() {} }, { ...timing, prepare: (plan, signal) => this.prepareTest(plan, signal) }, () => this.emit(), isDragging);
    this.detach = cameras.subscribe(({ selectedId }) => {
      if (this.selected === selectedId) return;
      this.selected = selectedId;
      if (this.enabled && !this.suspended) void this.refresh();
      else if (this.enabled) { this.requested = selectedId; this.emit(); }
    });
  }
  snapshot(): PreviewSnapshot {
    const testing = this.phase === 'testing' ? this.operation.snapshot().plan : undefined;
    const active = testing?.targets[0];
    const reference = active ?? [...this.context().targets].sort()[0] ?? null;
    return { enabled: this.enabled, phase: this.phase, source: this.candidate?.bound ? this.candidate.id : this.current?.id ?? null, requested: this.requested,
      reference, referenceSource: active ? this.operation.snapshot().plan!.before[active] : reference === null ? null : this.context().routes[reference],
      progress: this.phase === 'testing' ? this.operation.snapshot().frame?.progress ?? 0 : 0,
      reason: this.reason, error: this.error, transition: this.operation.snapshot(),
      ...(testing?.settings.mode === 'virtual-travel' ? { temporary: this.operation.busy, destination: testing.destination } : {}) };
  }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); listener(); return () => { this.listeners.delete(listener); }; }
  isCameraLocked(id: CameraId): boolean { return !!this.pendingTest?.participants.includes(id) || this.operation.busy && !!this.operation.snapshot().plan?.participants.includes(id); }
  async activate(): Promise<void> {
    this.assertAlive(); this.enabled = true;
    if (!this.suspended) await this.refresh(); else this.emit();
  }
  async deactivate(): Promise<void> {
    if (this.disposed) return;
    this.enabled = false; ++this.revision; this.pendingTest = undefined; this.cancelCandidate(); await this.stopTest();
    this.clearCurrent(); this.phase = 'off'; this.requested = null; this.error = null; this.emit();
  }
  private async refresh(): Promise<void> {
    const revision = ++this.revision, id = this.cameras.snapshot().selectedId;
    this.pendingTest = undefined;
    this.cancelCandidate(); this.requested = id; this.error = null;
    this.phase = 'preparing'; this.emit();
    await this.stopTest();
    if (!this.valid(revision)) return;
    if (this.current?.id === id) { this.current.lease.setRenderingEnabled(true); this.phase = 'ready'; this.emit(); return; }
    const abort = new AbortController();
    let candidate: Candidate<T> | undefined;
    try {
      this.current?.lease.setRenderingEnabled(false);
      const lease = this.sources.retain({ owner: `preview-${revision}`, source: id, use: 'preview', rendering: true }, abort.signal);
      candidate = { id, lease, abort, bound: false }; this.candidate = candidate;
      await abortable(lease.ready, abort.signal);
      if (!this.valid(revision)) return;
      this.view.show(lease.texture); candidate.bound = true;
      await abortable(this.view.present(abort.signal), abort.signal);
      if (!this.valid(revision)) return;
      this.current?.abort.abort(); this.current?.lease.dispose();
      this.current = candidate; this.candidate = undefined; candidate.bound = false;
      this.phase = 'ready'; this.emit();
    } catch (error) {
      if (revision !== this.revision || this.disposed || this.suspended) return;
      this.cancelCandidate(); abort.abort();
      this.current?.lease.setRenderingEnabled(true); this.view.show(this.current?.lease.texture ?? null);
      this.phase = 'error'; this.error = `Aperçu C${id} impossible.${this.current ? ` C${this.current.id} conservée.` : ''} ${error instanceof Error ? error.message.split('\n')[0].slice(0, 160) : ''}`;
      this.emit();
    } finally {
      if (candidate && this.current !== candidate && this.candidate !== candidate) { candidate.abort.abort(); candidate.lease.dispose(); }
    }
  }
  async test(): Promise<void> {
    this.assertAlive();
    const context = this.context(), destination = this.cameras.snapshot().selectedId;
    const reference = [...context.targets].sort()[0];
    if (context.blocked || this.suspended) throw new Error('Attendre la fin de la diffusion ou du changement de qualité.');
    if (reference === undefined) throw new Error('Choisir un écran cible pour tester l’effet.');
    if (context.settings.mode === 'virtual-travel' && !this.view.supportsTravel) throw new Error('Le test hors direct du trajet n’est pas encore disponible.');
    const plan = captureTravelPlan(planTransition(context.routes, destination, [reference], { ...context.settings, order: 'simultaneous', delayMs: 0 }), this.cameras.snapshot().cameras, this.travelObstacles);
    if (this.isDragging?.()) throw new Error('Terminer le geste d’édition avant de tester.');
    const travel = plan.settings.mode === 'virtual-travel' && plan.steps.length > 0;
    let revision: number;
    if (travel) {
      this.enabled = true; revision = ++this.revision; this.pendingTest = plan; this.cancelCandidate(); this.emit(); await this.stopTest(false);
      if (!this.valid(revision) || this.context().blocked) { if (this.pendingTest === plan) { this.pendingTest = undefined; this.emit(); } return; }
      this.clearCurrent(); this.requested = destination;
    } else {
      const activation = this.activate(); revision = this.revision; await activation;
      if (!this.valid(revision) || this.current?.id !== destination || this.context().blocked) return;
    }
    this.phase = 'testing'; this.error = null;
    const running = this.operation.execute(plan); this.pendingTest = undefined; this.running = running;
    try { await running; }
    catch (error) {
      if (this.operation.snapshot().phase === 'error' && !this.suspended && !this.disposed) this.error = `Test impossible. ${error instanceof Error ? error.message.split('\n')[0].slice(0, 160) : ''}`;
    } finally {
      if (this.running === running) this.running = undefined;
      if (travel && this.valid(revision) && !this.current) {
        const error = this.error, refresh = this.refresh(), refreshed = this.revision; await refresh;
        if (this.valid(refreshed) && error) { this.error = error; this.phase = 'error'; this.emit(); }
      } else if (this.valid(revision)) { this.phase = this.error ? 'error' : 'ready'; this.emit(); }
    }
  }
  async stopTest(cancelPending = true): Promise<void> {
    if (cancelPending && this.pendingTest) { this.pendingTest = undefined; ++this.revision; this.emit(); }
    this.operation.cancel(); await this.running?.catch(() => undefined);
  }
  async suspend(reason: string): Promise<void> {
    if (this.disposed) return;
    this.suspended = true; this.reason = reason; ++this.revision; this.pendingTest = undefined; this.cancelCandidate();
    await this.stopTest(); this.clearCurrent(); this.error = null; this.phase = this.enabled ? 'suspended' : 'off'; this.emit();
  }
  resume(): void {
    if (this.disposed) return;
    this.suspended = false; this.reason = '';
    if (this.enabled) void this.refresh(); else this.emit();
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; ++this.revision; this.pendingTest = undefined; this.detach(); this.cancelCandidate(); this.operation.dispose(); this.clearCurrent();
    this.phase = 'stopped'; this.enabled = false; this.listeners.clear();
  }
  private async prepareTest(plan: TransitionPlan, signal: AbortSignal): Promise<PreparedTransition> {
    if (plan.settings.mode === 'virtual-travel') return this.prepareTravelTest(plan, signal);
    const step = plan.steps[0];
    let lease: SourceLease<T> | undefined, visual: PreparedTransition | undefined, settled = false;
    const release = () => { signal.removeEventListener('abort', rollback); lease?.dispose(); };
    const rollback = () => { if (settled) return; settled = true; try { visual?.rollback(); } finally { release(); } };
    signal.addEventListener('abort', rollback, { once: true });
    try {
      if (signal.aborted || !this.current) throw new Error('Test annulé.');
      if (step.from !== null) {
        lease = this.sources.retain({ owner: `preview-test-${this.revision}`, source: step.from, use: 'preview', rendering: true }, signal);
        await abortable(lease.ready, signal);
      }
      visual = await abortable(this.view.prepare(plan, lease?.texture ?? null, this.current.lease.texture, signal), signal, (late) => late.rollback());
      return { render: (frame) => visual!.render(frame), commit: () => visual!.commit(),
        complete: () => { if (settled) return; settled = true; try { visual!.complete(); } finally { release(); } }, rollback };
    } catch (error) { rollback(); throw error; }
  }
  private async prepareTravelTest(plan: TransitionPlan, signal: AbortSignal): Promise<PreparedTransition> {
    const revision = this.revision, step = plan.steps[0];
    let from: SourceLease<T> | undefined, to: SourceLease<T> | undefined, visual: PreparedTransition | undefined;
    let settled = false, ready = false;
    const release = (restore: boolean) => {
      signal.removeEventListener('abort', rollback); from?.dispose(); from = undefined;
      try {
        if (restore && ready && visual && this.valid(revision) && !this.context().blocked) {
          const abort = new AbortController();
          const lease = this.sources.retain({ owner: `preview-arrival-${revision}`, source: plan.destination, use: 'preview', rendering: true }, abort.signal);
          this.current = { id: plan.destination, lease, abort, bound: false }; this.view.show(lease.texture);
        }
      } finally { to?.dispose(); to = undefined; }
    };
    const rollback = () => {
      if (settled) return; settled = true;
      try { visual?.rollback(); } finally { release(true); }
    };
    signal.addEventListener('abort', rollback, { once: true });
    try {
      if (signal.aborted || step.from === null) throw new Error('Test de trajet annulé.');
      from = this.sources.retain({ owner: `travel-test-from-${revision}`, source: step.from, use: 'travel', rendering: true }, signal);
      // B is also the image to restore after testing: keep it through the preview handoff.
      to = this.sources.retain({ owner: `travel-test-return-${revision}`, source: plan.destination, use: 'rollback', rendering: true }, signal);
      await abortable(Promise.all([from.ready, to.ready]), signal); ready = true;
      visual = await abortable(this.view.prepare(plan, from.texture, to.texture, signal), signal, (late) => late.rollback());
      return { render: (frame) => visual!.render(frame), commit: () => visual!.commit(), rollback,
        complete: () => { if (settled) return; settled = true; try { visual!.complete(); } finally { release(true); } } };
    } catch (error) { rollback(); throw error; }
  }
  private cancelCandidate(): void {
    const candidate = this.candidate; if (!candidate) return;
    this.candidate = undefined; candidate.lease.setRenderingEnabled(false);
    if (candidate.bound) this.view.show(this.current?.lease.texture ?? null);
    candidate.abort.abort(); candidate.lease.dispose(); this.current?.lease.setRenderingEnabled(true);
  }
  private clearCurrent(): void { this.view.show(null); this.current?.abort.abort(); this.current?.lease.dispose(); this.current = undefined; }
  private valid(revision: number) { return revision === this.revision && this.enabled && !this.suspended && !this.disposed; }
  private assertAlive() { if (this.disposed) throw new Error('La prévisualisation est arrêtée.'); }
  private emit() { if (!this.disposed) this.listeners.forEach((listener) => listener()); }
}
