import { Engine } from '@babylonjs/core/Engines/engine';
import type { BaseTexture } from '@babylonjs/core/Materials/Textures/baseTexture';
import { CameraRegistry } from '../../../src/domain/cameras/cameraRegistry';
import { createCameraPresets } from '../../../src/domain/cameras/cameraPresets';
import { createTravelPath, travelPose } from '../../../src/domain/cameras/travelPath';
import { createConcertTravelObstacles } from '../../../src/domain/concert/travelObstacles';
import { createConcertScene } from '../../../src/infrastructure/babylon/engine/createObservationScene';
import { attachConcertShow } from '../../../src/infrastructure/babylon/engine/attachConcertShow';
import { createCaptureCameras } from '../../../src/infrastructure/babylon/cameras/createCaptureCameras';
import { createRoutingRenderer } from '../../../src/infrastructure/babylon/rendering/createRoutingRenderer';
import { createCameraFeed } from '../../../src/infrastructure/babylon/rendering/createCameraFeed';
import { watchSceneReadiness } from '../../../src/infrastructure/babylon/engine/watchSceneReadiness';
import { RoutingDirector } from '../../../src/application/commands/routingDirector';
import type { SourceLease, TravelSourceLease } from '../../../src/application/ports/transition';
import type { CameraId } from '../../../src/domain/cameras/cameraDefinition';
import type { TransitionDriver } from '../../../src/application/ports/transition';
import type { ScreenId } from '../../../src/domain/direction/screenRouting';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Effect } from '@babylonjs/core/Materials/effect';

