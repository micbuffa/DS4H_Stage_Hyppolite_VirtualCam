import type { ApplicationHost } from '../application/ports/renderRuntime';

export function createBrowserHost(target: Window): ApplicationHost {
  return {
    pixelRatio: () => target.devicePixelRatio,
    subscribeResize(callback) {
      target.addEventListener('resize', callback);
      return () => target.removeEventListener('resize', callback);
    },
    subscribeExit(callback) {
      // Ignore a persisted pagehide: the same runtime resumes from the back/forward cache.
      const onPageHide = (event: PageTransitionEvent) => { if (!event.persisted) callback(); };
      target.addEventListener('pagehide', onPageHide);
      return () => target.removeEventListener('pagehide', onPageHide);
    },
  };
}
