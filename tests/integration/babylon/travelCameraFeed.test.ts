import { expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Effect } from '@babylonjs/core/Materials/effect';
import { CameraRegistry } from '../../../src/domain/cameras/cameraRegistry';
import { createCameraPresets } from '../../../src/domain/cameras/cameraPresets';
import { createTravelPath } from '../../../src/domain/cameras/travelPath';
import { createCaptureCameras } from '../../../src/infrastructure/babylon/cameras/createCaptureCameras';
import { createTravelCameraFeed } from '../../../src/infrastructure/babylon/cameras/createTravelCameraFeed';
import { createCameraFeed } from '../../../src/infrastructure/babylon/rendering/createCameraFeed';

const definitions = createCameraPresets(), path = createTravelPath(definitions[0], definitions[3]);
const size = { width: 512, height: 288 };
const count = (scene: Scene) => ({ cameras: [...scene.cameras], nodes: [...scene.transformNodes], textures: [...scene.textures], targets: [...scene.customRenderTargets],
  before: scene.onBeforeRenderObservable.observers.filter((o) => !o._willBeUnregistered).length,
  after: scene.onAfterRenderObservable.observers.filter((o) => !o._willBeUnregistered).length,
  errors: scene.getEngine().onEffectErrorObservable.observers.filter((o) => !o._willBeUnregistered).length });

it('uses the capture hierarchy and projection without numbered registration, helpers, inputs or observer mutation', () => {
  const engine = new NullEngine(); const scene = new Scene(engine);
  const observer = new FreeCamera('observer', new Vector3(0, 10, -30), scene);
  const registry = new CameraRegistry(definitions), rigs = createCaptureCameras(scene, registry);
  const before = registry.snapshot(), baseline = count(scene);
  const feed = createTravelCameraFeed(scene, rigs.root, path.from, size);
  try {
    const camera = feed.texture.activeCamera as FreeCamera;
    expect(camera.name).toBe('travel-camera'); expect(scene.activeCamera).toBe(observer);
    expect(rigs.rigs.size).toBe(9); expect([...rigs.rigs.values()].some((rig) => rig.camera === camera)).toBe(false);
    expect(Object.keys(camera.inputs.attached)).toHaveLength(0); expect(camera.layerMask).toBe(1);
    expect(camera.fovMode).toBe(Camera.FOVMODE_VERTICAL_FIXED); expect(camera.position.asArray()).toEqual([0, 0, 0]);
    expect(camera.parent?.parent).toBe(rigs.root);
    expect(feed.texture.getSize()).toEqual(size); expect(feed.texture.forceLayerMaskCheck).toBe(true);
    for (const [pose, id] of [[path.from, 1], [path.to, 4]] as const) {
      feed.setPose(pose); const capture = rigs.rigs.get(id)!.camera;
      expect([...camera.getViewMatrix(true).asArray()]).toEqual([...capture.getViewMatrix(true).asArray()]);
      expect(camera.fov).toBe(capture.fov); expect(camera.minZ).toBe(capture.minZ); expect(camera.maxZ).toBe(capture.maxZ);
    }
    expect(registry.snapshot()).toEqual(before);
    feed.dispose(); feed.dispose(); expect(count(scene)).toEqual(baseline);
    expect(() => feed.setPose(path.to)).toThrow('libérée');
  } finally { feed.dispose(); rigs.dispose(); scene.dispose(); engine.dispose(); }
});

it('uses the existing filmable list and owns its RTT scheduling exactly once', () => {
  const engine = new NullEngine(); const scene = new Scene(engine); const parent = new TransformNode('parent', scene);
  const categories = ['concert', 'video-surface', 'panel', 'camera-helper', 'preview-surface'];
  const meshes = categories.map((category) => { const mesh = CreateBox(category, {}, scene); mesh.metadata = { category }; return mesh; });
  const feed = createTravelCameraFeed(scene, parent, path.from, size);
  try {
    expect(feed.texture.renderList?.map((mesh) => mesh.name)).toEqual([meshes[0].name]);
    feed.setRenderingEnabled(true); feed.setRenderingEnabled(true); expect(scene.customRenderTargets).toEqual([feed.texture]);
    feed.setRenderingEnabled(false); expect(scene.customRenderTargets).toEqual([]);
    feed.setRenderingEnabled(true); expect(scene.customRenderTargets).toEqual([feed.texture]);
    const added = CreateBox('late-concert', {}, scene); added.metadata = { category: 'concert' };
    scene.onBeforeRenderObservable.notifyObservers(scene); expect(feed.texture.renderList?.map((mesh) => mesh.name)).toEqual([meshes[0].name, added.name]);
    feed.dispose(); expect(scene.customRenderTargets).toEqual([]);
  } finally { feed.dispose(); scene.dispose(); engine.dispose(); }
});

