import { CameraEditor } from '../../../application/commands/cameraEditor';
import { createEditingNavigation } from '../interaction/createEditingNavigation';
import { createCameraGizmos } from '../interaction/createCameraGizmos';
import { attachEditingControls } from '../ui/attachEditingControls';
import type { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { attachObserverKeyboard } from '../interaction/attachObserverKeyboard';
import { CameraRegistry } from '../../../domain/cameras/cameraRegistry';
import { createCameraPresets } from '../../../domain/cameras/cameraPresets';
import { createCaptureCameras } from '../cameras/createCaptureCameras';
import { attachCameraControls } from '../interaction/attachCameraControls';
import { Engine } from '@babylonjs/core/Engines/engine';
import type { RenderRuntime } from '../../../application/ports/renderRuntime';
import { watchSceneReadiness } from './watchSceneReadiness';
import { createRoutingRenderer } from '../rendering/createRoutingRenderer';
import { RoutingDirector } from '../../../application/commands/routingDirector';
import { DirectorPanel } from '../../../application/commands/directorPanel';
import { createDirectorPanel } from '../ui/createDirectorPanel';
import { panelReadout } from '../ui/panelReadout';
import { attachPanelPicking } from '../interaction/attachPanelPicking';
import { resetObserver } from '../cameras/createObserver';
import { attachFeedQuality } from '../ui/attachFeedQuality';
import type { AudienceOptions } from '../../../domain/concert/audienceLayout';
import { attachConcertShow } from './attachConcertShow';
import { createConcertScene } from './createObservationScene';

export function createBabylonRuntime(canvas: HTMLCanvasElement, audience?: AudienceOptions): RenderRuntime {
  const engine = new Engine(canvas, true, { stencil: true, preserveDrawingBuffer: false });
  try {
    if (engine.webGLVersion < 2) throw new Error('WebGL2 est requis.');
    const concert = createConcertScene(engine, audience);
    const { scene, screens } = concert;
    const show = attachConcertShow(concert, () => !canvas.ownerDocument.hidden);
    const registry = new CameraRegistry(createCameraPresets());
    const cameras = createCaptureCameras(scene, registry);
    const renderer = createRoutingRenderer(scene, screens, cameras);
    const director = new RoutingDirector(registry, renderer);
    const detachQuality = attachFeedQuality(canvas.ownerDocument, (quality) => renderer.setQuality(quality));
    const initialization = director.initialize();
    void initialization.catch(() => undefined);
    const editor = new CameraEditor(registry, createEditingNavigation(scene.activeCamera as ArcRotateCamera, canvas));
    const panel = createDirectorPanel(scene);
    const goHome = () => { canvas.blur(); resetObserver(scene.activeCamera as ArcRotateCamera); canvas.focus({ preventScroll: true }); };
    const panelCommands = new DirectorPanel(registry, director, editor, { render: (model) => { panel.render(model); panelReadout(canvas.ownerDocument, model); } }, goHome, show.clock);
    const detachPanelPicking = attachPanelPicking(canvas, scene.activeCamera!, panel, panelCommands);
    const showHelp = () => { void panelCommands.activate('help'); };
    const helpButton = canvas.ownerDocument.getElementById('show-help');
    helpButton?.addEventListener('click', showHelp);
    const gizmos = createCameraGizmos(scene, cameras, registry, editor);
    const detachEditingControls = attachEditingControls(canvas, editor);
    const detachCameraControls = attachCameraControls(canvas, registry, scene.activeCamera as ArcRotateCamera, editor);
    scene.activeCamera?.attachControl(canvas, false);
    const detachKeyboard = attachObserverKeyboard(scene.activeCamera as ArcRotateCamera, canvas, () => !editor.snapshot().dragging);
    const readiness = watchSceneReadiness(scene);
    const render = () => scene.render();
    let disposed = false;
    let started = false;
    return {
      start() {
        if (disposed || started) return;
        started = true;
        engine.runRenderLoop(render);
      },
      whenReady: () => Promise.all([readiness.ready, initialization.catch(() => undefined)]).then(() => undefined),
      resize(pixelRatio) {
        if (disposed) return;
        engine.setHardwareScalingLevel(1 / pixelRatio);
        engine.resize();
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        readiness.dispose();
        engine.stopRenderLoop(render);
        helpButton?.removeEventListener('click', showHelp);
        detachPanelPicking();
        panelCommands.dispose();
        panel.dispose();
        detachEditingControls();
        gizmos.dispose();
        editor.dispose();
        detachCameraControls();
        detachKeyboard();
        detachQuality();
        director.dispose();
        show.dispose();
        cameras.dispose();
        scene.activeCamera?.detachControl();
        scene.dispose();
        engine.dispose();
      },
    };
  } catch (error) {
    engine.dispose();
    throw error;
  }
}
