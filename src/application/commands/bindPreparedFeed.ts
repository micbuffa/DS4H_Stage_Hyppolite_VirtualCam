import type { CameraFeedPort, ScreenTexturePort } from '../ports/cameraFeed';

/** Keep the previous image until the source has produced a valid first frame. */
export function bindPreparedFeed<T>(feed: CameraFeedPort<T>, screen: ScreenTexturePort<T>) {
  const previous = screen.getTexture();
  let disposed = false;
  let bound = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    try {
      if (bound && screen.getTexture() === feed.texture) screen.setTexture(previous);
    } finally { feed.dispose(); }
  };
  const ready = feed.ready.then(() => {
    if (disposed) return;
    bound = true;
    screen.setTexture(feed.texture);
  }).catch((error: unknown) => { dispose(); throw error; });
  return { ready, dispose };
}
