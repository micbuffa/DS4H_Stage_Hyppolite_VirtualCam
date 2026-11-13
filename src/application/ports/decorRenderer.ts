import type { DecorDocument, DecorObject } from '../../domain/decors/decorDocument';
export type DecorTool = 'move' | 'rotate' | 'scale' | 'none';
export interface DecorRenderer {
  sync(document: DecorDocument): void;
  select(id: string | undefined, tool: DecorTool): void;
  resetView(): void;
  ready: Promise<void>;
  dispose(): void;
}
export interface DecorCallbacks {
  select(id: string | undefined): void;
  transform(id: string, value: Pick<DecorObject, 'position' | 'rotation' | 'scale'>): void;
}
