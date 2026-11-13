import { assertCameraId, cloneCamera, validateCamera } from './cameraDefinition';
import type { CameraDefinition, CameraId, CameraPose } from './cameraDefinition';

export interface CameraSnapshot {
  selectedId: CameraId;
  aidsVisible: boolean;
  cameras: CameraDefinition[];
}

export class CameraRegistry {
  private readonly presets = new Map<CameraId, CameraDefinition>();
  private readonly cameras = new Map<CameraId, CameraDefinition>();
  private readonly listeners = new Set<(snapshot: CameraSnapshot) => void>();
  private selectedId: CameraId = 1;
  private aidsVisible = true;

  constructor(definitions: readonly CameraDefinition[]) {
    if (definitions.length !== 9) throw new Error('Neuf caméras sont requises.');
    for (const definition of definitions) {
      validateCamera(definition);
      if (this.cameras.has(definition.id)) throw new Error('Identifiant caméra dupliqué.');
      this.presets.set(definition.id, cloneCamera(definition));
      this.cameras.set(definition.id, cloneCamera(definition));
    }
  }

  snapshot(): CameraSnapshot {
    return { selectedId: this.selectedId, aidsVisible: this.aidsVisible, cameras: [...this.cameras.values()].map(cloneCamera) };
  }

  select(id: number): void {
    assertCameraId(id);
    if (id === this.selectedId) return;
    this.selectedId = id;
    this.emit();
  }

  setAidsVisible(visible: boolean): void {
    if (visible === this.aidsVisible) return;
    this.aidsVisible = visible;
    this.emit();
  }

  updatePose(id: number, pose: CameraPose): void {
    assertCameraId(id);
    const definition = { ...this.cameras.get(id)!, pose };
    validateCamera(definition);
    this.cameras.set(id, cloneCamera(definition));
    this.emit();
  }

  updateCamera(definition: CameraDefinition): void {
    validateCamera(definition);
    this.cameras.set(definition.id, cloneCamera(definition));
    this.emit();
  }

  resetSelected(): void {
    this.cameras.set(this.selectedId, cloneCamera(this.presets.get(this.selectedId)!));
    this.emit();
  }

  subscribe(listener: (snapshot: CameraSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => { this.listeners.delete(listener); };
  }

  private emit(): void { this.listeners.forEach((listener) => listener(this.snapshot())); }
}
