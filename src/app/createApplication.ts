import type { ApplicationHost, RenderRuntime } from '../application/ports/renderRuntime';
import { defaultConfig, effectivePixelRatio, validateConfig } from './config';
import type { AppConfig } from './config';

export function createApplication(
  createRuntime: () => RenderRuntime,
  host: ApplicationHost,
  config: AppConfig = defaultConfig,
): { dispose(): void; ready: Promise<void> } {
  validateConfig(config);
  const cleanup: Array<() => void> = [];
  let runtime: RenderRuntime | undefined;
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    try {
      for (const unsubscribe of cleanup.reverse()) unsubscribe();
    } finally {
      runtime?.dispose();
    }
  };

  try {
    runtime = createRuntime();
    const resize = () => {
      if (!disposed) runtime?.resize(effectivePixelRatio(host.pixelRatio(), config.maxPixelRatio));
    };
    cleanup.push(host.subscribeResize(resize));
    cleanup.push(host.subscribeExit(dispose));
    resize();
    runtime.start();
    const ready = runtime.whenReady().catch((cause: unknown) => {
      dispose();
      throw new Error('Impossible de préparer le rendu 3D. Rechargez la page (⌘⇧R sur Mac).', { cause });
    });
    return { dispose, ready };
  } catch (cause) {
    dispose();
    throw new Error('Impossible de démarrer la vue 3D. Vérifiez que WebGL2 est disponible dans votre navigateur.', { cause });
  }
}
