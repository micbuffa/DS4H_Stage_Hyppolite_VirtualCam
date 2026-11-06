import { RenderTargetTexture } from '@babylonjs/core/Materials/Textures/renderTargetTexture';
import { ObjectRenderer } from '@babylonjs/core/Rendering/objectRenderer';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Camera } from '@babylonjs/core/Cameras/camera';
import type { Scene } from '@babylonjs/core/scene';
import { defaultFeedSize, isFilmable, validateFeedSize } from '../../../domain/rendering/cameraFeed';
import type { FeedSize } from '../../../domain/rendering/cameraFeed';

export function createCameraFeed(scene: Scene, camera: Camera, size: FeedSize = defaultFeedSize) {
  validateFeedSize(size);
  const renderer = new ObjectRenderer(`renderer-${camera.name}`, scene, { doNotChangeAspectRatio: false });
  const texture = new RenderTargetTexture(`feed-${camera.name}`, size, scene, {
    existingObjectRenderer: renderer,
    delayAllocation: true,
    generateMipMaps: false,
    doNotChangeAspectRatio: false,
    samplingMode: Texture.BILINEAR_SAMPLINGMODE,
    generateDepthBuffer: true,
    gammaSpace: true,
  });
  try { texture.resize(size); }
  catch (error) { texture.dispose(); renderer.dispose(); throw error; }
  texture.activeCamera = camera;
  texture.forceLayerMaskCheck = true;
  texture.renderParticles = false;
  texture.renderSprites = false;
  texture.clearColor = scene.clearColor.clone();
  texture.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONEVERYFRAME;
  const meshes: AbstractMesh[] = [];
  texture.renderList = meshes;
  const updateMeshes = () => {
    meshes.length = 0;
    for (const mesh of scene.meshes) if (isFilmable(mesh.metadata)) meshes.push(mesh);
  };
  updateMeshes();
  const before = scene.onBeforeRenderObservable.add(updateMeshes);
  let rendered = false;
  const afterTarget = renderer.onAfterRenderingManagerRenderObservable.add(() => { rendered = true; });
  let resolveReady!: () => void;
  let rejectReady!: (error: Error) => void;
  let pending = true;
  let disposed = false;
  const ready = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  const clearStartup = () => {
    renderer.onAfterRenderingManagerRenderObservable.remove(afterTarget);
    scene.onAfterRenderObservable.remove(afterFrame);
    scene.getEngine().onEffectErrorObservable.remove(onError);
  };
  const afterFrame = scene.onAfterRenderObservable.add(() => {
    // Readiness checks also emit RTT after-render events. Only a rendering-manager pass
    // can set `rendered`; check completeness outside the active GPU pass.
    if (pending && rendered && texture.isReadyForRendering()) {
      pending = false;
      clearStartup();
      resolveReady();
    }
  });
  const onError = scene.getEngine().onEffectErrorObservable.add(({ errors }) => {
    if (!pending) return;
    pending = false;
    clearStartup();
    rejectReady(new Error(`Préparation du flux impossible : ${errors}`));
  });
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    clearStartup();
    scene.onBeforeRenderObservable.remove(before);
    scene.onDisposeObservable.remove(onDispose);
    const index = scene.customRenderTargets.indexOf(texture);
    if (index !== -1) scene.customRenderTargets.splice(index, 1);
    texture.dispose();
    renderer.dispose();
    if (pending) { pending = false; rejectReady(new Error('Préparation du flux annulée.')); }
  };
  const onDispose = scene.onDisposeObservable.add(dispose);
  // Emissive textures are not automatically scheduled by StandardMaterial.
  // Register exactly once here; never call texture.render() in the frame loop.
  scene.customRenderTargets.push(texture);
  return {
    texture, ready, dispose,
    setRenderingEnabled(enabled: boolean) {
      if (disposed) return;
      const index = scene.customRenderTargets.indexOf(texture);
      if (enabled && index === -1) scene.customRenderTargets.push(texture);
      if (!enabled && index !== -1) scene.customRenderTargets.splice(index, 1);
    },
    onFrameRendered(callback: () => void) {
      const observer = renderer.onAfterRenderingManagerRenderObservable.add(callback);
      return () => renderer.onAfterRenderingManagerRenderObservable.remove(observer);
    },
  };
}
