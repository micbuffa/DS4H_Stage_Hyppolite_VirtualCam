import type { ScreenId } from './screenRouting';

/** All permutations, with the initial Centre → Gauche → Droite first. */
export const screenOrderPresets: readonly (readonly ScreenId[])[] = Object.freeze([
  [3, 1, 2], [1, 2, 3], [2, 3, 1], [3, 2, 1], [2, 1, 3], [1, 3, 2],
].map((order) => Object.freeze(order) as readonly ScreenId[]));

export function nextScreenOrder(current: readonly ScreenId[]): readonly ScreenId[] {
  const index = screenOrderPresets.findIndex((order) => order.every((screen, i) => screen === current[i]));
  return screenOrderPresets[(index + 1) % screenOrderPresets.length];
}
