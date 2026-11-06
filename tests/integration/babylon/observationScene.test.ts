import { expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { createObservationScene } from '../../../src/infrastructure/babylon/engine/createObservationScene';

it('creates an illuminated observation scene and releases its resources', () => {
  const engine = new NullEngine();
  try {
    const scene = createObservationScene(engine);
    expect(scene.cameras).toHaveLength(1);
    const camera = scene.activeCamera as ArcRotateCamera;
    expect(camera).toBeInstanceOf(ArcRotateCamera);
    expect(camera.upperBetaLimit).toBeLessThan(Math.PI / 2);
    expect(camera.panningAxis.y).toBe(0);
    expect(camera.inputs.attached.keyboard).toBeUndefined();
    expect(camera.wheelDeltaPercentage).toBeGreaterThan(0);
    expect(camera.lowerRadiusLimit).toBeGreaterThan(0);
    expect(camera.upperRadiusLimit).toBeGreaterThan(camera.lowerRadiusLimit!);
    expect(scene.lights).toHaveLength(1);
    expect(scene.useRightHandedSystem).toBe(false);
    scene.render();
    expect(scene.getFrameId()).toBeGreaterThan(0);
    scene.dispose();
    expect(scene.isDisposed).toBe(true);
    expect(engine.scenes).toHaveLength(0);
    expect(scene.meshes).toHaveLength(0);
  } finally {
    engine.dispose();
  }
});
