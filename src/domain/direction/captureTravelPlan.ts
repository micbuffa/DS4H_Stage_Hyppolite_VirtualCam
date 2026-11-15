import type { CameraDefinition } from '../cameras/cameraDefinition';
import { createTravelPath } from '../cameras/travelPath';
import type { TravelObstacle } from '../cameras/travelCollision';
import type { TransitionPlan } from './transitionPlan';

/** Validate every leg before any asynchronous acquisition or preview suspension. */
export function captureTravelPlan(plan: TransitionPlan, cameras: readonly CameraDefinition[], obstacles: readonly TravelObstacle[]): TransitionPlan {
  if (plan.settings.mode !== 'virtual-travel' || !plan.steps.length) return plan;
  const destination = cameras.find((camera) => camera.id === plan.destination);
  if (!destination) throw new Error('Caméra de destination du trajet absente.');
  const travel = plan.steps.map((step) => {
    if (step.from === null) throw new Error('Trajet sans source de départ : choisir une coupe ou un effet 2D.');
    const from = cameras.find((camera) => camera.id === step.from);
    if (!from) throw new Error('Caméra de départ du trajet absente.');
    return Object.freeze({ screen: step.screen, path: createTravelPath(from, destination, plan.settings.waypoints, obstacles) });
  });
  return Object.freeze({ ...plan, travel: Object.freeze(travel) });
}
