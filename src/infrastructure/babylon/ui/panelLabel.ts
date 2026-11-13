import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { BaseTexture } from '@babylonjs/core/Materials/Textures/baseTexture';
import type { Scene } from '@babylonjs/core/scene';
export interface PanelLabelStyle { lines: string[]; background: string; color: string; border?: string; large?: boolean; maxCharacters?: number }
export interface PanelLabel { texture: BaseTexture; draw(style: PanelLabelStyle): void }

export function createPanelLabel(scene: Scene, name: string, width: number, height: number): PanelLabel {
  const texture = new DynamicTexture(name, { width, height }, scene, false, Texture.BILINEAR_SAMPLINGMODE);
  const context = texture.getContext() as CanvasRenderingContext2D;
  return { texture, draw(style) {
    context.fillStyle = style.background; context.fillRect(0, 0, width, height);
    if (style.border) { context.strokeStyle = style.border; context.lineWidth = 6; context.strokeRect(3, 3, width - 6, height - 6); }
    context.fillStyle = style.color; context.textAlign = 'center';
    const lines = style.lines.flatMap((line) => line.split('\n')).flatMap((line) => {
      if (!style.maxCharacters) return [line];
      const wrapped: string[] = [''];
      for (const word of line.split(' ')) {
        if (wrapped.at(-1)!.length + word.length > style.maxCharacters) wrapped.push(word);
        else wrapped[wrapped.length - 1] += `${wrapped.at(-1) ? ' ' : ''}${word}`;
      }
      return wrapped;
    });
    const size = Math.min(height / (lines.length + 0.6), width / Math.max(1, ...lines.map((line) => line.length)) * 1.6);
    const lineHeight = Math.min(height / lines.length, size * 1.3);
    context.font = `${style.large ? 700 : 500} ${Math.floor(size)}px Arial`;
    context.textBaseline = 'middle';
    if (style.large) {
      context.font = `700 ${Math.floor(height * 0.48)}px Arial`;
      context.fillText(lines[0], width / 2, lines.length > 1 ? height * 0.3 : height * 0.5, width - 16);
      context.font = `600 ${Math.floor(height * 0.18)}px Arial`;
      lines.slice(1).forEach((line, index) => context.fillText(line, width / 2, height * (0.65 + index * 0.21), width - 16));
    } else lines.forEach((line, index) => context.fillText(line, width / 2, height / 2 + (index - (lines.length - 1) / 2) * lineHeight, width - 16));
    texture.update(true);
  } };
}
