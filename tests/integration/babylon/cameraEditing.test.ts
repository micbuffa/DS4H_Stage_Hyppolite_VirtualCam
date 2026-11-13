import { expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CameraRegistry } from '../../../src/domain/cameras/cameraRegistry';
import { createCameraPresets } from '../../../src/domain/cameras/cameraPresets';
import { CameraEditor } from '../../../src/application/commands/cameraEditor';
import { createObservationScene } from '../../../src/infrastructure/babylon/engine/createObservationScene';
import { createCaptureCameras } from '../../../src/infrastructure/babylon/cameras/createCaptureCameras';
import { createCameraGizmos } from '../../../src/infrastructure/babylon/interaction/createCameraGizmos';

it('attaches only the chosen tool and rig, updates native pose/FOV and frustum, and cleans utility resources', () => {
  const engine = new NullEngine();
  const scene = createObservationScene(engine);
  const registry = new CameraRegistry(createCameraPresets());
  const captures = createCaptureCameras(scene, registry);
  const editor = new CameraEditor(registry, { suspend: vi.fn(), resume: vi.fn() });
  const gizmos = createCameraGizmos(scene, captures, registry, editor);
  const observer = scene.activeCamera;
  try {
    expect(gizmos.move.attachedNode).toBeNull(); expect(gizmos.rotate.attachedNode).toBeNull();
    editor.setMode('move'); registry.select(4);
    const rig = captures.rigs.get(4)!;
    expect(gizmos.move.attachedNode).toBe(rig.root); expect(gizmos.rotate.attachedNode).toBeNull();
    expect(gizmos.move.updateGizmoRotationToMatchAttachedMesh).toBe(false);
    editor.begin(); editor.preview({ position: [2, 7, -9], rotation: [0, 0, 0, 1] }); editor.finish();
    rig.camera.getViewMatrix(true);
    expect(Vector3.Distance(rig.camera.globalPosition, new Vector3(2, 7, -9))).toBeLessThan(1e-5);
    expect(rig.camera.position.asArray()).toEqual([0, 0, 0]);
    const frustum = scene.getMeshByName('camera-selection-frustum')!;
    const oldBounds = frustum.getBoundingInfo().boundingBox.extendSize.clone();
    editor.adjustFov(5);
    expect(rig.camera.fov).toBeCloseTo(editor.selected().fovDegrees * Math.PI / 180);
    expect(scene.getMeshByName('camera-selection-frustum')!.getBoundingInfo().boundingBox.extendSize.x).toBeGreaterThan(oldBounds.x);
    editor.setMode('rotate');
    expect(gizmos.move.attachedNode).toBeNull(); expect(gizmos.rotate.attachedNode).toBe(rig.root);
    expect(gizmos.rotate.updateGizmoRotationToMatchAttachedMesh).toBe(true);
    expect(scene.activeCamera).toBe(observer);
    expect(gizmos.layer.getRenderCamera()).toBe(observer);
    gizmos.dispose(); gizmos.dispose(); expect(engine.scenes).toEqual([scene]);
  } finally { gizmos.dispose(); editor.dispose(); captures.dispose(); scene.dispose(); engine.dispose(); }
});
