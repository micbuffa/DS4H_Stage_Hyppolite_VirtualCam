import type { PanelButtonId } from './panelLayout';

/** A pointer-down is consumed immediately; one matching release activates once. */
export class PanelGesture {
  private start: { pointer: number; button: PanelButtonId | null; x: number; y: number; moved: boolean } | null = null;
  begin(pointer: number, button: PanelButtonId | null, x: number, y: number): boolean {
    if (this.start) return false;
    this.start = { pointer, button, x, y, moved: false }; return true;
  }
  owns(pointer: number): boolean { return this.start?.pointer === pointer; }
  move(pointer: number, x: number, y: number): void {
    if (this.start?.pointer === pointer && Math.hypot(x - this.start.x, y - this.start.y) > 7) this.start.moved = true;
  }
  release(pointer: number, button: PanelButtonId | null): PanelButtonId | null {
    if (!this.owns(pointer)) return null;
    const start = this.start!; this.start = null;
    return !start.moved && start.button === button ? button : null;
  }
  cancel(): void { this.start = null; }
}
