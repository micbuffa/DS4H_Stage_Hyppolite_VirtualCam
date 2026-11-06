export interface ScreenDefinition {
  id: 1 | 2 | 3;
  name: string;
  width: number;
  height: number;
  position: Readonly<{ x: number; y: number; z: number }>;
}

export function validateScreens(screens: readonly ScreenDefinition[]): void {
  const ids = new Set<number>();
  if (screens.length !== 3) throw new Error('Trois écrans sont requis.');
  for (const screen of screens) {
    if (![1, 2, 3].includes(screen.id) || ids.has(screen.id)) throw new Error('Identifiant écran invalide ou dupliqué.');
    ids.add(screen.id);
    if (!screen.name.trim()) throw new Error('Chaque écran doit avoir un nom.');
    if (![screen.width, screen.height].every((value) => Number.isFinite(value) && value > 0)) throw new Error('Dimensions écran invalides.');
    if (Math.abs(screen.width / screen.height - 16 / 9) > 0.001) throw new Error('Le format écran doit être 16:9.');
    if (!Object.values(screen.position).every(Number.isFinite)) throw new Error('Position écran invalide.');
  }
}
