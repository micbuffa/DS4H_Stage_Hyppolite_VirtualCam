import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { createScreens } from '../../../src/infrastructure/babylon/models/screens/createScreens';
import { screenLayout } from '../../../src/domain/concert/concertLayout';
import { CameraRegistry } from '../../../src/domain/cameras/cameraRegistry';
import { createCameraPresets } from '../../../src/domain/cameras/cameraPresets';
import { createCaptureCameras } from '../../../src/infrastructure/babylon/cameras/createCaptureCameras';
import { createRoutingRenderer } from '../../../src/infrastructure/babylon/rendering/createRoutingRenderer';
import { createCameraFeed } from '../../../src/infrastructure/babylon/rendering/createCameraFeed';
import { createTransitionComposition } from '../../../src/infrastructure/babylon/rendering/createTransitionComposition';
import { transitionVertex, transitionFragment } from '../../../src/infrastructure/babylon/rendering/shaders/basicTransitionShaders';
import { watchSceneReadiness } from '../../../src/infrastructure/babylon/engine/watchSceneReadiness';
import { RoutingDirector } from '../../../src/application/commands/routingDirector';
import type { TransitionMode, WipeDirection } from '../../../src/domain/direction/transitionDefinition';
import type { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransitionCancelledError } from '../../../src/application/commands/abortable';
import { createConcertScene } from '../../../src/infrastructure/babylon/engine/createObservationScene';
import { attachConcertShow } from '../../../src/infrastructure/babylon/engine/attachConcertShow';
import type { TransitionSettings } from '../../../src/domain/direction/transitionDefinition';
import { crowdLift, performerMotion } from '../../../src/domain/concert/concertMotion';
import { previewHarness } from './previewHarness';
import type { ScreenId } from '../../../src/domain/direction/screenRouting';

