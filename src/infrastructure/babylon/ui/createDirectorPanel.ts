import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Scene } from '@babylonjs/core/scene';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { panelButtons, panelPlacement } from '../../../domain/direction/panelLayout';
import type { PanelButtonId } from '../../../domain/direction/panelLayout';
import type { DirectorPanelModel } from '../../../application/presentation/directorPanelModel';
import { createModelGroup } from '../models/modelGroup';
import { createPanelLabel } from './panelLabel';
import type { PanelLabel, PanelLabelStyle } from './panelLabel';

interface PanelFace { label: PanelLabel; signature: string }

export function createDirectorPanel(scene: Scene, labels = createPanelLabel) {
  const group = createModelGroup(scene, 'director-panel');
  group.root.position.set(...panelPlacement.position); group.root.rotation.x = panelPlacement.tilt;
  const boardMaterial = group.material('case', '#13232d');
  const keyMaterial = group.material('keys', '#355567');
  const board = CreateBox('director-panel-case', { width: panelPlacement.width, height: panelPlacement.height, depth: 0.35 }, scene);
  board.parent = group.root; board.material = boardMaterial;
  const tag = (mesh: Mesh, id?: PanelButtonId) => { mesh.layerMask = 2; mesh.metadata = { category: 'panel', buttonId: id }; };
  tag(board);
  const face = (name: string, x: number, y: number, width: number, height: number, z: number) => {
    const plane = CreatePlane(`panel-${name}-text`, { width, height }, scene);
    plane.parent = group.root; plane.position.set(x, y, z); plane.isPickable = false; tag(plane);
    const material = group.material(`${name}-face`, '#000000');
    material.disableLighting = true; material.diffuseColor = Color3.Black(); material.emissiveColor = Color3.Black();
    const label = labels(scene, `panel-${name}-label`, Math.round(width * 128), Math.round(height * 128));
    material.emissiveTexture = group.ownTexture(label.texture); plane.material = material;
    return { label, signature: '' };
  };
  const paint = (entry: PanelFace, style: PanelLabelStyle) => {
    const signature = JSON.stringify(style);
    if (signature === entry.signature) return;
    entry.signature = signature; entry.label.draw(style);
  };
  const text = (name: string, x: number, y: number, width: number, height: number, lines: string[], large = false) => {
    const label = face(name, x, y, width, height, -0.18);
    paint(label, { lines, background: '#13232d', color: '#c9e4ec', large }); return label;
  };
  text('title', 0, 3.65, 12.2, 0.5, ['RÉGIE · CONCERT LIVE'], true);
  text('cameras-heading', -3.2, 3.05, 5.4, 0.4, ['CAMÉRAS']);
  text('screens-heading', 2.7, 3.05, 6.1, 0.4, ['ÉCRANS CIBLES']);
  const selection = text('selection', -3.2, -1.62, 5.4, 0.5, ['Sélection : C1']);
  const routes = text('routes', -3.2, -2.55, 5.4, 1.12, ['Sans signal']);
  const message = text('message', 2.7, -3.22, 6.1, 1.15, ['Préparation…']);
  const buttons = new Map<PanelButtonId, Mesh>();
  const buttonLabels = new Map<PanelButtonId, PanelFace>();
  for (const definition of panelButtons) {
    const mesh = CreateBox(`panel-button-${definition.id}`, { width: definition.width, height: definition.height, depth: 0.18 }, scene);
    mesh.parent = group.root; mesh.position.set(definition.x, definition.y, -0.23); mesh.material = keyMaterial; tag(mesh, definition.id);
    buttons.set(definition.id, mesh);
    buttonLabels.set(definition.id, face(definition.id, definition.x, definition.y, definition.width * 0.95, definition.height * 0.9, -0.325));
  }
  let hovered: PanelButtonId | null = null;
  let model: DirectorPanelModel | undefined;
  const render = (next: DirectorPanelModel) => {
    model = next;
    for (const button of next.buttons) {
      paint(buttonLabels.get(button.id)!, {
        lines: [button.label, ...(button.detail ? [button.detail] : [])],
        background: !button.enabled ? '#263039' : button.selected ? '#705324' : button.id === 'broadcast' ? '#9b511c' : '#203e50',
        color: !button.enabled ? '#82939e' : '#f0f7fa',
        border: hovered === button.id ? '#ffffff' : button.selected ? '#ffd16a' : button.onAir ? '#6ee7c4' : '#527e91',
        large: button.id.startsWith('camera-'),
      });
      buttons.get(button.id)!.metadata.enabled = button.enabled;
    }
    paint(selection, { lines: [next.selected], background: '#13232d', color: '#ffd16a' });
    paint(routes, { lines: next.routes, background: '#13232d', color: '#a5efd7' });
    const hoverReason = next.buttons.find((button) => button.id === hovered)?.reason;
    paint(message, { lines: [hoverReason || next.message], maxCharacters: 40, background: '#13232d', color: next.error ? '#ffc0b4' : '#c9e4ec' });
  };
  return {
    root: group.root, board, buttons, render,
    hover(id: PanelButtonId | null) { if (hovered === id) return; hovered = id; if (model) render(model); },
    dispose: () => group.dispose(),
  };
}
