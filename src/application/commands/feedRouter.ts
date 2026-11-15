import { emptyRouting, routingSources, screenIds } from '../../domain/direction/screenRouting';
import type { RoutingTable, ScreenId } from '../../domain/direction/screenRouting';
import type { CameraId } from '../../domain/cameras/cameraDefinition';
import type { PreparedRouting, RoutableFeed, RoutingRenderPort, RoutingResources, TravelFeed } from '../ports/routing';
import { abortable } from './abortable';
import { sourceBudget } from '../../domain/rendering/sourceBudget';
import type { SourceConsumer } from '../../domain/rendering/sourceBudget';
import type { SourceLease, TravelSourceLease, PreparedTransition, TransitionCompositionPort, TransitionSourcePair } from '../ports/transition';
import type { TransitionPlan } from '../../domain/direction/transitionPlan';
import type { TravelPose } from '../../domain/cameras/travelPath';

type SourceId = SourceConsumer['source'];
type FeedEntry<T> = { feed: RoutableFeed<T>; enabled: boolean };

/** Resource projection of the committed routes; one feed per distinct source. */
export class FeedRouter<T> implements RoutingRenderPort {
  private feeds = new Map<SourceId, FeedEntry<T>>();
  private readonly originals = new Map<ScreenId, T | null>();
  private routes = emptyRouting();
  private transaction: PreparedRouting | undefined;
  private preparing = false;
  private disposed = false;
  private readonly leases = new Map<string, { consumer: SourceConsumer; dispose(): void }>();

  constructor(private readonly ports: RoutingResources<T>) {
    for (const id of screenIds) {
      const screen = ports.screens.get(id);
      if (!screen) throw new Error('Trois ports écran sont requis.');
      this.originals.set(id, screen.getTexture());
    }
  }

  stats() {
    return {
      allocated: this.feeds.size,
      active: [...this.feeds.values()].filter((entry) => entry.enabled).length,
      sources: routingSources(this.routes),
      consumers: Object.fromEntries([...this.feeds.keys()].map((id) => [id, screenIds.filter((screen) => this.routes[screen] === id).length + [...this.leases.values()].filter((lease) => lease.consumer.source === id).length])),
    };
  }

  retain(consumer: SourceConsumer, signal: AbortSignal): SourceLease<T> {
    if (consumer.source === 'temporary') throw new Error('Réserver la caméra temporaire avec sa pose.');
    const id = consumer.source;
    return this.retainFeed(consumer, signal, () => this.ports.createFeed(id)).lease;
  }

  retainTemporary(owner: string, pose: TravelPose, signal: AbortSignal): TravelSourceLease<T> {
    if (!this.ports.createTemporary) throw new Error('Caméra temporaire indisponible.');
    if (this.feeds.has('temporary')) throw new Error('Un trajet possède déjà la caméra temporaire.');
    const acquired = this.retainFeed({ owner, source: 'temporary', use: 'travel', rendering: true }, signal, () => this.ports.createTemporary!(pose));
    const feed = acquired.feed as TravelFeed<T>;
    return { ...acquired.lease,
      get consumer() { return acquired.lease.consumer; },
      setPose: (pose) => { if (acquired.released()) throw new Error('Caméra temporaire libérée.'); feed.setPose(pose); },
      waitForFrame: (signal) => acquired.released() ? Promise.reject(new Error('Caméra temporaire libérée.')) : feed.waitForFrame(signal),
    };
  }

  private retainFeed(consumer: SourceConsumer, signal: AbortSignal, create: () => RoutableFeed<T>) {
    if (this.disposed) throw new Error('La régie est arrêtée.');
    if (signal.aborted) throw new Error('Transition annulée.');
    const id = consumer.source;
    const state = { consumer: Object.freeze({ ...consumer }), dispose: () => undefined as void };
    this.checkLeaseBudget([...this.sourceConsumers(), state.consumer], consumer.use);
    if (!this.feeds.has(id)) {
      const feed = create();
      void feed.ready.catch(() => undefined);
      this.feeds.set(id, { feed, enabled: true });
    }
    const entry = this.feeds.get(id)!;
    const lifetime = new AbortController();
    let released = false;
    state.dispose = () => {
      if (released) return;
      released = true;
      signal.removeEventListener('abort', state.dispose);
      lifetime.abort();
      this.leases.delete(consumer.owner);
      this.refreshSource(id);
    };
    this.leases.set(consumer.owner, state);
    this.refreshSource(id);
    signal.addEventListener('abort', state.dispose, { once: true });
    const ready = abortable(entry.feed.ready, lifetime.signal);
    void ready.catch(state.dispose);
    const lease: SourceLease<T> = {
      texture: entry.feed.texture, ready, get consumer() { return state.consumer; }, dispose: state.dispose,
      setRenderingEnabled: (rendering) => {
        if (released) return;
        const next = Object.freeze({ ...state.consumer, rendering });
        this.checkLeaseBudget([...this.sourceConsumers().filter((item) => item.owner !== consumer.owner), next], consumer.use);
        state.consumer = next;
        this.refreshSource(id);
      },
    };
    return { lease, feed: entry.feed, released: () => released };
  }

