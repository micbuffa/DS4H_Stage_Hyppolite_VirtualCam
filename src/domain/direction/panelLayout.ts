export type PanelButtonId = SequenceButtonId | `camera-${number}` | `screen-${number}` | 'all' | 'broadcast' | 'move' | 'rotate' | 'fov-minus' | 'fov-plus' | 'aim' | 'reset' | 'aids' | 'pause' | 'home' | 'help' | 'transition-page' | 'transition-prev' | 'transition-next' | 'duration-minus' | 'duration-plus' | 'wipe-direction' | 'cancel-transition' | 'grid-size' | 'grid-strength' | 'seed-minus' | 'seed-plus' | 'preview-toggle' | 'preview-test' | 'preview-cancel' | 'travel-point' | 'travel-add' | 'travel-remove' | 'travel-axis' | 'travel-minus' | 'travel-plus' | 'travel-back' | 'travel-cancel';
export interface PanelButtonDefinition { id: PanelButtonId; x: number; y: number; width: number; height: number }
export type SequenceButtonId = 'sequence-page' | 'sequence-mode' | 'sequence-order' | 'delay-minus' | 'delay-plus' | 'sequence-back' | 'sequence-cancel';
export const panelPlacement = { position: [9.3, 3.6, -12] as const, tilt: 0.35, width: 13, height: 8.2 };
export const previewPlacement = { x: -13.3, screenY: 1.45, width: 3.8 } as const;
export const panelButtons: readonly PanelButtonDefinition[] = [
  ...Array.from({ length: 9 }, (_, index) => ({ id: `camera-${index + 1}` as PanelButtonId, x: -5 + index % 3 * 1.8, y: 2.15 - Math.floor(index / 3) * 1.4, width: 1.62, height: 1.22 })),
  ...Array.from({ length: 3 }, (_, index) => ({ id: `screen-${index + 1}` as PanelButtonId, x: 0.6 + index * 2.05, y: 2.3, width: 1.87, height: 0.85 })),
  ...(['all', 'broadcast', 'move', 'rotate', 'fov-minus', 'fov-plus', 'aim', 'reset', 'aids', 'pause'] as const).map((id, index) => ({ id, x: 1.05 + index % 2 * 3.15, y: 1.25 - Math.floor(index / 2) * 0.84, width: 2.95, height: 0.65 })),
  { id: 'home', x: -4.55, y: -3.55, width: 2.5, height: 0.65 },
  { id: 'help', x: -1.75, y: -3.55, width: 2.5, height: 0.65 },
  { id: 'transition-page', x: 4.2, y: 3.65, width: 3.05, height: 0.5 },
  { id: 'sequence-page', x: 1.05, y: 3.65, width: 2.95, height: 0.5 },
  ...(['sequence-mode', 'sequence-order', 'delay-minus', 'delay-plus', 'sequence-back', 'sequence-cancel'] as const).map((id, index) => ({ id, x: 1.05 + index % 2 * 3.15, y: 0.41 - Math.floor(index / 2) * 0.84, width: 2.95, height: 0.65 })),
  ...(['transition-prev', 'transition-next', 'duration-minus', 'duration-plus', 'wipe-direction', 'cancel-transition'] as const).map((id, index) => ({ id, x: 1.05 + index % 2 * 3.15, y: 0.41 - Math.floor(index / 2) * 0.84, width: 2.95, height: 0.65 })),
  ...(['grid-size', 'grid-strength', 'seed-minus', 'seed-plus'] as const).map((id, index) => ({ id, x: 1.05 + index % 2 * 3.15, y: 0.41 - Math.floor(index / 2) * 0.84, width: 2.95, height: 0.65 })),
  ...(['travel-point', 'travel-add', 'travel-remove', 'travel-axis', 'travel-minus', 'travel-plus', 'travel-back', 'travel-cancel'] as const).map((id, index) => ({ id, x: 1.05 + index % 2 * 3.15, y: 0.41 - Math.floor(index / 2) * 0.84, width: 2.95, height: 0.65 })),
  ...(['preview-toggle', 'preview-test', 'preview-cancel'] as const).map((id, index) => ({ id, x: previewPlacement.x, y: -0.9 - index * 0.85, width: previewPlacement.width, height: 0.65 })),
];
