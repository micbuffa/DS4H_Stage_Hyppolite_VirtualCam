import './style.css';
import { createApplication } from './app/createApplication';
import { createBrowserHost } from './app/browserHost';
import { createBabylonRuntime } from './infrastructure/babylon/engine/createBabylonRuntime';

const canvas = document.querySelector<HTMLCanvasElement>('#renderCanvas');
const status = document.querySelector<HTMLParagraphElement>('#status');
if (!canvas || !status) throw new Error('Le canvas ou la zone de statut est absent.');

try {
  const app = createApplication(() => createBabylonRuntime(canvas), createBrowserHost(window));
  canvas.focus({ preventScroll: true });
  status.textContent = 'WebGL2 · Prêt à explorer';
  status.dataset.state = 'ready';
  import.meta.hot?.dispose(() => app.dispose());
} catch (error) {
  status.textContent = error instanceof Error ? error.message : 'La vue 3D est indisponible.';
  status.dataset.state = 'error';
}
