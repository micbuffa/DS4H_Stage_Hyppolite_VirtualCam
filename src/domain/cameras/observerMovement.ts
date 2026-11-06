export type MoveDirection = 'forward' | 'backward' | 'left' | 'right';

export function movementKey(key: string): MoveDirection | undefined {
  switch (key.toLowerCase()) {
    case 'z': case 'arrowup': return 'forward';
    case 's': case 'arrowdown': return 'backward';
    case 'q': case 'arrowleft': return 'left';
    case 'd': case 'arrowright': return 'right';
  }
}

/** Ground-plane translation relative to the viewing azimuth, in metres. */
export function observerTranslation(directions: ReadonlySet<MoveDirection>, alpha: number, deltaSeconds: number) {
  const forward = Number(directions.has('forward')) - Number(directions.has('backward'));
  const right = Number(directions.has('right')) - Number(directions.has('left'));
  const length = Math.hypot(forward, right);
  const distance = 10 * Math.min(Math.max(deltaSeconds, 0), 0.1);
  if (!length || !Number.isFinite(alpha) || !Number.isFinite(distance)) return { x: 0, z: 0 };
  return {
    x: (-Math.cos(alpha) * forward - Math.sin(alpha) * right) * distance / length,
    z: (-Math.sin(alpha) * forward + Math.cos(alpha) * right) * distance / length,
  };
}
