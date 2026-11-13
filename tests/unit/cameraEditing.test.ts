import { expect, it, vi } from 'vitest';
import { aimAt, boundedFov, boundedPose, degreesToRadians, radiansToDegrees } from '../../src/domain/cameras/cameraEditing';
import { validateCamera } from '../../src/domain/cameras/cameraDefinition';
import { CameraRegistry } from '../../src/domain/cameras/cameraRegistry';
import { createCameraPresets } from '../../src/domain/cameras/cameraPresets';
import { CameraEditor } from '../../src/application/commands/cameraEditor';
const fixture = () => {
  const registry = new CameraRegistry(createCameraPresets());
  const navigation = { suspend: vi.fn(), resume: vi.fn() };
  return { registry, navigation, editor: new CameraEditor(registry, navigation) };
};
it('clips position/FOV to their bounds and converts vertical angles consistently', () => {
  expect(boundedPose({ position: [-80, 40, 90], rotation: [0, 0, 0, 1] }).position).toEqual([-35, 25, 25]);
  expect(boundedPose({ position: [80, -40, -90], rotation: [0, 0, 0, 1] }).position).toEqual([35, 0.5, -35]);
  expect(boundedFov(5)).toBe(20); expect(boundedFov(100)).toBe(90);
  expect(radiansToDegrees(degreesToRadians(53))).toBeCloseTo(53);
  expect(degreesToRadians(180)).toBeCloseTo(Math.PI);
});
it.each([NaN, Infinity, -Infinity])('rejects non-finite edit values %s', (value) => {
  expect(() => boundedFov(value)).toThrow();
  expect(() => degreesToRadians(value)).toThrow(); expect(() => radiansToDegrees(value)).toThrow();
  expect(() => boundedPose({ position: [0, value, 0], rotation: [0, 0, 0, 1] })).toThrow();
  expect(() => boundedPose({ position: [0, 1, 0], rotation: [0, value, 0, 1] })).toThrow();
});
it('rejects invalid orientation, clipping and degenerate aiming without mutating a camera', () => {
  const camera = createCameraPresets()[0];
  const before = structuredClone(camera);
  expect(() => boundedPose({ ...camera.pose, rotation: [0, 0, 0, 0] })).toThrow();
  expect(() => aimAt(camera, camera.pose.position)).toThrow('Cible');
  for (const [near, far] of [[0, 200], [-1, 200], [2, 1], [1, 1], [1, Infinity]]) expect(() => validateCamera({ ...camera, near, far })).toThrow();
  expect(camera).toEqual(before);
  expect(Math.hypot(...aimAt(camera).rotation)).toBeCloseTo(1);
});
it('previews live, commits release, and restores the exact previous pose on cancellation', () => {
  const f = fixture();
  try {
    const original = f.editor.selected();
    f.editor.setMode('move'); f.editor.begin();
    f.editor.preview({ ...original.pose, position: [4, 7, -12] });
    expect(f.editor.selected().pose.position).toEqual([4, 7, -12]);
    f.editor.cancel(); expect(f.editor.selected()).toEqual(original);
    f.editor.begin(); f.editor.preview({ ...original.pose, position: [8, 7, -12] }); f.editor.finish();
    expect(f.editor.selected().pose.position).toEqual([8, 7, -12]);
    expect(f.navigation.suspend).toHaveBeenCalledTimes(2); expect(f.navigation.resume).toHaveBeenCalledTimes(2);
    f.editor.escape(); expect(f.editor.snapshot().mode).toBeNull();
  } finally { f.editor.dispose(); }
});
it('cancels on selection or tool changes and never edits the newly selected camera', () => {
  const f = fixture();
  try {
    const original = f.editor.selected();
    f.editor.setMode('move'); f.editor.begin(); f.editor.preview({ ...original.pose, position: [9, 8, -10] });
    f.registry.select(4);
    expect(f.registry.snapshot().cameras[0]).toEqual(original);
    expect(f.editor.snapshot().dragging).toBe(false);
    const fourth = f.editor.selected();
    f.editor.begin(); f.editor.preview({ ...fourth.pose, position: [1, 6, -8] });
    f.editor.setMode('rotate'); expect(f.editor.selected()).toEqual(fourth);
    expect(f.navigation.resume).toHaveBeenCalledTimes(2);
  } finally { f.editor.dispose(); }
});
it('restores navigation and the original state on invalid input or suspension error', () => {
  const f = fixture();
  try {
    const original = f.editor.selected();
    f.editor.setMode('move'); f.editor.begin();
    expect(() => f.editor.preview({ ...original.pose, position: [NaN, 4, 3] })).toThrow();
    expect(f.editor.selected()).toEqual(original); expect(f.editor.snapshot().dragging).toBe(false);
    expect(f.navigation.resume).toHaveBeenCalledOnce();
    f.navigation.suspend.mockImplementationOnce(() => { throw new Error('port indisponible'); });
    expect(() => f.editor.begin()).toThrow('port indisponible');
    expect(f.editor.snapshot().dragging).toBe(false); expect(f.navigation.resume).toHaveBeenCalledTimes(2);
  } finally { f.editor.dispose(); }
});
it('bounds FOV steps, aims without moving, resets the entire camera and stops idempotently', () => {
  const f = fixture();
  const original = f.editor.selected();
  f.editor.adjustFov(100); expect(f.editor.selected().fovDegrees).toBe(90);
  f.editor.adjustFov(-100); expect(f.editor.selected().fovDegrees).toBe(20);
  f.editor.aim(); expect(f.editor.selected().pose.position).toEqual(original.pose.position);
  f.editor.reset(); expect(f.editor.selected()).toEqual(original);
  f.editor.setMode('move'); f.editor.begin(); f.editor.dispose(); f.editor.dispose();
  expect(f.navigation.resume).toHaveBeenCalledOnce();
  expect(() => f.editor.begin()).toThrow('arrêté');
});
