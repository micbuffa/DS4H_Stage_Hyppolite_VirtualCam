import '@babylonjs/core/Culling/ray';
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import type { Camera } from '@babylonjs/core/Cameras/camera';
import type { DirectorPanel } from '../../../application/commands/directorPanel';
import type { createDirectorPanel } from '../ui/createDirectorPanel';
import type { PanelButtonId } from '../../../domain/direction/panelLayout';
import { PanelGesture } from '../../../domain/direction/panelGesture';

export function attachPanelPicking(canvas: HTMLCanvasElement, observer: Camera, panel: ReturnType<typeof createDirectorPanel>, commands: DirectorPanel) {
  const scene = observer.getScene();
  const host = canvas.ownerDocument.defaultView!;
  const gesture = new PanelGesture();
  const clear = () => { gesture.cancel(); panel.hover(null); canvas.style.cursor = ''; };
  const pointer = scene.onPrePointerObservable.add((info) => {
    if (info.skipOnPointerObservable) return;
    const event = info.event as PointerEvent;
    const point = info.localPosition;
    const pick = () => scene.pick(point.x, point.y, (mesh) => mesh.isEnabled() && mesh.isVisible && mesh.isPickable && mesh.metadata?.category === 'panel', false, observer);
    const hit = pick();
    const button = (hit?.pickedMesh?.metadata?.buttonId ?? null) as PanelButtonId | null;
    if (gesture.owns(event.pointerId)) {
      info.skipOnPointerObservable = true;
      gesture.move(event.pointerId, point.x, point.y);
      if (info.type === PointerEventTypes.POINTERUP) {
        const command = gesture.release(event.pointerId, button);
        if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
        if (command) void commands.activate(command);
      }
      return;
    }
    if (info.type === PointerEventTypes.POINTERMOVE) {
      panel.hover(button); canvas.style.cursor = button ? 'pointer' : '';
    }
    if (info.type !== PointerEventTypes.POINTERDOWN || !hit?.hit) return;
    // The physical case also consumes clicks: never start an orbit through the panel.
    info.skipOnPointerObservable = true;
    if (event.button !== 0) return;
    gesture.begin(event.pointerId, button, point.x, point.y);
    canvas.focus({ preventScroll: true });
    try { canvas.setPointerCapture?.(event.pointerId); } catch { /* Pointer may already have been cancelled. */ }
  });
  host.addEventListener('blur', clear, true);
  canvas.addEventListener('pointercancel', clear, true);
  canvas.addEventListener('lostpointercapture', clear, true);
  const visibility = () => { if (canvas.ownerDocument.hidden) clear(); };
  canvas.ownerDocument.addEventListener('visibilitychange', visibility);
  return () => {
    clear(); scene.onPrePointerObservable.remove(pointer);
    host.removeEventListener('blur', clear, true);
    canvas.removeEventListener('pointercancel', clear, true); canvas.removeEventListener('lostpointercapture', clear, true);
    canvas.ownerDocument.removeEventListener('visibilitychange', visibility);
  };
}
