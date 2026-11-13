import { panelPlacement } from '../direction/panelLayout';

export interface AudienceOptions { count: number; seed: number }
export interface SpectatorPlacement {
  x: number;
  z: number;
  yaw: number;
  scale: number;
  style: number;
}

export const audienceDefaults: Readonly<AudienceOptions> = Object.freeze({ count: 144, seed: 2026 });
export const audienceStyleCount = 6;

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function layoutAudience({ count, seed }: AudienceOptions): SpectatorPlacement[] {
  if (!Number.isSafeInteger(count) || count < 0) throw new RangeError('Effectif du public invalide.');
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('Graine du public invalide.');
  if (count === 0) return [];

  const random = seededRandom(seed);
  const places: SpectatorPlacement[] = [];
  const [panelX, , panelZ] = panelPlacement.position;
  const panelHalfDepth = Math.sin(panelPlacement.tilt) * panelPlacement.height / 2 + 0.4;
  for (let row = 0; row < 15; row++) {
    for (let column = 0; column < 20; column++) {
      const x = (column - 9.5) * 1.62 + (row % 2 ? 0.38 : -0.38) + (random() - 0.5) * 0.34;
      const z = -2.7 - row * 1.72 + (random() - 0.5) * 0.38;
      // Reserve a central aisle and the full ground projection of the tilted panel.
      if (Math.abs(x) < 1.45) continue;
      if (Math.abs(x - panelX) < panelPlacement.width / 2 + 1 && Math.abs(z - panelZ) < panelHalfDepth + 1) continue;
      places.push({ x, z, yaw: (random() - 0.5) * 0.48, scale: 0.87 + random() * 0.26, style: Math.floor(random() * audienceStyleCount) });
    }
  }
  if (count > places.length) throw new RangeError(`La zone du public comporte ${places.length} places pour ${count} spectateurs.`);
  // Shuffle the available places so smaller populations still occupy the whole area.
  for (let index = places.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [places[index], places[other]] = [places[other], places[index]];
  }
  return places.slice(0, count);
}