it('waits for a draw then a complete frame, not a readiness-only or RTT bind event', async () => {
  const engine = new NullEngine(); const scene = new Scene(engine); const parent = new TransformNode('parent', scene);
  const draws = new Set<() => void>();
  const feed = createTravelCameraFeed(scene, parent, path.from, size, (scene, camera, size) => {
    const native = createCameraFeed(scene, camera, size); void native.ready.catch(() => undefined);
    return { ...native, ready: Promise.resolve(), onFrameRendered(callback: () => void) { draws.add(callback); return () => draws.delete(callback); } };
  });
  const ready = vi.spyOn(feed.texture, 'isReadyForRendering').mockReturnValue(true);
  try {
    const baseline = count(scene); let resolved = false;
    const waiting = feed.waitForFrame(new AbortController().signal).then(() => { resolved = true; });
    feed.texture.onAfterRenderObservable.notifyObservers(0); scene.onAfterRenderObservable.notifyObservers(scene); await Promise.resolve();
    expect(resolved).toBe(false);
    for (const draw of draws) draw(); await Promise.resolve(); expect(resolved).toBe(false);
    scene.onAfterRenderObservable.notifyObservers(scene); await waiting; expect(resolved).toBe(true);
    expect(draws.size).toBe(0); expect(count(scene)).toEqual(baseline);
  } finally { ready.mockRestore(); feed.dispose(); scene.dispose(); engine.dispose(); }
});

it.each(['abort', 'pose', 'error', 'dispose', 'scene'])('rejects a pending fresh-frame wait and removes its observers on %s', async (reason) => {
  const engine = new NullEngine(); const scene = new Scene(engine); const parent = new TransformNode('parent', scene);
  const feed = createTravelCameraFeed(scene, parent, path.from, size); const controller = new AbortController();
  try {
    const before = count(scene); const rejected = expect(feed.waitForFrame(controller.signal)).rejects.toThrow();
    if (reason === 'abort') controller.abort();
    else if (reason === 'pose') feed.setPose(path.to);
    else if (reason === 'error') engine.onEffectErrorObservable.notifyObservers({ effect: {} as Effect, errors: 'Erreur simulée.' });
    else if (reason === 'scene') scene.dispose(); else feed.dispose();
    await rejected;
    if (reason === 'abort' || reason === 'pose') expect(count(scene)).toEqual(before);
    if (reason === 'error') expect(count(scene).after).toBeLessThanOrEqual(before.after);
    feed.dispose(); expect(scene.customRenderTargets).toHaveLength(0); expect(scene.cameras).toHaveLength(0);
  } finally { feed.dispose(); scene.dispose(); engine.dispose(); }
});

it('cleans failed construction and rejects invalid poses before changing native resources', () => {
  const engine = new NullEngine(); const scene = new Scene(engine); const parent = new TransformNode('parent', scene);
  const before = count(scene);
  try {
    expect(() => createTravelCameraFeed(scene, parent, path.from, size, () => { throw new Error('Allocation simulée.'); })).toThrow('Allocation');
    expect(count(scene)).toEqual(before);
    expect(() => createTravelCameraFeed(scene, parent, { ...path.from, fovDegrees: NaN }, size)).toThrow(); expect(count(scene)).toEqual(before);
    expect(() => createTravelCameraFeed(scene, parent, path.from, { width: 0, height: 0 })).toThrow(); expect(count(scene)).toEqual(before);
    const feed = createTravelCameraFeed(scene, parent, path.from, size);
    const camera = feed.texture.activeCamera!;
    expect(() => feed.setPose({ ...path.to, near: 0 })).toThrow(); expect(camera.fov).toBe(path.from.fovDegrees * Math.PI / 180);
    feed.dispose(); expect(count(scene)).toEqual(before);
  } finally { scene.dispose(); engine.dispose(); }
});
