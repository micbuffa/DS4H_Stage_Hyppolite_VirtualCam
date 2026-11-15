/** Samples include visibility changes, even when rendering is suspended. */
export class TransitionClock {
  private previous: number | undefined;
  private visible = false;
  private elapsed = 0;

  sample(nowMs: number, visible: boolean): number {
    if (!Number.isFinite(nowMs) || (this.previous !== undefined && nowMs < this.previous)) throw new Error('Horloge de transition invalide.');
    if (this.previous !== undefined && this.visible) this.elapsed += nowMs - this.previous;
    this.previous = nowMs;
    this.visible = visible;
    return this.elapsed;
  }
}
