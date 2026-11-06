import { Engine } from '@babylonjs/core/Engines/engine';
import type { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { createObservationScene } from '../../../src/infrastructure/babylon/engine/createObservationScene';

// Fixed framing for GPU visual QA, using the production scene and no application globals.
const canvas = document.querySelector('canvas')!;
const engine = new Engine(canvas, true);
const scene = createObservationScene(engine);
const camera = scene.activeCamera as ArcRotateCamera;
camera.setTarget(new Vector3(0, 2.8, 10));
camera.beta = 1.43;
camera.radius = 18;
engine.runRenderLoop(() => scene.render());
scene.executeWhenReady(() => { document.body.dataset.ready = 'true'; });
window.addEventListener('pagehide', () => { scene.dispose(); engine.dispose(); }, { once: true });
