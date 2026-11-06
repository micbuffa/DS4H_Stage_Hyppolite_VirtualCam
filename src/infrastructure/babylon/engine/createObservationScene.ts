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

export function createObservationScene(engine: AbstractEngine): Scene {
  const scene = new Scene(engine);
  try {
    scene.clearColor = new Color4(0.063, 0.094, 0.137, 1);
    createObserver(scene);
    const light = new HemisphericLight('ambient', Vector3.Up(), scene);
    light.intensity = 0.8;
    validateConcertLayout(stageLayout, screenLayout);
    createStage(scene, stageLayout);
    createScreens(scene, screenLayout);
    createBand(scene, stageLayout);
    return scene;
  } catch (error) {
    scene.dispose();
    throw error;
  }
}
