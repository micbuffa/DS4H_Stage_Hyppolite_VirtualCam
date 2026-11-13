import { expect, it, vi } from 'vitest';
import { routingFixture } from '../helpers/routingFixture';
import { CameraEditor } from '../../src/application/commands/cameraEditor';
import { DirectorPanel } from '../../src/application/commands/directorPanel';
import { PanelGesture } from '../../src/domain/direction/panelGesture';
import { panelButtons } from '../../src/domain/direction/panelLayout';

const fixture = () => {
  const f = routingFixture();
  const editor = new CameraEditor(f.cameras, { suspend: vi.fn(), resume: vi.fn() });
  const view = { render: vi.fn() }; const home = vi.fn();
  const panel = new DirectorPanel(f.cameras, f.director, editor, view, home);
  const state = (id: string) => panel.model().buttons.find((entry) => entry.id === id)!;
  return { ...f, editor, view, home, panel, state, dispose: () => { panel.dispose(); editor.dispose(); f.director.dispose(); } };
};
it('presents nine camera and three target buttons with distinct selection, targets and on-air states', async () => {
  const f = fixture();
  try {
    await f.director.initialize();
    expect(new Set(panelButtons.map((button) => button.id)).size).toBe(panelButtons.length);
    expect(f.panel.model().buttons.filter((button) => button.id.startsWith('camera-'))).toHaveLength(9);
    expect(f.panel.model().buttons.filter((button) => button.id.startsWith('screen-'))).toHaveLength(3);
    expect(f.state('camera-1')).toMatchObject({ label: '1', selected: true, onAir: true, detail: 'SÉLECTION\nEN DIFFUSION' });
    expect(f.state('screen-1').label).toBe('✓ 1'); expect(f.state('screen-2').selected).toBe(false);
    await f.panel.activate('camera-4');
    expect(f.state('camera-4')).toMatchObject({ selected: true, onAir: false });
    expect(f.state('camera-1')).toMatchObject({ selected: false, onAir: true });
    expect(f.panel.model().routes).toEqual(['Écran 1 ← C1', 'Écran 2 ← C1', 'Écran 3 ← C1']);
    await f.panel.activate('broadcast');
    expect(f.state('camera-4').onAir).toBe(true); expect(f.panel.model().routes[0]).toBe('Écran 1 ← C4');
  } finally { f.dispose(); }
});
it('disables empty/pending broadcasts and pause, and displays their reasons', async () => {
  const f = fixture();
  try {
    await f.director.initialize(); await f.panel.activate('screen-1');
    expect(f.state('broadcast').enabled).toBe(false);
    await f.panel.activate('broadcast'); expect(f.panel.model().message).toContain('au moins');
    await f.panel.activate('all'); await f.panel.activate('all');
    expect(f.director.snapshot().targets).toEqual([1, 2, 3]);
    await f.panel.activate('pause'); expect(f.panel.model().message).toContain('indisponibles');
    f.delayed.add(4); await f.panel.activate('camera-4');
    const cut = f.panel.activate('broadcast');
    expect(f.state('broadcast').enabled).toBe(false); expect(f.panel.model().message).toContain('Préparation');
    await f.panel.activate('broadcast');
    f.feeds.find((feed) => feed.id === 4)!.resolve(); await cut;
    expect(f.state('broadcast').enabled).toBe(true);
    expect(f.panel.model().error).toBe(false);
    expect(f.panel.model().message).toContain('Prêt à diffuser C4');
  } finally { f.dispose(); }
});
it('maps all editing, aid, home and help commands without changing screen assignments', async () => {
  const f = fixture();
  try {
    await f.director.initialize();
    await f.panel.activate('move'); expect(f.editor.snapshot().mode).toBe('move');
    await f.panel.activate('rotate'); expect(f.editor.snapshot().mode).toBe('rotate');
    const initial = f.editor.selected();
    await f.panel.activate('fov-minus'); expect(f.editor.selected().fovDegrees).toBe(initial.fovDegrees - 5);
    await f.panel.activate('fov-plus'); expect(f.editor.selected().fovDegrees).toBe(initial.fovDegrees);
    await f.panel.activate('aim'); expect(f.editor.selected().pose.rotation).not.toEqual(initial.pose.rotation);
    await f.panel.activate('reset'); expect(f.editor.selected()).toEqual(initial);
    await f.panel.activate('aids'); expect(f.cameras.snapshot().aidsVisible).toBe(false);
    await f.panel.activate('help'); expect(f.panel.model().helpVisible).toBe(true);
    await f.panel.activate('help'); expect(f.panel.model().helpVisible).toBe(false);
    await f.panel.activate('home'); expect(f.home).toHaveBeenCalledOnce();
    expect(f.director.snapshot().routes).toEqual({ 1: 1, 2: 1, 3: 1 });
    f.editor.adjustFov(100); expect(f.state('fov-plus')).toMatchObject({ enabled: false, reason: 'FOV maximum : 90°.' });
    f.editor.adjustFov(-100); expect(f.state('fov-minus').enabled).toBe(false);
  } finally { f.dispose(); }
});
it('projects failures and external picking changes, then detaches every subscription on disposal', async () => {
  const f = fixture();
  try {
    await f.director.initialize(); f.failures.add(8);
    f.cameras.select(8); expect(f.state('camera-8').selected).toBe(true);
    await f.panel.activate('broadcast');
    expect(f.panel.model()).toMatchObject({ error: true, routes: ['Écran 1 ← C1', 'Écran 2 ← C1', 'Écran 3 ← C1'] });
    expect(f.panel.model().message).toContain('conservée');
    f.failures.clear(); await f.panel.activate('broadcast');
    expect(f.panel.model().error).toBe(false);
    f.panel.dispose(); f.panel.dispose(); const calls = f.view.render.mock.calls.length;
    f.cameras.select(2); f.editor.setMode('move'); f.director.toggleTarget(2);
    await f.panel.activate('camera-9');
    expect(f.cameras.snapshot().selectedId).toBe(2); expect(f.view.render).toHaveBeenCalledTimes(calls);
  } finally { f.dispose(); }
});
it('consumes one pointer gesture into at most one matching click and cancels drags/interruption', () => {
  const gesture = new PanelGesture();
  expect(gesture.begin(1, 'camera-4', 10, 10)).toBe(true);
  expect(gesture.begin(2, 'camera-8', 10, 10)).toBe(false);
  expect(gesture.release(2, 'camera-8')).toBeNull();
  expect(gesture.release(1, 'camera-4')).toBe('camera-4'); expect(gesture.release(1, 'camera-4')).toBeNull();
  gesture.begin(1, 'fov-plus', 0, 0); gesture.move(1, 20, 0); gesture.move(1, 0, 0);
  expect(gesture.release(1, 'fov-plus')).toBeNull();
  gesture.begin(1, 'camera-4', 0, 0); expect(gesture.release(1, 'camera-5')).toBeNull();
  gesture.begin(1, 'camera-4', 0, 0); gesture.cancel(); expect(gesture.release(1, 'camera-4')).toBeNull();
  gesture.begin(1, null, 0, 0); expect(gesture.release(1, null)).toBeNull();
});
