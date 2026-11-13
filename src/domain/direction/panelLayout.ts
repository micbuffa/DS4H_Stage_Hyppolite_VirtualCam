export type PanelButtonId = `camera-${number}` | `screen-${number}` | 'all' | 'broadcast' | 'move' | 'rotate' | 'fov-minus' | 'fov-plus' | 'aim' | 'reset' | 'aids' | 'pause' | 'home' | 'help';
export interface PanelButtonDefinition { id: PanelButtonId; x: number; y: number; width: number; height: number }
export const panelPlacement = { position: [9.3, 3.6, -12] as const, tilt: 0.35, width: 13, height: 8.2 };
export const panelButtons: readonly PanelButtonDefinition[] = [
  ...Array.from({ length: 9 }, (_, index) => ({ id: `camera-${index + 1}` as PanelButtonId, x: -5 + index % 3 * 1.8, y: 2.15 - Math.floor(index / 3) * 1.4, width: 1.62, height: 1.22 })),
  ...Array.from({ length: 3 }, (_, index) => ({ id: `screen-${index + 1}` as PanelButtonId, x: 0.6 + index * 2.05, y: 2.3, width: 1.87, height: 0.85 })),
  ...(['all', 'broadcast', 'move', 'rotate', 'fov-minus', 'fov-plus', 'aim', 'reset', 'aids', 'pause'] as const).map((id, index) => ({ id, x: 1.05 + index % 2 * 3.15, y: 1.25 - Math.floor(index / 2) * 0.84, width: 2.95, height: 0.65 })),
  { id: 'home', x: -4.55, y: -3.55, width: 2.5, height: 0.65 },
  { id: 'help', x: -1.75, y: -3.55, width: 2.5, height: 0.65 },
];
