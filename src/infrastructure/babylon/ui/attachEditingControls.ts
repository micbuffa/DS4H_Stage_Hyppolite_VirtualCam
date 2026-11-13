import type { CameraEditor } from '../../../application/commands/cameraEditor';

export function attachEditingControls(canvas: HTMLCanvasElement, editor: CameraEditor) {
  const document = canvas.ownerDocument;
  const host = document.defaultView!;
  const message = document.getElementById('editing-message');
  const commands: Record<string, () => void> = {
    'edit-move': () => editor.setMode('move'), 'edit-rotate': () => editor.setMode('rotate'),
    'fov-minus': () => editor.adjustFov(-5), 'fov-plus': () => editor.adjustFov(5), 'aim-stage': () => editor.aim(),
  };
  const handlers = Object.entries(commands).map(([id, command]) => {
    const element = document.getElementById(id);
    const handler = () => { try { command(); } catch (error) { editor.report(error); } };
    element?.addEventListener('click', handler);
    return () => element?.removeEventListener('click', handler);
  });
  const unsubscribe = editor.subscribe((state) => {
    document.getElementById('edit-move')?.setAttribute('aria-pressed', String(state.mode === 'move'));
    document.getElementById('edit-rotate')?.setAttribute('aria-pressed', String(state.mode === 'rotate'));
    if (message) {
      message.textContent = state.error ?? (state.dragging ? 'Geste en cours · Échap : annuler' : state.mode ? `${state.mode === 'move' ? 'Déplacement monde' : 'Rotation locale'} · Échap : quitter` : 'Choisir Déplacer ou Orienter.');
      message.dataset.state = state.error ? 'error' : 'ready';
    }
  });
  const cancel = () => editor.cancel();
  const visibility = () => { if (document.hidden) cancel(); };
  const key = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    event.preventDefault(); editor.escape();
  };
  host.addEventListener('keydown', key);
  host.addEventListener('blur', cancel, true);
  canvas.addEventListener('blur', cancel, true);
  canvas.addEventListener('pointercancel', cancel, true);
  canvas.addEventListener('lostpointercapture', cancel, true);
  document.addEventListener('visibilitychange', visibility);
  return () => {
    unsubscribe(); handlers.forEach((remove) => remove());
    host.removeEventListener('keydown', key); host.removeEventListener('blur', cancel, true);
    canvas.removeEventListener('blur', cancel, true);
    canvas.removeEventListener('pointercancel', cancel, true); canvas.removeEventListener('lostpointercapture', cancel, true);
    document.removeEventListener('visibilitychange', visibility);
  };
}
