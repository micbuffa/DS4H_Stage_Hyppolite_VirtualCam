import type { ShowClock } from '../../domain/concert/concertMotion';
import type { CameraRegistry } from '../../domain/cameras/cameraRegistry';
import type { PanelButtonId } from '../../domain/direction/panelLayout';
import type { RoutingDirector } from './routingDirector';
import type { CameraEditor } from './cameraEditor';
import { directorPanelModel } from '../presentation/directorPanelModel';
import type { DirectorPanelModel } from '../presentation/directorPanelModel';
import { availableTransitionModes, wipeDirections } from '../../domain/direction/basicTransitions';
import { gridPresets, isGridTransition } from '../../domain/direction/gridTransitions';
import { hasGraphicSettings } from '../../domain/direction/graphicTransitions';
import type { PreviewActions } from '../ports/preview';
import { boundedPose } from '../../domain/cameras/cameraEditing';
import type { Position3 } from '../../domain/cameras/cameraDefinition';
import { nextScreenOrder } from '../../domain/direction/screenSequence';
import type { TransitionOrder } from '../../domain/direction/transitionDefinition';
export interface DirectorPanelView { render(model: DirectorPanelModel): void }

export class DirectorPanel {
  private helpVisible = false;
  private transitionPage = false;
  private parametersPage = false;
  private sequencePage = false;
  private orderBeforeTravel: TransitionOrder = 'simultaneous';
  private travelPoint = 0;
  private travelAxis = 0;
  private commandError: string | null = null;
  private disposed = false;
  private readonly unsubscribe: Array<() => void>;
  constructor(private readonly cameras: CameraRegistry, private readonly director: RoutingDirector, private readonly editor: CameraEditor, private readonly view: DirectorPanelView, private readonly goHome: () => void, private readonly show?: ShowClock, private readonly preview?: PreviewActions) {
    this.unsubscribe = [cameras.subscribe(() => this.refresh()), director.subscribe(() => this.refresh()), editor.subscribe(() => this.refresh())];
    if (preview) this.unsubscribe.push(preview.subscribe(() => this.refresh()));
  }
  model(): DirectorPanelModel { return directorPanelModel(this.cameras.snapshot(), this.director.snapshot(), this.editor.snapshot(), this.helpVisible, this.commandError, this.show?.paused, this.transitionPage, this.parametersPage, this.preview?.snapshot(), { point: this.travelPoint, axis: this.travelAxis }, this.sequencePage); }
  async activate(id: PanelButtonId): Promise<void> {
    if (this.disposed) return;
    const button = this.model().buttons.find((entry) => entry.id === id);
    if (!button || !button.visible) return;
    if (!button.enabled) {
      // The pending notice already tracks the active cut and disappears when it settles.
      if (id === 'broadcast' && this.director.snapshot().pending !== null) return;
      this.commandError = button.reason;
      this.refresh();
      return;
    }
    this.commandError = null;
    try {
      if (id.startsWith('camera-')) this.cameras.select(Number(id.slice(7)));
      else if (id.startsWith('screen-')) this.director.toggleTarget(Number(id.slice(7)));
      else switch (id) {
        case 'preview-toggle': if (this.preview?.snapshot().enabled) await this.preview.deactivate(); else await this.preview?.activate(); break;
        case 'preview-test': await this.preview?.test(); break;
        case 'preview-cancel': await this.preview?.stopTest(); break;
        case 'all': this.director.selectAllTargets(); break;
        case 'broadcast':
          await this.director.broadcast();
          break;
        case 'move': this.editor.setMode('move'); break;
        case 'rotate': this.editor.setMode('rotate'); break;
        case 'fov-minus': this.editor.adjustFov(-5); break;
        case 'fov-plus': this.editor.adjustFov(5); break;
        case 'aim': this.editor.aim(); break;
        case 'reset': this.editor.reset(); break;
        case 'aids': this.cameras.setAidsVisible(!this.cameras.snapshot().aidsVisible); break;
        case 'home': this.editor.cancel(); this.goHome(); break;
        case 'pause': this.show?.toggle(); break;
        case 'help': this.helpVisible = !this.helpVisible; break;
        case 'transition-page': this.transitionPage = !this.transitionPage; this.parametersPage = false; this.sequencePage = false; break;
        case 'sequence-page': this.sequencePage = !this.sequencePage; this.parametersPage = false; break;
        case 'sequence-back': this.sequencePage = false; break;
        case 'sequence-mode': {
          const current = this.director.transitionSettings();
          this.director.configureTransition({ ...current, order: current.order === 'simultaneous' ? 'staggered' : 'simultaneous' }); break;
        }
        case 'sequence-order': {
          const current = this.director.transitionSettings(); this.director.configureTransition({ ...current, screenOrder: nextScreenOrder(current.screenOrder) }); break;
        }
        case 'delay-minus':
        case 'delay-plus': {
          const current = this.director.transitionSettings(); this.director.configureTransition({ ...current, delayMs: current.delayMs + (id === 'delay-plus' ? 100 : -100) }); break;
        }
        case 'transition-prev':
        case 'transition-next': {
          const current = this.director.transitionSettings();
          const index = availableTransitionModes.findIndex((mode) => mode === current.mode);
          const mode = availableTransitionModes[(index + (id === 'transition-next' ? 1 : -1) + availableTransitionModes.length) % availableTransitionModes.length];
          const travel = mode === 'virtual-travel', wasTravel = current.mode === 'virtual-travel';
          if (travel && !wasTravel) this.orderBeforeTravel = current.order;
          this.director.configureTransition({ ...current, mode, order: !travel && wasTravel ? this.orderBeforeTravel : current.order,
            durationMs: travel !== wasTravel ? travel ? 2000 : 600 : mode === 'cut' || current.mode === 'cut' ? 600 : current.durationMs });
          break;
        }
        case 'duration-minus':
        case 'duration-plus': {
          const current = this.director.transitionSettings();
          this.director.configureTransition({ ...current, durationMs: current.durationMs + (id === 'duration-plus' ? 1 : -1) * (current.mode === 'virtual-travel' ? 500 : 100) }); break;
        }
        case 'wipe-direction': {
          const current = this.director.transitionSettings();
          if (current.mode === 'virtual-travel' || isGridTransition(current.mode) || hasGraphicSettings(current.mode)) { this.parametersPage = !this.parametersPage; break; }
          this.director.configureTransition({ ...current, parameters: { ...current.parameters, direction: wipeDirections[(wipeDirections.indexOf(current.parameters.direction) + 1) % wipeDirections.length] } }); break;
        }
        case 'grid-size':
        case 'grid-strength':
        case 'seed-minus':
        case 'seed-plus': {
          const current = this.director.transitionSettings();
          const p = current.parameters;
          const preset = gridPresets[(gridPresets.findIndex(([columns, rows]) => columns === p.columns && rows === p.rows) + 1) % gridPresets.length];
          this.director.configureTransition({ ...current, parameters: { ...p,
            ...(id === 'grid-size' ? { columns: preset[0], rows: preset[1] } : {}),
            ...(id === 'grid-strength' ? { strength: p.strength >= 1 ? 0 : Math.min(1, Math.round((p.strength + 0.1) * 10) / 10) } : {}),
            ...(id.startsWith('seed-') ? { seed: p.seed + (id === 'seed-plus' ? 1 : -1) } : {}),
          } }); break;
        }
        case 'travel-back': this.parametersPage = false; break;
        case 'travel-point': this.travelPoint = (this.travelPoint + 1) % this.director.transitionSettings().waypoints.length; break;
        case 'travel-axis': this.travelAxis = (this.travelAxis + 1) % 3; break;
        case 'travel-add':
        case 'travel-remove':
        case 'travel-minus':
        case 'travel-plus': {
          const current = this.director.transitionSettings(), points = current.waypoints.map((point) => [...point] as [number, number, number]);
          this.travelPoint = Math.min(this.travelPoint, Math.max(0, points.length - 1));
          if (id === 'travel-add') {
            const state = this.director.snapshot(), cameras = this.cameras.snapshot().cameras;
            const to = cameras.find((camera) => camera.id === state.selectedId)!;
            const reference = state.targets[0], from = cameras.find((camera) => reference !== undefined && camera.id === state.routes[reference]) ?? to;
            points.push((points.at(-1) ?? to.pose.position.map((value, axis) => (value + from.pose.position[axis]) / 2)).slice() as [number, number, number]);
            this.travelPoint = points.length - 1;
          } else if (id === 'travel-remove') { points.splice(this.travelPoint, 1); this.travelPoint = Math.max(0, this.travelPoint - 1); }
          else if (points[this.travelPoint]) {
            const point = points[this.travelPoint]; point[this.travelAxis] = Math.round((point[this.travelAxis] + (id === 'travel-plus' ? 0.5 : -0.5)) * 100) / 100;
            points[this.travelPoint] = [...boundedPose({ position: point as Position3, rotation: [0, 0, 0, 1] }).position];
          }
          this.director.configureTransition({ ...current, waypoints: points }); break;
        }
        case 'sequence-cancel':
        case 'travel-cancel':
        case 'cancel-transition': this.director.cancelTransition(); break;
      }
    } catch (error) {
      // Routing failures already have a readable, source-specific projection.
      this.commandError = id === 'broadcast' && this.director.transitionSnapshot().phase === 'cancelled' ? null
        : (id === 'broadcast' ? this.director.snapshot().error : null) ?? (error instanceof Error ? error.message : 'Commande impossible.');
    }
    this.refresh();
  }
  dispose(): void { if (this.disposed) return; this.disposed = true; this.unsubscribe.forEach((remove) => remove()); }
  private refresh(): void { if (!this.disposed) this.view.render(this.model()); }
}