const canvas = document.querySelector('canvas')!;
const engine = new Engine(canvas, true, { preserveDrawingBuffer: true });
const concert = new URLSearchParams(location.search).has('concert') ? createConcertScene(engine) : undefined;
const scene = concert?.scene ?? new Scene(engine);
const screens = concert?.screens ?? createScreens(scene, screenLayout);
const show = concert ? attachConcertShow(concert) : undefined;
if (show) show.clock.paused = true;
const registry = new CameraRegistry(createCameraPresets());
const cameras = createCaptureCameras(scene, registry);
const planes: Mesh[] = [];
const previewMode = new URLSearchParams(location.search).has('preview');
for (const id of (previewMode ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [1, 2, 3, 4]) as readonly (1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9)[]) {
  if (concert) break;
  const camera = cameras.rigs.get(id)!.camera;
  registry.updatePose(id, { position: [30, 7, 20 - 4.5 / Math.tan(camera.fov / 2)], rotation: [0, 0, 0, 1] });
  const plane = CreatePlane(`pattern-${id}`, { width: 16, height: 9 }, scene);
  plane.position.set(30, 7, 20); plane.layerMask = camera.layerMask = 1 << (id + 3);
  plane.metadata = { category: 'concert' };
  const bytes = new Uint8Array(64 * 36 * 4);
  for (let y = 0; y < 36; y++) for (let x = 0; x < 64; x++) {
    const color = id > 4 ? [40 + id * 15, 210 - id * 12, 80 + id * 8] : id === 4 ? [220, 130, 35] : id === 1 ? [30, 60, 120] : id === 2 ? [60, 180, 90] : [160, 50, 190];
    if (x < 13 && y < 8) color.splice(0, 3, id === 4 ? 240 : 40, id === 4 ? 40 : 210, 100);
    if (x > 50 && y > 28) color.splice(0, 3, id === 4 ? 20 : 230, 120, id === 4 ? 220 : 40);
    bytes.set([...color, 255], (y * 64 + x) * 4);
  }
  const material = new StandardMaterial(`pattern-${id}-material`, scene);
  material.disableLighting = true; material.diffuseColor = Color3.Black(); material.emissiveColor = Color3.Black();
  material.emissiveTexture = RawTexture.CreateRGBATexture(bytes, 64, 36, scene, false, false, Texture.NEAREST_SAMPLINGMODE);
  plane.material = material; planes.push(plane);
}
const observer = new FreeCamera('screen-inspector', new Vector3(-17, 7, 0), scene);
observer.inputs.clear(); observer.setTarget(new Vector3(-17, 7, 10)); observer.layerMask = 1;
observer.mode = Camera.ORTHOGRAPHIC_CAMERA;
observer.orthoLeft = -4; observer.orthoRight = 4; observer.orthoTop = 2.25; observer.orthoBottom = -2.25;
scene.activeCamera = observer;
const initiallyOffline = new URLSearchParams(location.search).has('offline');
let failure: 'none' | 'source' | 'shader' = initiallyOffline ? 'source' : 'none';
let failedSource = initiallyOffline ? 1 : 4;
const delayedSources = new Map<number, { ready: Promise<void>; resolve(): void }>();
const sourceFrames: Record<string, number> = {};
const renderer = createRoutingRenderer(scene, screens, cameras, {
  createFeed: (scene, camera, size) => {
    const id = [...cameras.rigs].find(([, rig]) => rig.camera === camera)?.[0] ?? 'temporary';
    if (failure === 'source' && id === failedSource) throw new Error(`Source C${id} indisponible (recette).`);
    const feed = createCameraFeed(scene, camera, size);
    const detach = feed.onFrameRendered(() => { sourceFrames[id] = (sourceFrames[id] ?? 0) + 1; });
    return { ...feed, ready: typeof id === 'number' && delayedSources.has(id) ? Promise.all([feed.ready, delayedSources.get(id)!.ready]).then(() => undefined) : feed.ready, dispose() { detach(); feed.dispose(); } };
  },
  waitForPresentation: watchSceneReadiness,
  createComposition: (scene, screens) => ({ prepare: (plan, sources, signal) => createTransitionComposition(scene, screens, { vertex: transitionVertex, fragment: failure === 'shader' ? 'not a valid GLSL shader' : transitionFragment }).prepare(plan, sources, signal) }),
});
// Resolve the real composition lazily so tests can inject a preparation failure.
const realDriver = renderer.createTransitionDriver(document);
let nowMs = 0;
let realtime = false;
let waiting: ((time: number) => void) | undefined;
const driver = { ...realDriver, sample: () => realtime ? realDriver.sample() : ({ nowMs, visible: true }), nextSample: (signal: AbortSignal) => realtime ? realDriver.nextSample(signal) : new Promise<{ nowMs: number; visible: boolean }>((resolve, reject) => {
  const abort = () => { waiting = undefined; reject(new TransitionCancelledError()); };
  signal.addEventListener('abort', abort, { once: true });
  waiting = (time) => { signal.removeEventListener('abort', abort); waiting = undefined; nowMs = time; resolve({ nowMs, visible: true }); };
}) };
const preview: ReturnType<typeof previewHarness> | undefined = previewMode ? previewHarness(scene, observer, registry, renderer, driver, () => director, () => failure === 'shader', () => { nowMs = 0; }) : undefined;
const director: RoutingDirector = new RoutingDirector(registry, renderer, driver, undefined, preview?.controller);
let running: Promise<void> | undefined;
let maxActive = 0;
const waitFor = (predicate: () => boolean) => new Promise<void>((resolve, reject) => {
  if (predicate()) { resolve(); return; }
  const timeout = setTimeout(() => { scene.onAfterRenderObservable.remove(frame); reject(new Error(`État de recette bloqué : ${JSON.stringify({ ...status(), ready: scene.isReady(true), targets: scene.customRenderTargets.map((target) => [target.name, target.isReadyForRendering()]), unready: scene.meshes.filter((mesh) => !mesh.isReady(true)).map((mesh) => mesh.name), pending: scene.getWaitingItemsCount(), observers: scene.onAfterRenderObservable.observers.filter((item) => !item._willBeUnregistered).length })}`)); }, 10000);
  const frame = scene.onAfterRenderObservable.add(() => { if (predicate()) { clearTimeout(timeout); scene.onAfterRenderObservable.remove(frame); resolve(); } });
});
const nextFrame = () => new Promise<void>((resolve) => { scene.onAfterRenderObservable.addOnce(() => resolve()); });
const status = () => ({ routes: director.snapshot().routes, phase: director.transitionSnapshot().phase, progress: director.transitionSnapshot().frame?.progress ?? 0,
  steps: director.transitionSnapshot().frame?.screens, totalMs: director.transitionSnapshot().plan?.totalMs,
  error: director.transitionSnapshot().error, stats: renderer.stats(), maxActive, observer: scene.activeCamera === observer,
  materials: scene.materials.filter((material) => material.name.startsWith('transition-screen-')).length, effectsReady: engine.areAllEffectsReady(), frames: { ...sourceFrames },
  preview: preview?.controller.snapshot(), liveMaterials: screens.screens.every((screen) => screen.surface.material === screen.material),
  resources: { meshes: scene.meshes.length, materials: scene.materials.length, textures: scene.textures.length,
    before: scene.onBeforeRenderObservable.observers.filter((item) => !item._willBeUnregistered).length, after: scene.onAfterRenderObservable.observers.filter((item) => !item._willBeUnregistered).length },
  renderTargets: scene.customRenderTargets.map((target) => ({ id: target.uniqueId, name: target.name, size: target.getSize(), includesMonitor: target.renderList?.some((mesh) => mesh.name.startsWith('preview-monitor')) ?? false })) });
