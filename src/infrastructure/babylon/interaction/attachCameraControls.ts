import '@babylonjs/core/Culling/ray';
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import { resetObserver } from '../cameras/createObserver';
import type { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import type { CameraRegistry } from '../../../domain/cameras/cameraRegistry';

export function attachCameraControls(canvas: HTMLCanvasElement, registry: CameraRegistry, observer: ArcRotateCamera, editing?: { cancel(): void; reset(): void; snapshot(): { dragging: boolean } }): () => void {
  const scene = observer.getScene();
  const document = canvas.ownerDocument;
  const host = document.defaultView!;
  const selectedText = document.getElementById('selected-camera');
  const home = document.getElementById('home-view');
  const aids = document.getElementById('camera-aids');
  const reset = document.getElementById('reset-camera');
  let capturedPointer: number | undefined;
  const clear = () => { capturedPointer = undefined; };
  const pointer = scene.onPrePointerObservable.add((info) => {
    const pointerId = (info.event as PointerEvent).pointerId ?? 0;
    if (capturedPointer === pointerId && capturedPointer !== undefined) {
      info.skipOnPointerObservable = true;
      if (info.type === PointerEventTypes.POINTERUP) clear();
      return;
    }
    if (info.skipOnPointerObservable || editing?.snapshot().dragging) return;
    if (info.type !== PointerEventTypes.POINTERDOWN || info.event.button !== 0) return;
    const hit = scene.pick(info.localPosition.x, info.localPosition.y,
      (mesh) => mesh.isPickable && mesh.isEnabled() && mesh.isVisible && mesh.metadata?.category === 'camera-helper', false, observer);
    const id: unknown = hit?.pickedMesh?.metadata?.cameraId;
    if (typeof id !== 'number') return;
    registry.select(id);
    capturedPointer = pointerId;
    info.skipOnPointerObservable = true;
    canvas.focus({ preventScroll: true });
  });
  const goHome = () => {
    editing?.cancel();
    // Blur clears held movement keys; refocusing resumes navigation without a stuck key.
    canvas.blur();
    resetObserver(observer);
    canvas.focus({ preventScroll: true });
  };
  const toggleAids = () => registry.setAidsVisible(!registry.snapshot().aidsVisible);
  const resetCamera = () => { if (editing) editing.reset(); else registry.resetSelected(); };
  const key = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (event.metaKey || event.ctrlKey || event.altKey || event.repeat || target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName ?? '')) return;
    if (event.key.toLowerCase() === 'r') { event.preventDefault(); goHome(); }
    if (event.key.toLowerCase() === 'h') { event.preventDefault(); toggleAids(); }
  };
  const unsubscribe = registry.subscribe((snapshot) => {
    const camera = snapshot.cameras.find((definition) => definition.id === snapshot.selectedId)!;
    if (selectedText) selectedText.textContent = `Caméra sélectionnée : C${camera.id} · ${camera.name} · ${camera.fovDegrees}°`;
    aids?.setAttribute('aria-pressed', String(snapshot.aidsVisible));
    if (aids) aids.textContent = snapshot.aidsVisible ? 'Masquer les aides (H)' : 'Afficher les aides (H)';
    if (reset) reset.textContent = `Réinitialiser C${camera.id}`;
  });
  home?.addEventListener('click', goHome);
  aids?.addEventListener('click', toggleAids);
  reset?.addEventListener('click', resetCamera);
  host.addEventListener('keydown', key);
  host.addEventListener('blur', clear);
  host.addEventListener('pointerup', clear);
  canvas.addEventListener('pointercancel', clear);
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    unsubscribe();
    scene.onPrePointerObservable.remove(pointer);
    scene.onDisposeObservable.remove(onDispose);
    home?.removeEventListener('click', goHome);
    aids?.removeEventListener('click', toggleAids);
    reset?.removeEventListener('click', resetCamera);
    host.removeEventListener('keydown', key);
    host.removeEventListener('blur', clear);
    host.removeEventListener('pointerup', clear);
    canvas.removeEventListener('pointercancel', clear);
  };
  const onDispose = scene.onDisposeObservable.add(dispose);
  return dispose;
}
