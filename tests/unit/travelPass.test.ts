import { expect, it, vi } from 'vitest';
import { createTravelPass } from '../../src/application/commands/createTravelPass';
import { createCameraPresets } from '../../src/domain/cameras/cameraPresets';
import { captureTravelPlan } from '../../src/domain/direction/captureTravelPlan';
import { planTransition, transitionFrame } from '../../src/domain/direction/transitionPlan';
import type { ScreenId } from '../../src/domain/direction/screenRouting';
import type { TravelPose } from '../../src/domain/cameras/travelPath';
import { deferred } from '../helpers/routingFixture';

function fixture(targets: number[] = [1, 2, 3]) {
  const cameras = createCameraPresets();
  const plan = captureTravelPlan(planTransition({ 1: 1, 2: 2, 3: 3 }, 4, targets, { mode: 'virtual-travel', delayMs: 200 }), cameras, []);
  const textures = new Map<ScreenId, string>([[1, 'A1'], [2, 'A2'], [3, 'A3']]), original = new Map(textures);
  let current: TravelPose = plan.travel![0].path.from;
  const events: { kind: string; pose: TravelPose; bindings: Map<ScreenId, string> }[] = [];
  const record = (kind: string) => events.push({ kind, pose: current, bindings: new Map(textures) });
  const lifetime = new AbortController();
  let readiness = Promise.resolve(), draw = Promise.resolve(), presentation = Promise.resolve();
  const watches: { ready: Promise<void>; dispose: ReturnType<typeof vi.fn> }[] = [];
  const temporary = { texture: 'TEMP', get ready() { return readiness; }, consumer: { owner: 'travel-temporary', source: 'temporary' as const, use: 'travel' as const, rendering: true },
    setPose: vi.fn((pose: TravelPose) => { current = pose; record('pose'); }), waitForFrame: vi.fn(async () => { await draw; record('draw'); }),
    setRenderingEnabled: vi.fn(), dispose: vi.fn(() => record('dispose')) };
  const sources = { retain: vi.fn(), retainTemporary: vi.fn((_owner: string, pose: TravelPose) => { current = pose; record('reserve'); return temporary; }) };
  const pass = createTravelPass({ sources, surfaces: new Map([...textures.keys()].map((id) => [id, { getTexture: () => textures.get(id)!, setTexture: (texture: string | null) => { textures.set(id, texture!); record('bind'); } }])),
    waitForPresentation: () => { record('present'); const watch = { ready: presentation, dispose: vi.fn() }; watches.push(watch); return watch; } });
  const pairs = new Map(plan.steps.map((step) => [step.screen, { from: original.get(step.screen)!, to: 'B' }]));
  return { plan, pass, temporary, sources, lifetime, textures, original, events, watches, pairs,
    prepare: () => pass.prepare(plan, pairs, lifetime.signal),
    readyLater: (ready: Promise<void>) => { readiness = ready; }, drawLater: (ready: Promise<void>) => { draw = ready; }, presentLater: (ready: Promise<void>) => { presentation = ready; } };
}

it('reuses one temporary source across all legs, presents every endpoint, and detaches B before repositioning', async () => {
  const f = fixture(); const session = await f.prepare();
  await session.render(transitionFrame(f.plan, 0));
  expect([...f.textures]).toEqual([[1, 'A1'], [2, 'A2'], [3, 'TEMP']]);
  await session.render(transitionFrame(f.plan, f.plan.totalMs));
  expect([...f.textures.values()]).toEqual(['B', 'B', 'B']); expect(f.sources.retainTemporary).toHaveBeenCalledOnce();
  expect(f.temporary.dispose).not.toHaveBeenCalled();
  const poses = f.events.filter((event) => event.kind === 'pose');
  expect(poses.map((event) => event.pose.position)).toEqual([f.plan.travel![0].path.to.position, f.plan.travel![1].path.from.position, f.plan.travel![1].path.to.position, f.plan.travel![2].path.from.position, f.plan.travel![2].path.to.position]);
  for (const event of poses.filter((event) => event.pose !== f.plan.travel![0].path.to && event.pose !== f.plan.travel![1].path.to)) {
    if (event.pose === f.plan.travel![1].path.from || event.pose === f.plan.travel![2].path.from) expect([...event.bindings.values()].includes('TEMP')).toBe(false);
  }
  expect(f.events.every((event) => [...event.bindings.values()].filter((texture) => texture === 'TEMP').length <= 1)).toBe(true);
  for (const leg of f.plan.travel!) expect(f.events.some((event) => event.kind === 'present' && event.pose === leg.path.to && event.bindings.get(leg.screen) === 'TEMP')).toBe(true);
  expect(() => session.complete()).toThrow('Présenter'); await session.commit(); session.complete(); session.complete();
  expect(f.temporary.dispose).toHaveBeenCalledOnce(); expect(f.watches.every((watch) => watch.dispose.mock.calls.length === 1)).toBe(true);
});

