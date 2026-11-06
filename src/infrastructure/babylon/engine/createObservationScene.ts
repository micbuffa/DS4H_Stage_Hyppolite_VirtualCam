import { Scene } from '@babylonjs/core/scene';
import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { createObserver } from '../cameras/createObserver';
import { createBand } from '../models/musicians/createBand';
import { createStage } from '../models/stage/createStage';
import { createScreens } from '../models/screens/createScreens';
import { stageLayout, screenLayout, validateConcertLayout } from '../../../domain/concert/concertLayout';

export function createConcertScene(engine: AbstractEngine) {
  const scene = new Scene(engine);
  try {
    scene.clearColor = new Color4(0.063, 0.094, 0.137, 1);
    const observer = createObserver(scene);
    const light = new HemisphericLight('ambient', Vector3.Up(), scene);
    light.intensity = 0.8;
    validateConcertLayout(stageLayout, screenLayout);
    const stage = createStage(scene, stageLayout);
    const screens = createScreens(scene, screenLayout);
    const band = createBand(scene, stageLayout);
    return { scene, observer, stage, screens, band };
  } catch (error) {
    scene.dispose();
    throw error;
  }
}

/** Base scene for standalone geometry/camera recipes, without live-feed wiring. */
export function createObservationScene(engine: AbstractEngine): Scene {
  return createConcertScene(engine).scene;
}
