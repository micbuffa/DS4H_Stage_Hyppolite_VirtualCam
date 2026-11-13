export const maxShowDeltaSeconds = 0.1;

export class ShowClock {
  private elapsed = 0;
  paused = false;

  toggle(): void { this.paused = !this.paused; }

  advance(deltaSeconds: number, visible = true): number {
    if (!this.paused && visible && Number.isFinite(deltaSeconds) && deltaSeconds > 0) {
      this.elapsed += Math.min(deltaSeconds, maxShowDeltaSeconds);
    }
    return this.elapsed;
  }

  get time(): number { return this.elapsed; }
}

export function performerMotion(seconds: number, index: number) {
  const phase = seconds * (index === 3 ? 10 : 5.4) + index * 0.8;
  return {
    lift: (1 - Math.cos(phase)) * 0.035,
    yaw: 0.1 * Math.sin(phase * 0.5),
    roll: 0.07 * Math.sin(phase),
  };
}

export function crowdLift(seconds: number, index: number): number {
  return 0.07 * (1 - Math.cos(seconds * 5.4 + index * 0.17));
}

export const spotlights = [
  { x: -8, rgb: [1, 0.22, 0.39], targetX: -5.8 },
  { x: -3, rgb: [0.27, 0.68, 1], targetX: -2 },
  { x: 3, rgb: [0.71, 0.36, 1], targetX: 2 },
  { x: 8, rgb: [1, 0.68, 0.24], targetX: 5.8 },
] as const;

export function spotlightMotion(seconds: number, index: number) {
  const phase = seconds * 1.1 + index * 1.4;
  return {
    x: spotlights[index].targetX + 1.65 * Math.sin(phase),
    intensity: 0.46 + 0.16 * Math.cos(phase),
  };
}
