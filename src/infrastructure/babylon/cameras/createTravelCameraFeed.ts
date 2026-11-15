import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { TravelPose } from '../../../domain/cameras/travelPath';
import { validateCameraView } from '../../../domain/cameras/cameraDefinition';
import { degreesToRadians } from '../../../domain/cameras/cameraEditing';
import { validateFeedSize } from '../../../domain/rendering/cameraFeed';
import type { FeedSize } from '../../../domain/rendering/cameraFeed';
import { createCameraFeed } from '../rendering/createCameraFeed';
import { concertLayer } from './createCaptureCameras';

function validatePose(pose: TravelPose) {
  validateCameraView({ pose: { position: pose.position, rotation: pose.rotation }, fovDegrees: pose.fovDegrees, near: pose.near, far: pose.far });
}

/** Owns one unnumbered camera, its rig, feed and every fresh-frame waiter. */
export function createTravelCameraFeed(scene: Scene, parent: TransformNode, initial: TravelPose, size: FeedSize, createFeed = createCameraFeed) {
  validatePose(initial); validateFeedSize(size);
  const root = new TransformNode('travel-camera-rig', scene); root.parent = parent;
  const camera = new FreeCamera('travel-camera', Vector3.Zero(), scene, false);
  camera.parent = root; camera.rotationQuaternion = Quaternion.Identity();
  root.rotationQuaternion = Quaternion.Identity();
  camera.inputs.clear(); camera.fovMode = Camera.FOVMODE_VERTICAL_FIXED; camera.layerMask = concertLayer;
  let disposed = false;
  const waiters = new Set<(error: Error) => void>();
  const setPose = (pose: TravelPose) => {
    if (disposed) throw new Error('Caméra temporaire libérée.');
    validatePose(pose);
    for (const reject of [...waiters]) reject(new Error('Pose du trajet remplacée avant son rendu.'));
    root.position.set(...pose.position); root.rotationQuaternion!.copyFromFloats(...pose.rotation); root.computeWorldMatrix(true);
    camera.fov = degreesToRadians(pose.fovDegrees); camera.minZ = pose.near; camera.maxZ = pose.far;
  };
  let feed: ReturnType<typeof createCameraFeed>;
  try { setPose(initial); feed = createFeed(scene, camera, size); }
  catch (error) { camera.dispose(); root.dispose(); throw error; }
  void feed.ready.catch(() => undefined);
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const reject of [...waiters]) reject(new Error('Caméra temporaire libérée.'));
    scene.onDisposeObservable.remove(stopped);
    feed.dispose(); camera.dispose(); root.dispose();
  };
  const stopped = scene.onDisposeObservable.add(dispose);
  return {
    texture: feed.texture, ready: feed.ready, setPose, dispose,
    setRenderingEnabled: (enabled: boolean) => { if (!disposed) feed.setRenderingEnabled(enabled); },
    waitForFrame(signal: AbortSignal): Promise<void> {
      if (disposed || signal.aborted) return Promise.reject(new Error('Attente du trajet annulée.'));
      return new Promise((resolve, reject) => {
        let drawn = false, settled = false;
        const finish = (error?: Error) => {
          if (settled) return;
          settled = true; detachDraw(); scene.onAfterRenderObservable.remove(after);
          scene.getEngine().onEffectErrorObservable.remove(failed); signal.removeEventListener('abort', cancelled); waiters.delete(finish);
          if (error) reject(error); else resolve();
        };
        const detachDraw = feed.onFrameRendered(() => { drawn = true; });
        const after = scene.onAfterRenderObservable.add(() => {
          if (drawn && feed.texture.isReadyForRendering()) finish();
        });
        const failed = scene.getEngine().onEffectErrorObservable.add(({ errors }) => finish(new Error(`Rendu du trajet impossible : ${errors}`)));
        const cancelled = () => finish(new Error('Attente du trajet annulée.'));
        waiters.add(finish); signal.addEventListener('abort', cancelled, { once: true });
      });
    },
  };
}
