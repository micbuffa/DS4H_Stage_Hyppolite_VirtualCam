import type { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { movementKey, observerTranslation } from '../../../domain/cameras/observerMovement';
import type { MoveDirection } from '../../../domain/cameras/observerMovement';

export function attachObserverKeyboard(camera: ArcRotateCamera, canvas: HTMLCanvasElement): () => void {
  const scene = camera.getScene();
  const host = canvas.ownerDocument.defaultView!;
  const pressed = new Map<string, MoveDirection>();
  const directions = new Set<MoveDirection>();
  const clear = () => pressed.clear();
  const onDown = (event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey) { clear(); return; }
    const direction = movementKey(event.key);
    if (!direction || event.target !== canvas) return;
    event.preventDefault();
    pressed.set(event.key.toLowerCase(), direction);
  };
  const onUp = (event: KeyboardEvent) => { pressed.delete(event.key.toLowerCase()); };
  canvas.addEventListener('keydown', onDown);
  host.addEventListener('keyup', onUp);
  canvas.addEventListener('blur', clear);
  host.addEventListener('blur', clear);
  const onVisibility = () => { if (canvas.ownerDocument.hidden) clear(); };
  canvas.ownerDocument.addEventListener('visibilitychange', onVisibility);
  const observer = scene.onBeforeRenderObservable.add(() => {
    directions.clear();
    pressed.forEach((direction) => directions.add(direction));
    const translation = observerTranslation(directions, camera.alpha, scene.getEngine().getDeltaTime() / 1000);
    camera.target.x = Math.max(-35, Math.min(35, camera.target.x + translation.x));
    camera.target.z = Math.max(-35, Math.min(25, camera.target.z + translation.z));
  });
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    clear();
    canvas.removeEventListener('keydown', onDown);
    host.removeEventListener('keyup', onUp);
    canvas.removeEventListener('blur', clear);
    host.removeEventListener('blur', clear);
    canvas.ownerDocument.removeEventListener('visibilitychange', onVisibility);
    scene.onBeforeRenderObservable.remove(observer);
    scene.onDisposeObservable.remove(onDispose);
  };
  const onDispose = scene.onDisposeObservable.add(dispose);
  return dispose;
}
