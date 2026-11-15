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

it('paginates transition controls and prepares bounded mode, duration and direction without changing the direct', async () => {
  const f = fixture();
  try {
    await f.director.initialize();
    expect(f.state('transition-next').visible).toBe(false);
    await f.panel.activate('transition-page');
    expect(f.state('transition-next').visible).toBe(true); expect(f.state('move').visible).toBe(false);
    expect(f.state('duration-plus').enabled).toBe(false);
    await f.panel.activate('transition-next'); expect(f.panel.model().transitionLabel).toBe('Fondu enchaîné · 600 ms · Simultané');
    await f.panel.activate('duration-plus'); expect(f.director.transitionSettings().durationMs).toBe(700);
    await f.panel.activate('duration-minus'); expect(f.director.transitionSettings().durationMs).toBe(600);
    await f.panel.activate('transition-next'); await f.panel.activate('transition-next');
    expect(f.panel.model().transitionLabel).toContain('Volet');
    await f.panel.activate('wipe-direction'); expect(f.director.transitionSettings().parameters.direction).toBe('right');
    expect(f.director.snapshot().routes).toEqual({ 1: 1, 2: 1, 3: 1 });
    await f.panel.activate('transition-prev'); expect(f.director.transitionSettings().mode).toBe('dip-black');
    await f.panel.activate('transition-page'); expect(f.state('move').visible).toBe(true);
  } finally { f.dispose(); }
});

it('exposes grid settings on a separate page and preserves the direct', async () => {
  const f = fixture();
  try {
    await f.director.initialize(); await f.panel.activate('transition-page');
    for (let index = 0; index < 6; index++) await f.panel.activate('transition-next');
    expect(f.panel.model().transitionLabel).toContain('Grid Morph');
    await f.panel.activate('wipe-direction');
    expect(f.state('transition-next').visible).toBe(false); expect(f.state('grid-size').visible).toBe(true);
    expect(f.state('seed-minus').enabled).toBe(false);
    await f.panel.activate('grid-size'); await f.panel.activate('seed-plus'); await f.panel.activate('grid-strength');
    expect(f.director.transitionSettings().parameters).toMatchObject({ columns: 16, rows: 9, seed: 1, strength: 0.4 });
    await f.panel.activate('seed-minus'); expect(f.director.transitionSettings().parameters.seed).toBe(0);
    await f.panel.activate('wipe-direction'); await f.panel.activate('transition-prev');
    expect(f.panel.model().transitionLabel).toContain('Mosaïque');
    await f.panel.activate('wipe-direction'); expect(f.state('grid-strength').enabled).toBe(false);
    await f.panel.activate('transition-page'); await f.panel.activate('transition-page');
    expect(f.state('transition-next').visible).toBe(true); expect(f.state('grid-size').visible).toBe(false);
    await f.panel.activate('transition-prev'); expect(f.panel.model().transitionLabel).toContain('Rolling Cubes');
    expect(f.director.snapshot().routes).toEqual({ 1: 1, 2: 1, 3: 1 });
    expect(f.panel.model().error).toBe(false);
  } finally { f.dispose(); }
});

it('cycles twelve available modes and exposes only relevant complementary settings without touching the direct', async () => {
  const f = fixture();
  try {
    await f.director.initialize(); await f.panel.activate('transition-page');
    const modes = new Set<string>();
    for (let index = 0; index < 12; index++) { modes.add(f.director.transitionSettings().mode); await f.panel.activate('transition-next'); }
    expect(modes.size).toBe(12); expect(modes.has('virtual-travel')).toBe(true);
    expect(f.director.transitionSettings().mode).toBe('cut');
    f.director.configureTransition({ mode: 'zoom' }); await f.panel.activate('wipe-direction');
    expect(f.state('grid-size')).toMatchObject({ visible: true, enabled: false }); expect(f.state('seed-plus').enabled).toBe(false);
    await f.panel.activate('grid-strength'); expect(f.director.transitionSettings().parameters.strength).toBe(0.4);
    f.director.configureTransition({ mode: 'glitch' });
    expect(f.state('grid-size').label).toBe('BANDES'); await f.panel.activate('grid-size'); await f.panel.activate('seed-plus');
    expect(f.director.transitionSettings().parameters).toMatchObject({ columns: 16, rows: 9, seed: 1 });
    f.director.configureTransition({ mode: 'luma-wipe' }); expect(f.state('grid-strength').label).toBe('DOUCEUR');
    await f.panel.activate('wipe-direction'); f.director.configureTransition({ mode: 'split' });
    expect(f.state('wipe-direction').enabled).toBe(false);
    expect(f.director.snapshot().routes).toEqual({ 1: 1, 2: 1, 3: 1 }); expect(f.panel.model().error).toBe(false);
  } finally { f.dispose(); }
});

it('offers travel duration bounds and restores 2D duration/order when leaving the travel family', async () => {
  const f = fixture();
  try {
    await f.director.initialize(); await f.panel.activate('transition-page'); await f.panel.activate('transition-prev');
    expect(f.director.transitionSettings()).toMatchObject({ mode: 'virtual-travel', durationMs: 2000, order: 'staggered' });
    expect(f.panel.model().transitionLabel).toContain('Séquentiel'); expect(f.panel.model().message).toContain('Trajets successifs');
    await f.panel.activate('duration-plus'); expect(f.director.transitionSettings().durationMs).toBe(2500);
    for (let i = 0; i < 4; i++) await f.panel.activate('duration-minus');
    expect(f.director.transitionSettings().durationMs).toBe(500); expect(f.state('duration-minus').enabled).toBe(false);
    for (let i = 0; i < 19; i++) await f.panel.activate('duration-plus');
    expect(f.director.transitionSettings().durationMs).toBe(10000); expect(f.state('duration-plus').enabled).toBe(false);
    await f.panel.activate('transition-prev'); expect(f.director.transitionSettings()).toMatchObject({ mode: 'split', durationMs: 600, order: 'simultaneous' });
  } finally { f.dispose(); }
});

