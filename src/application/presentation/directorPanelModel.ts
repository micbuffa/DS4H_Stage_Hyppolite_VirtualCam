import type { CameraSnapshot } from '../../domain/cameras/cameraRegistry';
import type { DirectorSnapshot } from '../commands/routingDirector';
import type { EditingSnapshot } from '../commands/cameraEditor';
import { panelButtons } from '../../domain/direction/panelLayout';
import type { PanelButtonId } from '../../domain/direction/panelLayout';
import { transitionNames, wipeNames } from '../../domain/direction/basicTransitions';
import { transitionSettings } from '../../domain/direction/transitionDefinition';
import { isGridTransition } from '../../domain/direction/gridTransitions';
import { hasGraphicSettings } from '../../domain/direction/graphicTransitions';
import type { PreviewStatus } from '../ports/preview';
import { previewLabel } from './previewPanelModel';
import { sequencePanelModel } from './sequencePanelModel';

export interface PanelButtonState { id: PanelButtonId; label: string; detail: string; enabled: boolean; selected: boolean; onAir: boolean; reason: string; visible: boolean }
export interface DirectorPanelModel {
  buttons: PanelButtonState[];
  selected: string;
  routes: string[];
  message: string;
  error: boolean;
  helpVisible: boolean;
  transitionPage: boolean;
  travelPage: boolean;
  sequencePage: boolean;
  transitionLabel: string;
  previewLabel: string;
}
export function directorPanelModel(cameras: CameraSnapshot, direction: DirectorSnapshot, editing: EditingSnapshot, helpVisible: boolean, commandError: string | null, paused?: boolean, transitionPage = false, parametersPage = false, preview?: PreviewStatus, travelEditor = { point: 0, axis: 0 }, sequencePage = false): DirectorPanelModel {
  const camera = cameras.cameras.find((entry) => entry.id === cameras.selectedId)!;
  const targets = direction.targets.join(', ') || 'aucune';
  const settings = direction.settings ?? transitionSettings();
  const transition = direction.transition;
  const busy = direction.pending !== null;
  sequencePage = sequencePage && transitionPage;
  const sequence = sequencePanelModel(direction);
  const travel = settings.mode === 'virtual-travel', travelPage = transitionPage && parametersPage && travel && !sequencePage;
  const pointIndex = Math.min(travelEditor.point, Math.max(0, settings.waypoints.length - 1)), point = settings.waypoints[pointIndex];
  const axis = ['X', 'Y', 'Z'][travelEditor.axis], coordinate = point?.[travelEditor.axis];
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
    if (id === 'broadcast') reason = busy ? `Préparation de C${direction.pending}…` : editing.dragging ? 'Terminer le geste avant de diffuser.' : direction.targets.length === 0 ? 'Choisir au moins un écran.' : '';
    if (id === 'broadcast' && direction.qualityPending) reason = 'Attendre la fin du changement de qualité.';
    if (id.startsWith('preview-')) {
      label = id === 'preview-toggle' ? preview?.enabled ? 'MASQUER L’APERÇU' : 'PRÉVISUALISER' : id === 'preview-test' ? 'TESTER L’EFFET' : 'ARRÊTER LE TEST';
      selected = id === 'preview-toggle' && !!preview?.enabled;
      reason = !preview ? 'Prévisualisation indisponible.' : busy || direction.qualityPending ? 'Aperçu suspendu pendant la diffusion ou le changement de qualité.'
        : id === 'preview-test' ? editing.dragging ? 'Terminer le geste avant de tester.' : !direction.targets.length ? 'Choisir un écran cible pour tester l’effet.' : preview.phase === 'testing' ? 'Un test est déjà en cours.' : preview.phase === 'preparing' ? 'Attendre la préparation de l’aperçu.' : ''
        : id === 'preview-cancel' && preview.phase !== 'testing' ? 'Aucun test en cours.' : '';
    }
    const effectControl = ['transition-prev', 'transition-next', 'duration-minus', 'duration-plus'].includes(id);
    const parameterControl = ['grid-size', 'grid-strength', 'seed-minus', 'seed-plus'].includes(id);
    const travelControl = id.startsWith('travel-');
    const sequenceControl = id.startsWith('sequence-') || id.startsWith('delay-');
    const transitionControl = effectControl || parameterControl || travelControl || sequenceControl || ['wipe-direction', 'cancel-transition'].includes(id);
    const editControl = ['move', 'rotate', 'fov-minus', 'fov-plus', 'aim', 'reset', 'aids', 'pause'].includes(id);
    let visible = transitionControl ? transitionPage : editControl ? !transitionPage : true;
    if (effectControl && parametersPage || parameterControl && !parametersPage) visible = false;
    if (travelControl) visible = travelPage;
    if (travelPage && (parameterControl || id === 'wipe-direction' || id === 'cancel-transition')) visible = false;
    if (sequencePage && transitionControl) visible = false;
    if (sequenceControl) visible = transitionPage && (id === 'sequence-page' || sequencePage);
    if (id === 'sequence-page') { label = sequencePage ? 'EFFETS' : 'SÉQUENCE'; selected = sequencePage; }
    if (id === 'sequence-mode') { label = settings.order === 'staggered' ? 'MODE DÉCALÉ' : 'MODE SIMULTANÉ'; selected = settings.order === 'staggered'; if (travel) reason = 'Les trajets imposent une séquence successive.'; }
    if (id === 'sequence-order') { label = 'ORDRE DES ÉCRANS'; detail = settings.screenOrder.join(' → '); if (settings.order === 'simultaneous') reason = 'Ordre utilisé en mode décalé.'; }
    if (id === 'delay-minus' || id === 'delay-plus') {
      label = id === 'delay-plus' ? 'DÉLAI + 100 ms' : 'DÉLAI − 100 ms'; detail = `${settings.delayMs} ms`;
      reason = settings.order === 'simultaneous' ? 'Délai utilisé en mode décalé.' : id === 'delay-minus' && settings.delayMs === 0 ? 'Délai minimum : 0 ms.' : id === 'delay-plus' && settings.delayMs === 1000 ? 'Délai maximum : 1 000 ms.' : '';
    }
    if (id === 'sequence-back') label = 'RETOUR EFFETS';
    if (id === 'sequence-cancel') { label = 'ANNULER TRANSITION'; if (!busy) reason = 'Aucune transition en cours.'; }
    if (id === 'transition-page') { label = transitionPage ? 'ÉDITION' : 'TRANSITIONS'; selected = transitionPage; }
    if (id === 'transition-prev') label = 'EFFET PRÉCÉDENT';
    if (id === 'transition-next') label = 'EFFET SUIVANT';
    if (id === 'duration-minus' || id === 'duration-plus') {
      label = id === 'duration-minus' ? 'DURÉE −' : 'DURÉE +';
      if (settings.mode === 'cut') reason = 'La coupe est instantanée.';
      else if (id === 'duration-minus' && settings.durationMs <= (travel ? 500 : 100)) reason = `Durée minimum : ${travel ? '500' : '100'} ms.`;
      else if (id === 'duration-plus' && settings.durationMs >= (travel ? 10000 : 3000)) reason = `Durée maximum : ${travel ? '10 000' : '3 000'} ms.`;
    }
    if (id === 'wipe-direction') {
      label = isGridTransition(settings.mode) || hasGraphicSettings(settings.mode) ? parametersPage ? 'RETOUR EFFETS' : isGridTransition(settings.mode) ? 'RÉGLAGES GRILLE' : 'RÉGLAGES EFFET' : 'DIRECTION';
      if (travel) { label = 'POINTS DU TRAJET'; detail = `${settings.waypoints.length} / 3 points`; }
      else if (settings.mode === 'wipe') detail = wipeNames[settings.parameters.direction];
      else if (!isGridTransition(settings.mode) && !hasGraphicSettings(settings.mode)) reason = settings.mode === 'split' ? 'Les cadrages sont conservés ; régler la durée du passage.' : 'Aucun réglage supplémentaire pour ce passage.';
    }
    if (id === 'grid-size') {
      label = settings.mode === 'glitch' ? 'BANDES' : settings.mode === 'luma-wipe' ? 'DÉTAIL DU MASQUE' : 'GRILLE';
      detail = settings.mode === 'glitch' ? String(settings.parameters.rows) : `${settings.parameters.columns} × ${settings.parameters.rows}`;
      if (settings.mode === 'zoom') reason = 'Le zoom utilise seulement son amplitude.';
    }
    if (id === 'grid-strength') {
      label = settings.mode === 'rolling-cubes' ? 'RELIEF' : settings.mode === 'luma-wipe' ? 'DOUCEUR' : 'AMPLITUDE'; detail = `${Math.round(settings.parameters.strength * 100)} %`;
      if (settings.mode === 'mosaic') reason = 'La mosaïque utilise seulement la grille et la graine.';
    }
    if (id === 'seed-minus' || id === 'seed-plus') {
      label = id === 'seed-minus' ? 'GRAINE −' : 'GRAINE +'; detail = String(settings.parameters.seed);
      if (settings.mode === 'zoom') reason = 'Le zoom est indépendant de la graine.';
      if (id === 'seed-minus' && settings.parameters.seed === 0 || id === 'seed-plus' && settings.parameters.seed === 0xffffffff) reason = 'Limite de graine atteinte.';
    }
    if (id === 'cancel-transition') { label = 'ANNULER TRANSITION'; if (!busy) reason = 'Aucune transition en cours.'; }
    if (travelControl) {
      const labels: Record<string, string> = { 'travel-point': 'POINT SUIVANT', 'travel-add': 'AJOUTER UN POINT', 'travel-remove': 'SUPPRIMER POINT', 'travel-axis': `AXE ${axis}`,
        'travel-minus': `${axis} − 0,5 m`, 'travel-plus': `${axis} + 0,5 m`, 'travel-back': 'RETOUR EFFETS', 'travel-cancel': 'ANNULER TRANSITION' };
      label = labels[id];
      if (id === 'travel-point') { detail = point ? `${pointIndex + 1} / ${settings.waypoints.length}` : 'Trajet direct'; if (settings.waypoints.length < 2) reason = 'Ajouter au moins deux points pour changer de point.'; }
      if (id === 'travel-add' && settings.waypoints.length >= 3) reason = 'Trois points au maximum.';
      if (['travel-remove', 'travel-axis', 'travel-minus', 'travel-plus'].includes(id) && !point) reason = 'Ajouter un point de passage.';
      if (['travel-axis', 'travel-minus', 'travel-plus'].includes(id) && point) detail = `${axis} : ${coordinate!.toFixed(2)} m`;
      if (id === 'travel-minus' && coordinate! <= [-35, 0.5, -35][travelEditor.axis] || id === 'travel-plus' && coordinate! >= [35, 25, 25][travelEditor.axis]) reason = 'Limite spatiale atteinte.';
      if (id === 'travel-cancel' && !busy) reason = 'Aucune transition en cours.';
    }
    if (id === 'pause') {
      selected = paused === true;
      if (paused === undefined) reason = 'Animations indisponibles.';
    }
    if (id === 'fov-minus' && camera.fovDegrees <= 20) reason = 'FOV minimum : 20°.';
    if (id === 'fov-plus' && camera.fovDegrees >= 90) reason = 'FOV maximum : 90°.';
    if (editing.locked && ['move', 'rotate', 'fov-minus', 'fov-plus', 'aim', 'reset'].includes(id)) reason = 'Caméra participante verrouillée pendant le passage.';
    if (id.startsWith('camera-') && busy && transition?.plan?.participants.includes(Number(id.slice(7)) as typeof camera.id)) {
      onAir = true; detail = [selected ? 'SÉLECTION' : '', 'EN TRANSITION'].filter(Boolean).join('\n');
    }
    visible = !!visible;
    return { id, label, detail, selected, onAir, reason, enabled: !reason, visible };
  });
  const error = commandError ?? editing.error ?? direction.error ?? preview?.error;
  const passing = transition?.phase === 'transitioning' || transition?.phase === 'presenting';
  const activity = busy && passing ? `${transition!.plan!.steps.map((step) => `${step.from === null ? 'Sans signal' : `C${step.from}`} → C${transition!.plan!.destination}`).filter((line, index, array) => array.indexOf(line) === index).join(', ')} : ${Math.round((transition!.frame?.progress ?? 0) * 100)} %`
    : busy ? `Préparation de C${direction.pending}…` : transition?.phase === 'cancelled' ? 'Transition annulée · Direct restauré.' : editing.dragging ? 'Geste en cours · Échap annule.' : editing.mode ? `${editing.mode === 'move' ? 'Déplacement monde' : 'Rotation locale'} · Échap quitte.` : `Prêt à diffuser C${camera.id}.`;
  return {
    buttons, selected: `Sélection : C${camera.id} · FOV ${camera.fovDegrees}°`,
    transitionPage, travelPage, sequencePage, transitionLabel: `${transitionNames[settings.mode] ?? settings.mode} · ${settings.durationMs} ms · ${travel ? 'Séquentiel' : sequence.effective}`,
    previewLabel: previewLabel(preview),
    routes: ([1, 2, 3] as const).map((id) => `Écran ${id} ← ${direction.routes[id] === null ? 'Sans signal' : `C${direction.routes[id]}`}`),
    message: error ?? (sequencePage ? busy ? `${sequence.progress || activity}\nRoutes validées à la fin du passage` : `${transition?.phase === 'cancelled' ? 'Transition annulée · Direct restauré.\n' : ''}${sequence.prepared}`
      : `${activity}${travel ? `\nTrajets successifs · ${settings.durationMs} ms${travelPage ? ` · Point ${point ? pointIndex + 1 : 0}/${settings.waypoints.length}` : ''}` : ''}\nCibles : ${targets}${paused ? ' · Concert en pause' : ''}`), error: !!error, helpVisible,
  };
}