const canvas = document.querySelector('canvas')!;
const engine = new Engine(canvas, true, { preserveDrawingBuffer: true });
const concert = createConcertScene(engine); const { scene } = concert;
const show = attachConcertShow(concert); show.clock.paused = true;
const registry = new CameraRegistry(createCameraPresets()), cameras = createCaptureCameras(scene, registry);
const initial = registry.snapshot(), observer = scene.activeCamera;
const frames: Record<string, number> = {};
const renderer = createRoutingRenderer(scene, concert.screens, cameras, {
  createFeed(scene, camera, size) {
    const feed = createCameraFeed(scene, camera, size);
    feed.onFrameRendered(() => { frames[camera.name] = (frames[camera.name] ?? 0) + 1; });
    return feed;
  }, waitForPresentation: watchSceneReadiness,
});
let nowMs = 0, waiting: ((time: number) => void) | undefined;
const realDriver = renderer.createTransitionDriver(document);
const driver: TransitionDriver = { ...realDriver, sample: () => ({ nowMs, visible: true }), nextSample: (signal) => new Promise((resolve, reject) => {
  const abort = () => { waiting = undefined; reject(new Error('Échantillon de trajet annulé.')); };
  signal.addEventListener('abort', abort, { once: true });
  waiting = (time) => { signal.removeEventListener('abort', abort); waiting = undefined; nowMs = time; resolve({ nowMs, visible: true }); };
}) };
const director = new RoutingDirector(registry, renderer, driver);
const path = createTravelPath(initial.cameras[0], initial.cameras[3], [], createConcertTravelObstacles());
let lifetime = new AbortController(), temp: TravelSourceLease<BaseTexture> | undefined, destination: SourceLease<BaseTexture> | undefined;
let maxActive = 0;
let running: Promise<void> | undefined, runningError: string | undefined;
engine.runRenderLoop(() => { scene.render(); maxActive = Math.max(maxActive, renderer.stats().active); });
const ready = (async () => {
  await director.initialize(); await director.assign(2, [2]); await director.assign(3, [3]); await renderer.setQuality('reduced');
  document.body.dataset.ready = 'true';
})();
void ready.catch((error: unknown) => { document.body.dataset.error = String(error); });
const status = () => ({ routes: director.snapshot().routes, stats: renderer.stats(), maxActive, frames: { ...frames }, observer: scene.activeCamera === observer,
  phase: director.transitionSnapshot().phase, progress: director.transitionSnapshot().frame?.progress, error: runningError ?? director.snapshot().error,
  bindings: concert.screens.screens.map((screen) => screen.material.emissiveTexture?.name),
  registryUnchanged: JSON.stringify(registry.snapshot()) === JSON.stringify(initial),
  resources: { cameras: scene.cameras.length, nodes: scene.transformNodes.length, textures: scene.textures.length,
    before: scene.onBeforeRenderObservable.observers.filter((o) => !o._willBeUnregistered).length,
    after: scene.onAfterRenderObservable.observers.filter((o) => !o._willBeUnregistered).length },
  targets: scene.customRenderTargets.map((target) => ({ name: target.name, width: target.getSize().width, height: target.getSize().height,
    excluded: target.renderList?.every((mesh) => mesh.metadata?.category === 'concert'), layerCheck: target.forceLayerMaskCheck })),
});
const digest = async (texture: BaseTexture) => {
  const pixels = await texture.readPixels(); if (!pixels) throw new Error('Pixels du trajet indisponibles.');
  const bytes = new Uint8Array(new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].join(',');
};
const release = () => { lifetime.abort(); temp?.dispose(); destination?.dispose(); temp = undefined; destination = undefined; };
const waitFor = (predicate: () => boolean) => new Promise<void>((resolve, reject) => {
  if (predicate()) { resolve(); return; }
  const timeout = setTimeout(() => { scene.onAfterRenderObservable.remove(frame); reject(new Error(`Attente de trajet : ${JSON.stringify(status())}`)); }, 30000);
  const frame = scene.onAfterRenderObservable.add(() => { if (predicate()) { clearTimeout(timeout); scene.onAfterRenderObservable.remove(frame); resolve(); } });
});
const nextFrame = () => new Promise<void>((resolve) => { scene.onAfterRenderObservable.addOnce(() => resolve()); });
const digestBytes = async (pixels: ArrayBufferView) => {
  const bytes = new Uint8Array(new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].join(',');
};
const endpoints = new Map<ScreenId, { source: Promise<{ temporary: string; reference: string }>; before: Promise<string>; after?: Promise<string> }>();
let maxBound = 0;
scene.onAfterRenderObservable.add(() => {
  if (!running || ['completed', 'error', 'cancelled'].includes(director.transitionSnapshot().phase)) return;
  const target = scene.customRenderTargets.find((target) => target.activeCamera?.name === 'travel-camera');
  if (!target) return;
  const camera = target.activeCamera!, root = camera.parent as TransformNode;
  const atEnd = root.position.asArray().every((value, i) => value === initial.cameras[3].pose.position[i]);
  const bound = concert.screens.screens.filter((screen) => screen.material.emissiveTexture === target); maxBound = Math.max(maxBound, bound.length);
  const framebuffer = () => engine.readPixels(0, 0, engine.getRenderWidth(), engine.getRenderHeight()).then(digestBytes);
  if (atEnd) for (const screen of bound) if (!endpoints.has(screen.definition.id)) {
    const reference = scene.customRenderTargets.find((target) => target.activeCamera?.name === 'capture-camera-4')!;
    endpoints.set(screen.definition.id, { before: framebuffer(), source: Promise.all([digest(target), digest(reference)]).then(([temporary, reference]) => ({ temporary, reference })) });
  }
  for (const screen of concert.screens.screens) {
    const endpoint = endpoints.get(screen.definition.id);
    if (endpoint && !endpoint.after && screen.material.emissiveTexture?.name === 'feed-capture-camera-4') endpoint.after = framebuffer();
  }
});
Object.assign(window, { travelSource: {
  status,
  async start() {
    await ready; release(); lifetime = new AbortController();
    destination = renderer.retain({ owner: 'destination', source: 4, use: 'travel', rendering: true }, lifetime.signal); await destination.ready;
    temp = renderer.retainTemporary('travel', path.from, lifetime.signal); await temp.ready;
    return status();
  },
  async pose(progress: number, reference: CameraId = 1) {
    if (!temp) throw new Error('Source temporaire absente.');
    temp.setPose(travelPose(path, progress)); await temp.waitForFrame(lifetime.signal);
    const source = renderer.retain({ owner: 'reference', source: reference, use: 'travel', rendering: true }, lifetime.signal);
    try { await source.ready; return { temporary: await digest(temp.texture), reference: await digest(source.texture), ...status() }; }
    finally { source.dispose(); }
  },
  cancel() { release(); return status(); },
  async stopPending() {
    if (!temp) throw new Error('Source temporaire absente.');
    temp.setPose(travelPose(path, 0.5));
    const frame = temp.waitForFrame(lifetime.signal).then(() => 'drawn', () => 'cancelled');
    release(); return { result: await frame, ...status() };
  },
  async startPass(targets: number[] = [1, 2, 3], delayMs = 200, screenOrder: readonly ScreenId[] = [3, 1, 2]) {
    await ready; release(); nowMs = 0; runningError = undefined; endpoints.clear(); maxBound = 0;
    running = director.assign(4, targets, { mode: 'virtual-travel', durationMs: 2000, delayMs, screenOrder });
    void running.catch((error: unknown) => { runningError = String(error); });
    await waitFor(() => !!waiting || ['error', 'completed'].includes(director.transitionSnapshot().phase) || !!runningError);
    return status();
  },
  async advancePass(time: number) {
    if (!waiting) throw new Error('Aucun échantillon de trajet en attente.'); waiting(time);
    await waitFor(() => !!waiting || ['error', 'completed', 'cancelled'].includes(director.transitionSnapshot().phase));
    await nextFrame(); return status();
  },
  async cancelPass() { director.cancelTransition(); await running?.catch(() => undefined); running = undefined; await nextFrame(); return status(); },
  async failPass(time: number) {
    if (!waiting) throw new Error('Aucun échantillon de trajet en attente.');
    scene.onBeforeRenderObservable.addOnce(() => engine.onEffectErrorObservable.notifyObservers({ effect: {} as Effect, errors: 'Erreur de rendu injectée pendant le trajet.' }));
    waiting(time); await waitFor(() => director.transitionSnapshot().phase === 'error'); await nextFrame(); return status();
  },
  async screenHashes() { return Promise.all(concert.screens.screens.map((screen) => digest(screen.material.emissiveTexture!))); },
  async endpointProof() { return { maxBound, endpoints: await Promise.all([...endpoints].map(async ([screen, entry]) => ({ screen, ...await entry.source, before: await entry.before, after: entry.after ? await entry.after : null }))) }; },
} });
window.addEventListener('pagehide', () => { release(); director.dispose(); cameras.dispose(); show.dispose(); scene.dispose(); engine.dispose(); }, { once: true });
