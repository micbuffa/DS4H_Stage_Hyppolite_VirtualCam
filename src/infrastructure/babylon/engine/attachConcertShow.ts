import type { createConcertScene } from './createObservationScene';
import { ShowClock, crowdLift, performerMotion } from '../../../domain/concert/concertMotion';
import { createStageLighting } from '../models/lighting/createStageLighting';

export function attachConcertShow({ scene, band, audience }: ReturnType<typeof createConcertScene>, visible = () => true) {
  const clock = new ShowClock();
  const lighting = createStageLighting(scene);
  const dancers = audience.spectators.filter((_, index) => index % 5 === 0);
  const apply = (seconds: number) => {
    band.musicians.forEach(({ root, definition }, index) => {
      const pose = performerMotion(seconds, index);
      root.position.y = definition.position[1] + pose.lift;
      root.rotation.y = definition.yaw + pose.yaw;
      root.rotation.z = pose.roll;
    });
    dancers.forEach((person, index) => { person.position.y = crowdLift(seconds, index); });
    lighting.update(seconds);
  };
  apply(0);
  const tick = (deltaSeconds: number, shown: boolean) => {
    const before = clock.time;
    const time = clock.advance(deltaSeconds, shown);
    if (time !== before) apply(time);
  };
  const frame = scene.onBeforeRenderObservable.add(() => tick(scene.getEngine().getDeltaTime() / 1000, visible()));
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    scene.onBeforeRenderObservable.remove(frame);
    scene.onDisposeObservable.remove(onDispose);
    lighting.dispose();
  };
  const onDispose = scene.onDisposeObservable.add(dispose);
  return { clock, lighting, dispose };
}