scene.onAfterRenderObservable.add(() => { maxActive = Math.max(maxActive, scene.customRenderTargets.length); document.body.dataset.phase = director.transitionSnapshot().phase; });
engine.runRenderLoop(() => scene.render());
const ready = director.initialize().catch((error: unknown) => { if (!initiallyOffline) throw error; }).then(() => renderer.setQuality('reduced')).then(() => { document.body.dataset.ready = 'true'; });
void ready.catch((error: unknown) => { document.body.dataset.error = String(error); });

Object.assign(window, { transitions: {
  ...preview?.api(waitFor, nextFrame, ready, () => !!waiting, (progress) => { waiting?.(progress * 1000); }),
  status,
  cameras: () => ({ definitions: registry.snapshot().cameras, native: [...cameras.rigs].map(([id, { root, camera }]) => ({ id, position: root.position.asArray(), rotation: root.rotationQuaternion?.asArray(), cameraPosition: camera.position.asArray(), cameraRotation: camera.rotationQuaternion?.asArray(), fov: camera.fov })) }),
  async cut(id: number, targets = [1, 2, 3]) { await ready; await director.assign(id, targets, { mode: 'cut', order: 'simultaneous' }); await nextFrame(); return status(); },
  async sequence(mode: TransitionMode, targets: number[], screenOrder: readonly ScreenId[], delayMs: number, durationMs = 600) {
    await ready; nowMs = 0; director.configureTransition({ mode, order: 'staggered', screenOrder, delayMs, durationMs });
    running = director.assign(4, targets); void running.catch(() => undefined);
    await waitFor(() => !!waiting || ['completed', 'error'].includes(director.transitionSnapshot().phase)); await nextFrame(); return status();
  },
  async advanceSequence(time: number) {
    if (waiting) waiting(time);
    await waitFor(() => !!waiting || ['completed', 'error'].includes(director.transitionSnapshot().phase)); await nextFrame(); return status();
  },
  async inspectScreen(id: ScreenId) {
    const screen = screenLayout.find((screen) => screen.id === id)!;
    observer.position.set(screen.position.x, screen.position.y, 0); observer.setTarget(new Vector3(screen.position.x, screen.position.y, screen.position.z)); observer.layerMask = 1;
    observer.orthoLeft = -screen.width / 2; observer.orthoRight = screen.width / 2; observer.orthoTop = screen.height / 2; observer.orthoBottom = -screen.height / 2; await nextFrame();
  },
  async start(mode: TransitionMode, direction: WipeDirection = 'left', targets = [1], parameters: Partial<TransitionSettings['parameters']> = {}) {
    await ready; nowMs = 0;
    director.configureTransition({ mode, durationMs: realtime ? 3000 : 1000, parameters: { direction, ...parameters } });
    running = director.assign(4, targets); void running.catch(() => undefined);
    await waitFor(() => !!waiting || (realtime && director.transitionSnapshot().phase === 'transitioning') || director.transitionSnapshot().phase === 'error');
    await nextFrame(); return status();
  },
  async advance(progress: number) {
    if (waiting) waiting(progress * 1000);
    if (progress === 1) await waitFor(() => ['completed', 'error'].includes(director.transitionSnapshot().phase));
    else await waitFor(() => !!waiting || director.transitionSnapshot().phase === 'error');
    await nextFrame(); return status();
  },
  async cancel() { director.cancelTransition(); await running?.catch(() => undefined); await nextFrame(); return status(); },
  async samples(points: readonly (readonly [number, number])[] = [[0.13, 0.13], [0.87, 0.13], [0.37, 0.63], [0.13, 0.87], [0.87, 0.87]]) {
    await nextFrame();
    const view = await engine.readPixels(0, 0, 640, 360);
    const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    const samples = points.map(([x, y]) => [...bytes.slice(((359 - Math.floor(y * 360)) * 640 + Math.floor(x * 640)) * 4, ((359 - Math.floor(y * 360)) * 640 + Math.floor(x * 640)) * 4 + 4)]);
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes)))].join(',');
    let minColor = 765, opaque = true, maxChannel = 0;
    for (let index = 0; index < bytes.length; index += 4) {
      minColor = Math.min(minColor, bytes[index] + bytes[index + 1] + bytes[index + 2]); opaque &&= bytes[index + 3] === 255;
      maxChannel = Math.max(maxChannel, bytes[index], bytes[index + 1], bytes[index + 2]);
    }
    return { samples, hash, minColor, opaque, maxChannel };
  },
  detailPatterns() {
    for (const [index, plane] of planes.entries()) {
      const bytes = new Uint8Array(64 * 36 * 4);
      for (let y = 0; y < 36; y++) for (let x = 0; x < 64; x++) {
        const stripe = (Math.floor(x / 3) + Math.floor(y / 3)) % 2;
        const color = index === 3 ? [220 - x * 2, 190 - y * 3, 90 + stripe * 120] : [35 + x * 3, 40 + y * 4, 45 + stripe * 120];
        if (x < 8 && y < 5) color.splice(0, 3, index === 3 ? 240 : 40, index === 3 ? 40 : 210, 100);
        if (x > 56 && y > 29) color.splice(0, 3, index === 3 ? 20 : 230, 120, index === 3 ? 220 : 40);
        bytes.set([...color, 255], (y * 64 + x) * 4);
      }
      ((plane.material as StandardMaterial).emissiveTexture as RawTexture).update(bytes);
    }
  },
  concertTime(seconds: number) {
    if (!concert || !show) throw new Error('La scène de concert est requise.');
    concert.band.musicians.forEach(({ root, definition }, index) => {
      const pose = performerMotion(seconds, index);
      root.position.y = definition.position[1] + pose.lift;
      root.rotation.y = definition.yaw + pose.yaw; root.rotation.z = pose.roll;
    });
    concert.audience.spectators.filter((_, index) => index % 5 === 0).forEach((person, index) => { person.position.y = crowdLift(seconds, index); });
    show.lighting.update(seconds);
  },
  movePatterns() { for (const plane of planes) plane.position.x += 1; },
  realtime() { realtime = true; },
  visibility(hidden: boolean) { Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden }); document.dispatchEvent(new Event('visibilitychange')); },
  fail(kind: typeof failure) { failure = kind; },
  failSource(id: number) { failedSource = id; failure = 'source'; },
  delaySource(id: number) { let resolve!: () => void; const ready = new Promise<void>((done) => { resolve = done; }); delayedSources.set(id, { ready, resolve }); },
  resolveSource(id: number) { delayedSources.get(id)?.resolve(); delayedSources.delete(id); },
  failDuring() { for (const screen of screens.screens) if (screen.surface.material !== screen.material) { const shader = screen.surface.material as ShaderMaterial; shader.onError?.(shader.getEffect()!, 'Erreur de shader pendant le passage (recette).'); } },
} });
window.addEventListener('pagehide', () => { preview?.dispose(); director.dispose(); cameras.dispose(); screens.dispose(); scene.dispose(); engine.dispose(); }, { once: true });