it('edits up to three bounded waypoint coordinates on a distinct page without changing a camera or the direct', async () => {
  const f = fixture();
  try {
    await f.director.initialize(); f.cameras.select(4); const poses = f.cameras.snapshot(), routes = f.director.snapshot().routes;
    await f.panel.activate('transition-page'); await f.panel.activate('transition-prev'); await f.panel.activate('wipe-direction');
    expect(f.panel.model().travelPage).toBe(true); expect(f.state('travel-minus').enabled).toBe(false); expect(f.state('grid-size').visible).toBe(false);
    expect(f.state('transition-next').visible).toBe(false); expect(f.state('wipe-direction').visible).toBe(false);
    await f.panel.activate('travel-add'); expect(f.director.transitionSettings().waypoints).toEqual([[0, 6.3, -9.35]]);
    await f.panel.activate('travel-plus'); await f.panel.activate('travel-axis'); await f.panel.activate('travel-plus');
    await f.panel.activate('travel-axis'); await f.panel.activate('travel-minus');
    expect(f.director.transitionSettings().waypoints).toEqual([[0.5, 6.8, -9.85]]);
    await f.panel.activate('travel-add'); await f.panel.activate('travel-add'); expect(f.state('travel-add').enabled).toBe(false);
    expect(f.director.transitionSettings().waypoints).toHaveLength(3); await f.panel.activate('travel-point'); expect(f.state('travel-point').detail).toBe('1 / 3');
    await f.panel.activate('travel-remove'); expect(f.director.transitionSettings().waypoints).toHaveLength(2);
    f.director.configureTransition({ mode: 'virtual-travel', waypoints: [[35, 0.5, -35]] });
    expect(f.state('travel-minus').enabled).toBe(false); // Z lower bound
    await f.panel.activate('travel-axis'); expect(f.state('travel-plus').enabled).toBe(false); // X upper bound
    await f.panel.activate('travel-axis'); expect(f.state('travel-minus').enabled).toBe(false); // Y lower bound
    await f.panel.activate('travel-back'); expect(f.panel.model().travelPage).toBe(false); expect(f.state('transition-next').visible).toBe(true);
    expect(f.director.snapshot().routes).toEqual(routes); expect(f.cameras.snapshot()).toEqual(poses);
  } finally { f.dispose(); }
});

it('configures sequence order and bounded delay independently of the direct and preserves the 2D preference around travel', async () => {
  const f = fixture();
  try {
    await f.director.initialize(); f.cameras.select(4); const routes = f.director.snapshot().routes;
    await f.panel.activate('transition-page'); await f.panel.activate('sequence-page');
    expect(f.panel.model().sequencePage).toBe(true); expect(f.state('transition-next').visible).toBe(false);
    expect(f.state('delay-plus').enabled).toBe(false); await f.panel.activate('sequence-mode');
    expect(f.director.transitionSettings().order).toBe('staggered'); expect(f.state('delay-minus').enabled).toBe(false);
    for (let i = 0; i < 10; i++) await f.panel.activate('delay-plus');
    expect(f.director.transitionSettings().delayMs).toBe(1000); expect(f.state('delay-plus').enabled).toBe(false);
    await f.panel.activate('delay-minus'); expect(f.director.transitionSettings().delayMs).toBe(900);
    const orders = new Set<string>();
    for (let i = 0; i < 6; i++) { orders.add(f.director.transitionSettings().screenOrder.join()); await f.panel.activate('sequence-order'); }
    expect(orders.size).toBe(6); expect(f.panel.model().message).toContain('Total');
    await f.panel.activate('sequence-back'); await f.panel.activate('transition-prev'); // travel
    await f.panel.activate('sequence-page'); expect(f.state('sequence-mode').enabled).toBe(false);
    await f.panel.activate('sequence-back'); await f.panel.activate('transition-prev'); // split
    expect(f.director.transitionSettings().order).toBe('staggered');
    expect(f.director.snapshot().routes).toEqual(routes); expect(f.state('broadcast').enabled).toBe(true);
    await f.panel.activate('transition-page'); expect(f.state('sequence-page').visible).toBe(false);
  } finally { f.dispose(); }
});

it('maps cancellation without presenting it as a command error', async () => {
  const f = fixture();
  try {
    await f.director.initialize(); await f.panel.activate('transition-page');
    f.delayed.add(4); await f.panel.activate('camera-4');
    const pending = f.panel.activate('broadcast');
    expect(f.state('cancel-transition').enabled).toBe(true);
    await f.panel.activate('cancel-transition'); await pending;
    expect(f.panel.model().error).toBe(false);
    expect(f.panel.model().message).toContain('Transition annulée');
    expect(f.director.snapshot().routes).toEqual({ 1: 1, 2: 1, 3: 1 });
  } finally { f.dispose(); }
});
