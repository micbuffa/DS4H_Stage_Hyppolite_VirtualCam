import { emptyRouting, routingSources, screenIds } from '../../domain/direction/screenRouting';
import type { RoutingTable, ScreenId } from '../../domain/direction/screenRouting';
import type { CameraId } from '../../domain/cameras/cameraDefinition';
import type { PreparedRouting, RoutableFeed, RoutingRenderPort, RoutingResources } from '../ports/routing';

/** Resource projection of the committed routes; one feed per distinct source. */
export class FeedRouter<T> implements RoutingRenderPort {
  private feeds = new Map<CameraId, { feed: RoutableFeed<T>; enabled: boolean }>();
  private readonly originals = new Map<ScreenId, T | null>();
  private routes = emptyRouting();
  private transaction: PreparedRouting | undefined;
  private preparing = false;
  private disposed = false;

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
      consumers: Object.fromEntries([...this.feeds.keys()].map((id) => [id, screenIds.filter((screen) => this.routes[screen] === id).length])),
    };
  }

  async replaceFeeds(createFeed: RoutingResources<T>['createFeed']): Promise<void> {
    const transaction = await this.prepare(this.routes, createFeed);
    try {
      await transaction.commit();
      transaction.complete();
    } catch (error) {
      transaction.rollback();
      throw error;
    }
  }

  async prepare(next: RoutingTable, replacement?: RoutingResources<T>['createFeed']): Promise<PreparedRouting> {
    if (this.disposed) throw new Error('La régie est arrêtée.');
    if (this.preparing) throw new Error('Une coupe est déjà en préparation.');
    this.preparing = true;
    const desired = routingSources(next);
    const previousFeeds = this.feeds;
    const candidates = replacement ? new Map<typeof desired[number], { feed: RoutableFeed<T>; enabled: boolean }>() : previousFeeds;
    const added: CameraId[] = [];
    const suspended: CameraId[] = [];
    const previousTextures = new Map<ScreenId, T | null>();
    let presentation: ReturnType<RoutingResources<T>['waitForPresentation']> | undefined;
    let changed = false;
    let settled = false;
    let presented = false;
    const remove = (pool: typeof candidates, id: CameraId) => {
      const entry = pool.get(id);
      if (!entry) return;
      pool.delete(id);
      entry.feed.dispose();
    };
    const rollback = () => {
      if (settled) return;
      settled = true;
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
        this.routes = { ...next };
        for (const id of [...previousFeeds.keys()]) if (replacement || !desired.includes(id)) remove(previousFeeds, id);
        this.feeds = candidates;
        this.preparing = false;
        this.transaction = undefined;
      },
      rollback,
    };
    this.transaction = transaction;
    try {
      const missing = desired.filter((id) => !candidates.has(id));
      // Keep old textures readable, but free render slots while warming replacements.
      for (const [id, entry] of this.feeds) {
        if (this.stats().active + missing.length <= 3) break;
        if (entry.enabled && (replacement || !desired.includes(id))) {
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
      await Promise.all(desired.map((id) => candidates.get(id)!.feed.ready));
      if (this.disposed || settled) throw new Error('Coupe annulée.');
      return transaction;
    } catch (error) { rollback(); throw error; }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.transaction?.rollback();
    for (const [id, texture] of this.originals) this.ports.screens.get(id)!.setTexture(texture);
    for (const entry of this.feeds.values()) entry.feed.dispose();
    this.feeds.clear();
  }
}