  private checkLeaseBudget(consumers: SourceConsumer[], use: SourceConsumer['use']) {
    const context = consumers.some((item) => item.use === 'travel') ? 'travel' : use === 'preview' ? 'preview' : 'transition';
    sourceBudget(consumers, context);
  }

  /** Keeps every old source live until the composition has been presented. */
  async prepareTransition(plan: TransitionPlan, composition: TransitionCompositionPort<T>, signal: AbortSignal): Promise<PreparedTransition> {
    if (this.disposed || signal.aborted) throw new Error('Transition annulée.');
    if (this.preparing || this.leases.size) throw new Error('Une opération de diffusion est déjà en préparation.');
    this.preparing = true;
    const leases: SourceLease<T>[] = [];
    const textures = new Map(screenIds.map((id) => [id, this.ports.screens.get(id)!.getTexture()]));
    let visual: PreparedTransition | undefined;
    let settled = false;
    let changed = false;
    let presented = false;
    const release = () => {
      signal.removeEventListener('abort', rollback);
      leases.forEach((lease) => lease.dispose());
      this.preparing = false;
      this.transaction = undefined;
    };
    const rollback = () => {
      if (settled) return;
      settled = true;
      try {
        visual?.rollback();
        if (changed) for (const [id, texture] of textures) this.ports.screens.get(id)!.setTexture(texture);
      } finally { release(); }
    };
    const session: PreparedTransition = {
      render: (frame) => {
        if (settled || this.disposed) throw new Error('Transition annulée.');
        changed = true;
        return visual!.render(frame);
      },
      commit: async () => {
        if (settled || this.disposed) throw new Error('Transition annulée.');
        changed = true;
        for (const step of plan.steps) this.ports.screens.get(step.screen)!.setTexture(this.feeds.get(plan.destination)!.feed.texture);
        await visual!.commit();
        if (settled || this.disposed) throw new Error('Transition annulée.');
        presented = true;
      },
      complete: () => {
        if (settled) return;
        if (!presented) throw new Error('Présenter la transition avant validation.');
        visual!.complete();
        this.routes = { ...plan.after };
        settled = true;
        release();
        for (const id of [...this.feeds.keys()]) this.refreshSource(id);
      },
      rollback,
    };
    this.transaction = session;
    signal.addEventListener('abort', rollback, { once: true });
    try {
      for (const id of plan.participants) leases.push(this.retain({ owner: `transition-${id}`, source: id, use: plan.settings.mode === 'virtual-travel' ? 'travel' : 'transition', rendering: true }, signal));
      await abortable(Promise.all(leases.map((lease) => lease.ready)), signal);
      const pairs = new Map<ScreenId, TransitionSourcePair<T>>(plan.steps.map((step) => [step.screen, {
        from: textures.get(step.screen)!, to: this.feeds.get(plan.destination)!.feed.texture,
      }]));
      visual = await abortable(composition.prepare(plan, pairs, signal), signal, (late) => late.rollback());
      if (settled || this.disposed) throw new Error('Transition annulée.');
      return session;
    } catch (error) { rollback(); throw error; }
  }

  private sourceConsumers(): SourceConsumer[] {
    return [...screenIds.flatMap((id): SourceConsumer[] => this.routes[id] === null ? [] : [{ owner: `screen-${id}`, source: this.routes[id]!, use: 'live', rendering: this.feeds.get(this.routes[id]!)?.enabled ?? true }]), ...[...this.leases.values()].map((lease) => lease.consumer)];
  }
  private refreshSource(id: SourceId): void {
    const entry = this.feeds.get(id);
    if (!entry) return;
    const leases = [...this.leases.values()].filter((lease) => lease.consumer.source === id);
    const live = id !== 'temporary' && routingSources(this.routes).includes(id);
    if (!live && !leases.length) { this.feeds.delete(id); entry.feed.dispose(); return; }
    const enabled = live || leases.some((lease) => lease.consumer.rendering);
    if (entry.enabled !== enabled) { entry.feed.setRenderingEnabled(enabled); entry.enabled = enabled; }
  }

