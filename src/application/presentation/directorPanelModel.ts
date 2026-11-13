import type { CameraSnapshot } from '../../domain/cameras/cameraRegistry';
import type { DirectorSnapshot } from '../commands/routingDirector';
import type { EditingSnapshot } from '../commands/cameraEditor';
import { panelButtons } from '../../domain/direction/panelLayout';
import type { PanelButtonId } from '../../domain/direction/panelLayout';

export interface PanelButtonState { id: PanelButtonId; label: string; detail: string; enabled: boolean; selected: boolean; onAir: boolean; reason: string }
export interface DirectorPanelModel {
  buttons: PanelButtonState[];
  selected: string;
  routes: string[];
  message: string;
  error: boolean;
  helpVisible: boolean;
}
export function directorPanelModel(cameras: CameraSnapshot, direction: DirectorSnapshot, editing: EditingSnapshot, helpVisible: boolean, commandError: string | null, paused?: boolean): DirectorPanelModel {
  const camera = cameras.cameras.find((entry) => entry.id === cameras.selectedId)!;
  const targets = direction.targets.join(', ') || 'aucune';
  const names: Partial<Record<PanelButtonId, string>> = { all: 'TOUS LES ÉCRANS', broadcast: 'DIFFUSER', move: 'DÉPLACER', rotate: 'ORIENTER', 'fov-minus': 'FOV −', 'fov-plus': 'FOV +', aim: 'VISER LA SCÈNE', reset: 'RÉINITIALISER', aids: cameras.aidsVisible ? 'AIDES : OUI' : 'AIDES : NON', pause: paused === true ? 'REPRENDRE' : 'PAUSE', home: 'VUE RÉGIE (R)', help: helpVisible ? 'FERMER L’AIDE' : 'AIDE' };
  const buttons = panelButtons.map(({ id }): PanelButtonState => {
    let label = names[id] ?? '', detail = '', selected = false, onAir = false, reason = '';
    if (id.startsWith('camera-')) {
      const number = Number(id.slice(7));
      label = String(number); selected = cameras.selectedId === number; onAir = Object.values(direction.routes).includes(number as typeof camera.id);
      detail = [selected ? 'SÉLECTION' : '', onAir ? 'EN DIFFUSION' : ''].filter(Boolean).join('\n');
    } else if (id.startsWith('screen-')) {
      const number = Number(id.slice(7));
      selected = direction.targets.includes(number as 1 | 2 | 3);
      label = `${selected ? '✓ ' : ''}${number}`; detail = ['GAUCHE', 'DROITE', 'CENTRE'][number - 1];
    }
    if (id === 'move') selected = editing.mode === 'move';
    if (id === 'rotate') selected = editing.mode === 'rotate';
    if (id === 'aids') selected = cameras.aidsVisible;
    if (id === 'help') selected = helpVisible;
    if (id === 'broadcast') reason = direction.pending !== null ? `Préparation de C${direction.pending}…` : direction.targets.length === 0 ? 'Choisir au moins un écran.' : '';
    if (id === 'pause') {
      selected = paused === true;
      if (paused === undefined) reason = 'Animations indisponibles.';
    }
    if (id === 'fov-minus' && camera.fovDegrees <= 20) reason = 'FOV minimum : 20°.';
    if (id === 'fov-plus' && camera.fovDegrees >= 90) reason = 'FOV maximum : 90°.';
    return { id, label, detail, selected, onAir, reason, enabled: !reason };
  });
  const error = commandError ?? editing.error ?? direction.error;
  const activity = direction.pending !== null ? `Préparation de C${direction.pending}…` : editing.dragging ? 'Geste en cours · Échap annule.' : editing.mode ? `${editing.mode === 'move' ? 'Déplacement monde' : 'Rotation locale'} · Échap quitte.` : `Prêt à diffuser C${camera.id}.`;
  return {
    buttons, selected: `Sélection : C${camera.id} · FOV ${camera.fovDegrees}°`,
    routes: ([1, 2, 3] as const).map((id) => `Écran ${id} ← ${direction.routes[id] === null ? 'Sans signal' : `C${direction.routes[id]}`}`),
    message: error ?? `${activity}\nCibles : ${targets}${paused ? ' · Concert en pause' : ''}`, error: !!error, helpVisible,
  };
}
