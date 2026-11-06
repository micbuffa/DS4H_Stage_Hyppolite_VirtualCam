import type { CameraRegistry } from '../../../domain/cameras/cameraRegistry';
import type { RoutingDirector } from '../../../application/commands/routingDirector';
import { screenIds } from '../../../domain/direction/screenRouting';

/** Temporary HTML control surface; the spatial control panel is implemented in T08. */
export function attachRoutingControls(document: Document, cameras: CameraRegistry, director: RoutingDirector) {
  const select = document.getElementById('routing-camera') as HTMLSelectElement | null;
  const buttons = screenIds.map((id) => document.getElementById(`target-${id}`) as HTMLButtonElement | null);
  const all = document.getElementById('all-screens') as HTMLButtonElement | null;
  const broadcast = document.getElementById('broadcast') as HTMLButtonElement | null;
  const message = document.getElementById('routing-message');
  const feedStatus = document.getElementById('feed-status');
  const names = new Map(cameras.snapshot().cameras.map((camera) => [camera.id, camera.name]));
  if (select) select.replaceChildren(...cameras.snapshot().cameras.map((camera) => {
    const option = document.createElement('option');
    option.value = String(camera.id); option.textContent = `C${camera.id} · ${camera.name}`;
    return option;
  }));
  const unsubscribe = director.subscribe((state) => {
    const onAir = new Set(Object.values(state.routes));
    if (select) {
      select.disabled = false;
      select.value = String(state.selectedId);
      for (const option of select.options) option.textContent = `C${option.value} · ${names.get(Number(option.value) as typeof state.selectedId)}${onAir.has(Number(option.value) as typeof state.selectedId) ? ' · EN DIRECT' : ''}`;
    }
    buttons.forEach((button, index) => { if (button) { button.disabled = false; button.setAttribute('aria-pressed', String(state.targets.includes(screenIds[index]))); } });
    if (all) all.disabled = false;
    if (broadcast) {
      broadcast.disabled = state.pending !== null || state.targets.length === 0;
      broadcast.title = state.targets.length ? `Diffuser C${state.selectedId} sur les écrans cochés` : 'Choisir au moins un écran.';
    }
    const lines = screenIds.map((id) => `Écran ${id} ← ${state.routes[id] === null ? 'Sans signal' : `C${state.routes[id]}`}`);
    screenIds.forEach((id, index) => {
      const row = document.getElementById(`route-${id}`);
      if (row) row.textContent = lines[index];
    });
    if (feedStatus) feedStatus.textContent = lines.join(' · ');
    if (message) {
      message.textContent = state.error ?? (state.pending === null ? `Prêt à diffuser C${state.selectedId}.` : `Préparation de C${state.pending}…`);
      message.dataset.state = state.error ? 'error' : state.pending === null ? 'ready' : 'preparing';
    }
  });
  const chooseCamera = () => { if (select) cameras.select(Number(select.value)); };
  const toggles = screenIds.map((id) => () => director.toggleTarget(id));
  const chooseAll = () => director.selectAllTargets();
  const cut = () => { void director.broadcast().catch(() => undefined); }; // Error is projected by the director, without blocking dialogs.
  select?.addEventListener('change', chooseCamera);
  buttons.forEach((button, index) => button?.addEventListener('click', toggles[index]));
  all?.addEventListener('click', chooseAll);
  broadcast?.addEventListener('click', cut);
  return () => {
    unsubscribe(); select?.removeEventListener('change', chooseCamera);
    buttons.forEach((button, index) => button?.removeEventListener('click', toggles[index]));
    all?.removeEventListener('click', chooseAll); broadcast?.removeEventListener('click', cut);
    for (const control of [select, ...buttons, all, broadcast]) if (control) control.disabled = true;
  };
}
