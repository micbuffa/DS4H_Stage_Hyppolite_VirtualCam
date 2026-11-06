import { describe, expect, it, vi } from 'vitest';
import { CameraRegistry } from '../../src/domain/cameras/cameraRegistry';
import { createCameraPresets } from '../../src/domain/cameras/cameraPresets';
import { lookAtRotation, validateCamera } from '../../src/domain/cameras/cameraDefinition';
import type { CameraDefinition } from '../../src/domain/cameras/cameraDefinition';
import { frustumSegments } from '../../src/domain/cameras/frustumSegments';
import { cameraLabel } from '../../src/infrastructure/babylon/ui/cameraLabel';

const registry = () => new CameraRegistry(createCameraPresets());

describe('camera registry', () => {
  it('creates nine distinct, valid plans with stable ids and no observation camera', () => {
    const definitions = createCameraPresets();
    expect(definitions.map((camera) => camera.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(new Set(definitions.map((camera) => camera.pose.position.join(','))).size).toBe(9);
    definitions.forEach((camera) => expect(() => validateCamera(camera)).not.toThrow());
    expect(registry().snapshot().selectedId).toBe(1);
  });
  it.each([0, 10, -1, 1.5, NaN, Infinity])('refuses invalid selection %s without changing state', (id) => {
    const cameras = registry();
    const before = cameras.snapshot();
    expect(() => cameras.select(id)).toThrow('Identifiant');
    expect(cameras.snapshot()).toEqual(before);
  });
  it('selects exactly one camera and does not alter any pose', () => {
    const cameras = registry();
    const definitions = cameras.snapshot().cameras;
    cameras.select(7);
    expect(cameras.snapshot().selectedId).toBe(7);
    expect(cameras.snapshot().cameras).toEqual(definitions);
    cameras.select(3);
    expect(cameras.snapshot().selectedId).toBe(3);
  });
  it('restores only the selected preset and preserves the other edited cameras', () => {
    const cameras = registry();
    const changed = { position: [1, 5, -10] as const, rotation: [0, 0, 0, 1] as const };
    cameras.updatePose(4, changed); cameras.updatePose(5, changed);
    cameras.select(4); cameras.resetSelected();
    const state = cameras.snapshot();
    expect(state.cameras[3]).toEqual(createCameraPresets()[3]);
    expect(state.cameras[4].pose).toEqual(changed);
    expect(state.selectedId).toBe(4);
  });
  it('keeps data isolated from incoming definitions and outgoing snapshots', () => {
    const definitions = createCameraPresets();
    const cameras = new CameraRegistry(definitions);
    definitions[0].pose = definitions[1].pose;
    const snapshot = cameras.snapshot();
    snapshot.cameras[0].name = 'changed';
    expect(cameras.snapshot().cameras[0]).toEqual(createCameraPresets()[0]);
  });
  it('notifies once per state change and removes subscriptions', () => {
    const cameras = registry();
    const notify = vi.fn();
    const unsubscribe = cameras.subscribe(notify);
    cameras.select(1); cameras.setAidsVisible(true);
    expect(notify).toHaveBeenCalledOnce();
    cameras.select(8); cameras.setAidsVisible(false);
    expect(notify).toHaveBeenCalledTimes(3);
    unsubscribe(); cameras.select(9);
    expect(notify).toHaveBeenCalledTimes(3);
  });
  it('rejects missing cameras and duplicate ids', () => {
    const presets = createCameraPresets();
    expect(() => new CameraRegistry(presets.slice(1))).toThrow('Neuf');
    presets[8].id = 1;
    expect(() => new CameraRegistry(presets)).toThrow('dupliqué');
  });
  it.each([
    { pose: { position: [NaN, 2, 1], rotation: [0, 0, 0, 1] } },
    { pose: { position: [0, -1, 1], rotation: [0, 0, 0, 1] } },
    { pose: { position: [0, 2, 1], rotation: [0, 0, 0, 0] } },
    { fovDegrees: 5 }, { near: 0 }, { far: 0.01 },
  ])('rejects invalid camera settings %j', (patch) => {
    const camera = { ...createCameraPresets()[0], ...patch } as CameraDefinition;
    expect(() => validateCamera(camera)).toThrow();
  });
});

it('computes forward and reverse look-at rotations and rejects degenerate targets', () => {
  expect(lookAtRotation([0, 1, 0], [0, 1, 1])).toEqual([-0, 0, 0, 1]);
  expect(Math.abs(lookAtRotation([0, 1, 0], [0, 1, -1])[1])).toBeCloseTo(1);
  expect(() => lookAtRotation([0, 1, 0], [0, 1, 0])).toThrow('Cible');
});
it('builds a vertical FOV frustum with a 16:9 ratio, near plane and aiming axis', () => {
  const lines = frustumSegments(90, 0.1, 5);
  expect(lines).toHaveLength(13);
  expect(lines[0][0][2]).toBe(0.1);
  expect(lines[0][1][2]).toBe(5);
  expect(Math.abs(lines[0][1][1])).toBeCloseTo(5);
  expect(lines[0][1][0] / lines[0][1][1]).toBeCloseTo(16 / 9);
  expect(lines.at(-1)).toEqual([[0, 0, 0], [0, 0, 6]]);
  expect(() => frustumSegments(10, 0.1)).toThrow();
});
it('generates distinct readable camera ids and a separate selection color', () => {
  const labels = Array.from({ length: 9 }, (_, index) => cameraLabel(index + 1, false));
  expect(new Set(labels.map((bytes) => bytes.join(','))).size).toBe(9);
  expect(labels[0]).not.toEqual(cameraLabel(1, true));
  expect(labels[0]).toHaveLength(128 * 64 * 4);
});