  async replaceFeeds(createFeed: RoutingResources<T>['createFeed']): Promise<void> {
    const transaction = await this.prepare(this.routes, undefined, createFeed);
    try {
      await transaction.commit();
      transaction.complete();
    } catch (error) {
      transaction.rollback();
      throw error;
    }
  }

  async prepare(next: RoutingTable, signal?: AbortSignal, replacement?: RoutingResources<T>['createFeed']): Promise<PreparedRouting> {
    if (this.disposed) throw new Error('La régie est arrêtée.');
    if (signal?.aborted) throw new Error('Transition annulée.');
    if (this.preparing) throw new Error('Une coupe est déjà en préparation.');
    if (this.leases.size) throw new Error('Libérer les consommateurs temporaires avant une coupe.');
    this.preparing = true;
    const desired = routingSources(next);
    const previousFeeds = this.feeds;
    const candidates = replacement ? new Map<SourceId, FeedEntry<T>>() : previousFeeds;
    const added: CameraId[] = [];
    const suspended: CameraId[] = [];
    const previousTextures = new Map<ScreenId, T | null>();
    let presentation: ReturnType<RoutingResources<T>['waitForPresentation']> | undefined;
    let changed = false;
    let settled = false;
    let presented = false;
    const remove = (pool: typeof candidates, id: SourceId) => {
      const entry = pool.get(id);
      if (!entry) return;
      pool.delete(id);
      entry.feed.dispose();
    };
    const rollback = () => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', rollback);
      presentation?.dispose();
      if (changed) for (const [id, texture] of previousTextures) this.ports.screens.get(id)!.setTexture(texture);
      added.forEach((id) => remove(candidates, id));
      if (!this.disposed) for (const id of suspended) {
        const entry = this.feeds.get(id);
        if (entry) { entry.feed.setRenderingEnabled(true); entry.enabled = true; }
      }
      this.preparing = false;
      this.transaction = undefined;
    };
    const transaction: PreparedRouting = {
      commit: async () => {
        if (settled || this.disposed) throw new Error('Coupe annulée.');
        // All setters run synchronously between GPU frames: no partial visual cut.
        for (const id of screenIds) previousTextures.set(id, this.ports.screens.get(id)!.getTexture());
        changed = true;
        for (const id of screenIds) {
          const texture = next[id] === null ? this.originals.get(id)! : candidates.get(next[id]!)!.feed.texture;
          if (this.ports.screens.get(id)!.getTexture() !== texture) this.ports.screens.get(id)!.setTexture(texture);
        }
        presentation = this.ports.waitForPresentation();
        await presentation.ready;
        if (settled || this.disposed) throw new Error('Coupe annulée.');
        presented = true;
      },
      complete: () => {
        if (settled) return;
        if (!presented) throw new Error('La coupe doit être présentée avant validation.');
        settled = true;
        signal?.removeEventListener('abort', rollback);
        presentation?.dispose();
        this.routes = { ...next };
        for (const id of [...previousFeeds.keys()]) if (replacement || id === 'temporary' || !desired.includes(id)) remove(previousFeeds, id);
        this.feeds = candidates;
        this.preparing = false;
        this.transaction = undefined;
      },
      rollback,
    };
    this.transaction = transaction;
    signal?.addEventListener('abort', rollback, { once: true });
    try {
      const missing = desired.filter((id) => !candidates.has(id));
      // Keep old textures readable, but free render slots while warming replacements.
      for (const [id, entry] of this.feeds) {
        if (this.stats().active + missing.length <= 3) break;
        if (id !== 'temporary' && entry.enabled && (replacement || !desired.includes(id))) {
          entry.feed.setRenderingEnabled(false); entry.enabled = false; suspended.push(id);
        }
      }
      if (this.stats().active + missing.length > 3) throw new Error('Budget de captation dépassé.');
      for (const id of missing) {
        const feed = (replacement ?? this.ports.createFeed)(id);
        // Own rejected preparation promises immediately, including cancellation.
        void feed.ready.catch(() => undefined);
        candidates.set(id, { feed, enabled: true });
        added.push(id);
      }
      const ready = Promise.all(desired.map((id) => candidates.get(id)!.feed.ready));
      if (signal) await abortable(ready, signal); else await ready;
      if (this.disposed || settled) throw new Error('Coupe annulée.');
      return transaction;
    } catch (error) { rollback(); throw error; }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.transaction?.rollback();
    for (const lease of [...this.leases.values()]) lease.dispose();
    for (const [id, texture] of this.originals) this.ports.screens.get(id)!.setTexture(texture);
    for (const entry of this.feeds.values()) entry.feed.dispose();
    this.feeds.clear();
  }
}
