import { expect, it, vi } from 'vitest';
import type { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { createEditingNavigation } from '../../src/infrastructure/babylon/interaction/createEditingNavigation';

it('detaches navigation once, cancels all inertia and resumes without blurring the pointer target', () => {
  const camera = {
    inertialAlphaOffset: 1, inertialBetaOffset: 1, inertialRadiusOffset: 1,
    inertialPanningX: 1, inertialPanningY: 1, detachControl: vi.fn(), attachControl: vi.fn(),
  };
  const canvas = { blur: vi.fn() };
  const navigation = createEditingNavigation(camera as unknown as ArcRotateCamera, canvas as unknown as HTMLCanvasElement);
  navigation.suspend(); navigation.suspend();
  expect(camera.detachControl).toHaveBeenCalledOnce();
  expect(canvas.blur).not.toHaveBeenCalled(); // Browser blur can synthesize a pointer-up mid-drag.
  expect([camera.inertialAlphaOffset, camera.inertialBetaOffset, camera.inertialRadiusOffset, camera.inertialPanningX, camera.inertialPanningY]).toEqual([0, 0, 0, 0, 0]);
  navigation.resume(); navigation.resume();
  expect(camera.attachControl).toHaveBeenCalledExactlyOnceWith(canvas, false);
});
