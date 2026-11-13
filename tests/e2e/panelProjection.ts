import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera.js';
import type { Page } from '@playwright/test';
import { panelButtons, panelPlacement } from '../../src/domain/direction/panelLayout';
import type { PanelButtonId } from '../../src/domain/direction/panelLayout';
import { observerView } from '../../src/domain/cameras/observerView';

export function panelButtonPosition(id: PanelButtonId) {
  const engine = new NullEngine({ renderWidth: 1280, renderHeight: 720, textureSize: 512, deterministicLockstep: false, lockstepMaxSteps: 4 });
  const scene = new Scene(engine);
  try {
    const camera = new ArcRotateCamera('panel-test-observer', observerView.alpha, observerView.beta, observerView.radius, Vector3.FromArray(observerView.target), scene);
    const button = panelButtons.find((entry) => entry.id === id)!;
    const world = Vector3.TransformCoordinates(new Vector3(button.x, button.y, -0.33), Matrix.Compose(Vector3.One(), Quaternion.RotationAxis(Vector3.Right(), panelPlacement.tilt), Vector3.FromArray(panelPlacement.position)));
    const position = Vector3.Project(world, Matrix.Identity(), camera.getViewMatrix().multiply(camera.getProjectionMatrix()), camera.viewport.toGlobal(1280, 720));
    return { x: position.x, y: position.y };
  } finally { scene.dispose(); engine.dispose(); }
}
export async function clickPanel(page: Page, id: PanelButtonId) {
  const point = panelButtonPosition(id); await page.mouse.click(point.x, point.y);
}
