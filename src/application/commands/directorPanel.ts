import type { ShowClock } from '../../domain/concert/concertMotion';
import type { CameraRegistry } from '../../domain/cameras/cameraRegistry';
import type { PanelButtonId } from '../../domain/direction/panelLayout';
import type { RoutingDirector } from './routingDirector';
import type { CameraEditor } from './cameraEditor';
import { directorPanelModel } from '../presentation/directorPanelModel';
import type { DirectorPanelModel } from '../presentation/directorPanelModel';
export interface DirectorPanelView { render(model: DirectorPanelModel): void }

export class DirectorPanel {
  private helpVisible = false;
  private commandError: string | null = null;
  private disposed = false;
  private readonly unsubscribe: Array<() => void>;
  constructor(private readonly cameras: CameraRegistry, private readonly director: RoutingDirector, private readonly editor: CameraEditor, private readonly view: DirectorPanelView, private readonly goHome: () => void, private readonly show?: ShowClock) {
    this.unsubscribe = [cameras.subscribe(() => this.refresh()), director.subscribe(() => this.refresh()), editor.subscribe(() => this.refresh())];
  }
  model(): DirectorPanelModel { return directorPanelModel(this.cameras.snapshot(), this.director.snapshot(), this.editor.snapshot(), this.helpVisible, this.commandError, this.show?.paused); }
  async activate(id: PanelButtonId): Promise<void> {
    if (this.disposed) return;
    const button = this.model().buttons.find((entry) => entry.id === id);
    if (!button) return;
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
      }
    } catch (error) {
      // Routing failures already have a readable, source-specific projection.
      this.commandError = (id === 'broadcast' ? this.director.snapshot().error : null) ?? (error instanceof Error ? error.message : 'Commande impossible.');
    }
    this.refresh();
  }
  dispose(): void { if (this.disposed) return; this.disposed = true; this.unsubscribe.forEach((remove) => remove()); }
  private refresh(): void { if (!this.disposed) this.view.render(this.model()); }
}
