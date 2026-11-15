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
import { PreviewController } from '../../../application/commands/previewController';
import { createPreviewMonitor } from '../ui/createPreviewMonitor';
import type { BaseTexture } from '@babylonjs/core/Materials/Textures/baseTexture';

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
    const panel = createDirectorPanel(scene);
    const monitor = createPreviewMonitor(scene, panel.root, undefined, undefined, renderer.referenceTexture, renderer.createTravelComposition);
    const driver = renderer.createTransitionDriver(canvas.ownerDocument);
    const preview: PreviewController<BaseTexture> = new PreviewController(registry, renderer, monitor, driver, () => {
      const state = director.snapshot();
      return { routes: state.routes, targets: state.targets, settings: director.transitionSettings(), blocked: state.pending !== null || !!state.qualityPending };
    }, () => editor.snapshot().dragging);
    const director: RoutingDirector = new RoutingDirector(registry, renderer, driver, () => editor.snapshot().dragging, preview);
    const detachQuality = attachFeedQuality(canvas.ownerDocument, (quality) => director.changeQuality(() => renderer.setQuality(quality)), director);
    const editor: CameraEditor = new CameraEditor(registry, createEditingNavigation(scene.activeCamera as ArcRotateCamera, canvas), (id) => director.isCameraLocked(id));
    const detachEditingLock = director.subscribe(() => editor.refreshAvailability());
    const detachPreviewLock = preview.subscribe(() => editor.refreshAvailability());
    const initialization = director.initialize();
    void initialization.catch(() => undefined);
    const goHome = () => { canvas.blur(); resetObserver(scene.activeCamera as ArcRotateCamera); canvas.focus({ preventScroll: true }); };
    const panelCommands = new DirectorPanel(registry, director, editor, { render: (model) => { panel.render(model); monitor.setStatus(model.previewLabel); panelReadout(canvas.ownerDocument, model); } }, goHome, show.clock, preview);
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
        detachEditingLock();
        detachPreviewLock();
        preview.dispose();
        monitor.dispose();
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
