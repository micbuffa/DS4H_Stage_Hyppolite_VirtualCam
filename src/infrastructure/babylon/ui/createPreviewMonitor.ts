import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { BaseTexture } from '@babylonjs/core/Materials/Textures/baseTexture';
import type { PreviewViewPort } from '../../../application/ports/preview';
import { abortable } from '../../../application/commands/abortable';
import { createModelGroup } from '../models/modelGroup';
import { createTransitionComposition } from '../rendering/createTransitionComposition';
import { watchSceneReadiness } from '../engine/watchSceneReadiness';
import { createPanelLabel } from './panelLabel';
import type { ScreenId } from '../../../domain/direction/screenRouting';
import { previewPlacement } from '../../../domain/direction/panelLayout';
import type { TransitionCompositionPort } from '../../../application/ports/transition';
import type { TransitionSurfaces } from '../rendering/createTransitionComposition';

export function createPreviewMonitor(scene: Scene, parent: TransformNode, labels = createPanelLabel, composition = createTransitionComposition, referenceTexture: (id: ScreenId) => BaseTexture | null = () => null,
  travel?: (surfaces: TransitionSurfaces) => TransitionCompositionPort<BaseTexture>) {
  const group = createModelGroup(scene, 'preview-monitor'); group.root.parent = parent;
  const tag = (mesh: ReturnType<typeof CreatePlane>) => { mesh.layerMask = 2; mesh.isPickable = false; mesh.metadata = { category: 'preview-surface' }; };
  const board = CreateBox('preview-monitor-case', { width: 4.3, height: 6.3, depth: 0.35 }, scene);
  board.parent = group.root; board.position.set(previewPlacement.x, 0, 0); board.material = group.material('case', '#13232d'); tag(board);
  board.isPickable = true; board.metadata = { category: 'panel' };
  const bridgeLeft = previewPlacement.x + 2.15, bridgeRight = -6.5;
  const bridge = CreateBox('preview-monitor-bridge', { width: bridgeRight - bridgeLeft, height: 0.3, depth: 0.35 }, scene);
  bridge.parent = group.root; bridge.position.set((bridgeLeft + bridgeRight) / 2, -2.95, 0); bridge.material = board.material;
  tag(bridge); bridge.isPickable = true; bridge.metadata = { category: 'panel' };
  const material = group.material('video', '#000000'); material.disableLighting = true; material.diffuseColor = Color3.Black(); material.emissiveColor = Color3.Black();
  const blank = group.ownTexture(RawTexture.CreateRGBATexture(new Uint8Array([15, 23, 30, 255]), 1, 1, scene, false, false, Texture.NEAREST_SAMPLINGMODE));
  material.emissiveTexture = blank;
  const surface = CreatePlane('preview-monitor-surface', { width: previewPlacement.width, height: previewPlacement.width * 9 / 16 }, scene);
  surface.parent = group.root; surface.position.set(previewPlacement.x, previewPlacement.screenY, -0.24); surface.material = material; tag(surface);
  const caption = (name: string, y: number, height: number) => {
    const mesh = CreatePlane(`preview-monitor-${name}`, { width: 3.8, height }, scene);
    mesh.parent = group.root; mesh.position.set(previewPlacement.x, y, -0.24); tag(mesh);
    const face = group.material(name, '#000000'); face.disableLighting = true; face.emissiveColor = Color3.Black(); face.diffuseColor = Color3.Black();
    const label = labels(scene, `preview-monitor-${name}-text`, 512, Math.round(height / 3.8 * 512)); face.emissiveTexture = group.ownTexture(label.texture); mesh.material = face;
    return label;
  };
  const heading = caption('heading', 2.85, 0.4); heading.draw({ lines: ['PRÉPARATION · HORS DIRECT'], background: '#13232d', color: '#a5efd7' });
  const status = caption('status', -0.1, 0.75); let previous = 'Aperçu désactivé\nHors direct';
  status.draw({ lines: previous.split('\n'), background: '#13232d', color: '#a5efd7', maxCharacters: 29 });
  let disposed = false;
  const view: PreviewViewPort<BaseTexture> = {
    supportsTravel: !!travel,
    show(texture) { if (!disposed) { material.emissiveTexture = texture ?? blank; surface.material = material; } },
    async present(signal) {
      if (disposed) throw new Error('Moniteur arrêté.');
      const presentation = watchSceneReadiness(scene);
      try { await abortable(presentation.ready, signal); } finally { presentation.dispose(); }
    },
    prepare(plan, from, to, signal) {
      if (disposed) throw new Error('Moniteur arrêté.');
      const reference = plan.steps[0].screen;
      const surfaces = { screens: [{ definition: { id: reference }, surface, material }] };
      if (plan.settings.mode === 'virtual-travel' && !travel) return Promise.reject(new Error('Test de trajet indisponible sur ce moniteur.'));
      return (plan.settings.mode === 'virtual-travel' ? travel!(surfaces) : composition(scene, surfaces))
        .prepare(plan, new Map([[reference, { from: from ?? referenceTexture(reference) ?? blank, to }]]), signal);
    },
  };
  const dispose = () => { if (disposed) return; disposed = true; scene.onDisposeObservable.remove(stopped); material.emissiveTexture = null; group.dispose(); };
  const stopped = scene.onDisposeObservable.add(dispose);
  return { ...view, surface, material, root: group.root,
    setStatus(text: string) { if (!disposed && text !== previous) { previous = text; status.draw({ lines: text.split('\n'), background: '#13232d', color: '#a5efd7', maxCharacters: 29 }); } }, dispose };
}