it('keeps later surfaces untouched during a delay and restores all targets after the first completed leg', async () => {
  const f = fixture(); const session = await f.prepare();
  await session.render(transitionFrame(f.plan, f.plan.steps[0].endMs));
  expect([...f.textures]).toEqual([[1, 'A1'], [2, 'A2'], [3, 'B']]);
  const moves = f.temporary.setPose.mock.calls.length;
  await session.render(transitionFrame(f.plan, f.plan.steps[0].endMs + 100)); expect(f.temporary.setPose).toHaveBeenCalledTimes(moves);
  f.lifetime.abort(); session.rollback(); expect(f.textures).toEqual(f.original); expect(f.temporary.dispose).toHaveBeenCalledOnce();
});

it.each(['draw', 'presentation'])('abandons a pending %s and forbids every late publication after rollback', async (kind) => {
  const f = fixture([1]); const session = await f.prepare(); await session.render(transitionFrame(f.plan, 0));
  const gate = deferred(); if (kind === 'draw') f.drawLater(gate.ready); else f.presentLater(gate.ready);
  const rendering = session.render(transitionFrame(f.plan, 1000)); const rejected = expect(rendering).rejects.toThrow('annulée');
  await vi.waitFor(() => expect(kind === 'draw' ? f.temporary.waitForFrame.mock.calls.length > 0 : f.watches.length > 1).toBe(true));
  f.lifetime.abort(); await rejected; expect(f.textures).toEqual(f.original);
  const bindings = f.events.filter((event) => event.kind === 'bind').length;
  gate.resolve(); await Promise.resolve(); await Promise.resolve();
  expect(f.events.filter((event) => event.kind === 'bind')).toHaveLength(bindings); expect(f.temporary.dispose).toHaveBeenCalledOnce();
  expect(f.watches.every((watch) => watch.dispose.mock.calls.length === 1)).toBe(true);
});

it.each(['draw', 'presentation'])('leaves the entire command reversible after a %s failure', async (kind) => {
  const f = fixture(); const session = await f.prepare();
  await session.render(transitionFrame(f.plan, f.plan.steps[0].endMs));
  const gate = deferred(); if (kind === 'draw') f.drawLater(gate.ready); else f.presentLater(gate.ready);
  const rendering = session.render(transitionFrame(f.plan, f.plan.steps[1].startMs + 1000)); const rejected = expect(rendering).rejects.toThrow('GPU');
  gate.reject(new Error('GPU simulé.')); await rejected; session.rollback();
  expect(f.textures).toEqual(f.original); expect(f.temporary.dispose).toHaveBeenCalledOnce();
});

it('cancels preparation before readiness without binding a surface or publishing a late session', async () => {
  const f = fixture(); const gate = deferred(); f.readyLater(gate.ready);
  const preparing = f.prepare(); const rejected = expect(preparing).rejects.toThrow('annulée'); f.lifetime.abort(); await rejected;
  gate.resolve(); await Promise.resolve(); expect(f.events.some((event) => event.kind === 'bind')).toBe(false); expect(f.temporary.dispose).toHaveBeenCalledOnce();
});

it('rejects malformed plans before reserving a source, and rejects invalid/reentrant/backward frames', async () => {
  const f = fixture([1]);
  await expect(f.pass.prepare({ ...f.plan, travel: undefined }, f.pairs, f.lifetime.signal)).rejects.toThrow('incomplet'); expect(f.sources.retainTemporary).not.toHaveBeenCalled();
  const session = await f.prepare();
  await expect(session.render({ progress: NaN, screens: [] })).rejects.toThrow('invalide');
  const gate = deferred(); f.presentLater(gate.ready); const first = session.render(transitionFrame(f.plan, 0));
  await expect(session.render(transitionFrame(f.plan, 100))).rejects.toThrow('Attendre'); gate.resolve(); await first;
  await session.render(transitionFrame(f.plan, 1000));
  await expect(session.render(transitionFrame(f.plan, 500))).rejects.toThrow('invalide');
  await expect(session.commit()).rejects.toThrow('Terminer'); session.rollback(); expect(f.textures).toEqual(f.original);
});
