import { TransitionClock } from '../../domain/direction/transitionClock';
import { transitionFrame } from '../../domain/direction/transitionPlan';
import type { TransitionFrame, TransitionPlan } from '../../domain/direction/transitionPlan';
import type { RoutingRenderPort, PreparedRouting } from '../ports/routing';
import type { PreparedTransition, TransitionDriver } from '../ports/transition';
import { abortable } from './abortable';

export type TransitionPhase = 'idle' | 'preparing' | 'transitioning' | 'presenting' | 'completed' | 'cancelled' | 'error' | 'stopped';
export interface TransitionSnapshot {
  readonly phase: TransitionPhase;
  readonly plan: TransitionPlan | null;
  readonly frame: TransitionFrame | null;
  readonly error: string | null;
}

/** Executes a captured command; the director remains the authority on committed routes. */
export class TransitionOperation {
  private active: AbortController | undefined;
  private disposed = false;
  private state: TransitionSnapshot = { phase: 'idle', plan: null, frame: null, error: null };

  constructor(private readonly renderer: RoutingRenderPort, private readonly driver?: TransitionDriver,
    private readonly changed: () => void = () => undefined, private readonly isDragging: () => boolean = () => false) {}

  snapshot(): TransitionSnapshot { return { ...this.state }; }
  get busy(): boolean { return !!this.active; }

  assertCanStart(plan: TransitionPlan): void {
    if (this.disposed) throw new Error('La régie est arrêtée.');
    if (this.active) throw new Error('Une transition est déjà en préparation.');
    if (this.isDragging()) this.refuse(plan, 'Terminer le geste d’édition avant de diffuser.');
  }
  async execute(plan: TransitionPlan): Promise<void> {
    this.assertCanStart(plan);
    if (!plan.steps.length) { this.set({ phase: 'completed', plan, frame: transitionFrame(plan, 0), error: null }); return; }
    // Delayed cuts share the transition transaction; instantaneous cuts keep the idle budget.
    const effect = plan.settings.mode !== 'cut' || plan.totalMs > 0;
    if (effect && !this.driver?.supportedModes.includes(plan.settings.mode)) this.refuse(plan, 'Ce mode de transition n’est pas encore disponible.');
    if (plan.maxActiveSources > (plan.settings.mode === 'virtual-travel' ? 5 : 4)) this.refuse(plan, 'Budget de captation dépassé.');
    const controller = new AbortController();
    this.active = controller;
    const signal = controller.signal;
    let session: PreparedRouting | undefined;
    this.set({ phase: 'preparing', plan, frame: null, error: null });
    try {
      session = await abortable(effect ? this.driver!.prepare(plan, signal) : this.renderer.prepare({ ...plan.after }, signal), signal, (late) => late.rollback());
      if (effect) {
        const prepared = session as PreparedTransition;
        const clock = new TransitionClock();
        const initial = this.driver!.sample();
        clock.sample(initial.nowMs, initial.visible);
        let visible = initial.visible;
        let frame = transitionFrame(plan, 0);
        if (visible) { const rendered = prepared.render(frame); if (rendered) await abortable(rendered, signal); }
        this.set({ phase: 'transitioning', plan, frame, error: null });
        while (frame.progress < 1 || !visible) {
          const sample = await abortable(this.driver!.nextSample(signal), signal);
          visible = sample.visible;
          frame = transitionFrame(plan, clock.sample(sample.nowMs, sample.visible));
          if (sample.visible) { const rendered = prepared.render(frame); if (rendered) await abortable(rendered, signal); }
          this.set({ phase: 'transitioning', plan, frame, error: null });
        }
      }
      this.set({ phase: 'presenting', plan, frame: transitionFrame(plan, plan.totalMs), error: null });
      await abortable(session.commit(), signal);
      session.complete();
      this.set({ phase: 'completed', plan, frame: transitionFrame(plan, plan.totalMs), error: null });
    } catch (error) {
      // Prepared sessions must make rollback idempotent, including after interruption.
      try { session?.rollback(); }
      finally {
        if (!this.disposed) this.set({ phase: signal.aborted ? 'cancelled' : 'error', plan, frame: null,
          error: signal.aborted ? null : error instanceof Error ? error.message : 'Transition impossible.' });
      }
      throw error;
    } finally { this.active = undefined; }
  }

  cancel(plan?: TransitionPlan): void {
    if (this.active) this.active.abort();
    else if (plan && !this.disposed) this.set({ phase: 'cancelled', plan, frame: null, error: null });
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancel();
    this.renderer.dispose();
    this.set({ phase: 'stopped', plan: null, frame: null, error: null });
  }
  private set(state: TransitionSnapshot): void { this.state = state; this.changed(); }
  private refuse(plan: TransitionPlan, message: string): never {
    this.set({ phase: 'error', plan, frame: null, error: message });
    throw new Error(message);
  }
}
