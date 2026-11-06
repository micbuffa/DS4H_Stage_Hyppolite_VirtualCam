import { expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CameraRegistry } from '../../../src/domain/cameras/cameraRegistry';
import { createCameraPresets } from '../../../src/domain/cameras/cameraPresets';
import { createObservationScene } from '../../../src/infrastructure/babylon/engine/createObservationScene';
import { createCaptureCameras, cameraHelperLayer, concertLayer } from '../../../src/infrastructure/babylon/cameras/createCaptureCameras';

it('keeps nine capture cameras synchronized with rigs, independent from observation and screens', () => {
  const engine = new NullEngine();
  const scene = createObservationScene(engine);
  const observer = scene.activeCamera;
  const registry = new CameraRegistry(createCameraPresets());
  const textures = [...scene.textures];
  const materials = [...scene.materials];
  const captures = createCaptureCameras(scene, registry);
  try {
    expect(scene.cameras).toHaveLength(10);
    expect(scene.activeCamera).toBe(observer);
    expect(captures.rigs.size).toBe(9);
    for (const [id, rig] of captures.rigs) {
      const definition = registry.snapshot().cameras.find((camera) => camera.id === id)!;
      expect(rig.camera.parent).toBe(rig.root);
      expect(rig.camera.position.asArray()).toEqual([0, 0, 0]);
      expect(rig.camera.inputs.attached).toEqual({});
      expect(rig.camera.layerMask).toBe(concertLayer);
      expect(rig.body.layerMask).toBe(cameraHelperLayer);
      expect(rig.camera.fov).toBeCloseTo(definition.fovDegrees * Math.PI / 180);
      rig.camera.getViewMatrix(true);
      expect(Vector3.Distance(rig.camera.globalPosition, rig.root.position)).toBeLessThan(1e-5);
    }
    registry.select(4);
    registry.updatePose(4, { position: [2, 5, -2], rotation: [0, 0, 0, 1] });
    const rig = captures.rigs.get(4)!;
    rig.camera.getViewMatrix(true);
    expect(rig.camera.globalPosition.asArray()).toEqual([2, 5, -2]);
    expect(rig.camera.getDirection(Vector3.Forward()).z).toBeCloseTo(1);
    expect(scene.getMeshByName('camera-selection-frustum')?.parent).toBe(rig.root);
    expect(scene.meshes.filter((mesh) => mesh.name === 'camera-selection-frustum')).toHaveLength(1);
    registry.setAidsVisible(false);
    expect(scene.getMeshByName('camera-selection-frustum')?.isEnabled()).toBe(false);
    registry.setAidsVisible(true);
    registry.resetSelected();
    expect(rig.root.position.asArray()).toEqual([...createCameraPresets()[3].pose.position]);
    expect(scene.activeCamera).toBe(observer);
    expect(scene.customRenderTargets).toHaveLength(0);
    textures.forEach((texture) => expect(scene.textures).toContain(texture));
    const meshCount = scene.meshes.length;
    const materialCount = scene.materials.length;
    for (let step = 0; step < 20; step++) registry.select(step % 9 + 1);
    expect(scene.meshes).toHaveLength(meshCount);
    expect(scene.materials).toHaveLength(materialCount);
    captures.dispose(); captures.dispose();
    expect(scene.cameras).toHaveLength(1);
    expect(scene.textures).toEqual(textures);
    expect(scene.materials).toEqual(materials);
    expect(scene.meshes.some((mesh) => mesh.metadata?.category === 'camera-helper')).toBe(false);
    registry.select(6); // No renderer listener remains after disposal.
  } finally { scene.dispose(); engine.dispose(); }
});
