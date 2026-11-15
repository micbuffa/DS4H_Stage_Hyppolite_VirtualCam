import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import type { CameraRegistry } from '../../../src/domain/cameras/cameraRegistry';
import type { TransitionDriver } from '../../../src/application/ports/transition';
import type { RoutingDirector } from '../../../src/application/commands/routingDirector';
import type { createRoutingRenderer } from '../../../src/infrastructure/babylon/rendering/createRoutingRenderer';
import type { TransitionMode } from '../../../src/domain/direction/transitionDefinition';
import { PreviewController } from '../../../src/application/commands/previewController';
import { createPreviewMonitor } from '../../../src/infrastructure/babylon/ui/createPreviewMonitor';
import { createTransitionComposition } from '../../../src/infrastructure/babylon/rendering/createTransitionComposition';
import { transitionFragment, transitionVertex } from '../../../src/infrastructure/babylon/rendering/shaders/basicTransitionShaders';
import { screenLayout } from '../../../src/domain/concert/concertLayout';
import type { ScreenId } from '../../../src/domain/direction/screenRouting';
import { previewPlacement } from '../../../src/domain/direction/panelLayout';
import type { Position3 } from '../../../src/domain/cameras/cameraDefinition';

export function previewHarness(scene: Scene, observer: FreeCamera, registry: CameraRegistry, renderer: ReturnType<typeof createRoutingRenderer>, driver: TransitionDriver,
  director: () => RoutingDirector, shaderFailure: () => boolean, resetClock: () => void) {
  const root = new TransformNode('preview-fixture-root', scene); root.position.set(-previewPlacement.x, 7 - previewPlacement.screenY, 10);
  const monitor = createPreviewMonitor(scene, root, undefined, (scene, surfaces) => createTransitionComposition(scene, surfaces,
    { vertex: transitionVertex, fragment: shaderFailure() ? 'not a valid GLSL shader' : transitionFragment }), renderer.referenceTexture, renderer.createTravelComposition);
  const controller = new PreviewController(registry, renderer, monitor, driver, () => {
    const state = director().snapshot(); return { routes: state.routes, targets: state.targets, settings: director().transitionSettings(), blocked: state.pending !== null || !!state.qualityPending };
  });
  let running: Promise<void> | undefined;
  const inspect = (view: 'monitor' | 'screen', id: ScreenId = 1) => {
    const screen = screenLayout.find((item) => item.id === id)!;
    const x = view === 'monitor' ? 0 : screen.position.x, y = view === 'monitor' ? 7 : screen.position.y, z = view === 'monitor' ? 10 : screen.position.z;
    const halfWidth = view === 'monitor' ? 1.9 : screen.width / 2;
    observer.position.set(x, y, 0); observer.setTarget(new Vector3(x, y, z)); observer.layerMask = view === 'monitor' ? 2 : 1;
    observer.orthoLeft = -halfWidth; observer.orthoRight = halfWidth; observer.orthoTop = halfWidth * 9 / 16; observer.orthoBottom = -halfWidth * 9 / 16;
  };
  inspect('monitor');
  return { controller, monitor,
    api(waitFor: (predicate: () => boolean) => Promise<void>, nextFrame: () => Promise<void>, ready: Promise<unknown>, waiting: () => boolean, advance: (progress: number) => void) {
      return {
        async inspect(view: 'monitor' | 'screen', id?: ScreenId) { inspect(view, id); await nextFrame(); },
        async activatePreview() { await ready; await controller.activate(); return controller.snapshot(); },
        async disablePreview() { await controller.deactivate(); return controller.snapshot(); },
        select(id: number) { registry.select(id); },
        target(id: number) { director().toggleTarget(id); },
        previewState: () => controller.snapshot(),
        async liveHashes() {
          return Promise.all(([1, 2, 3] as const).map(async (id) => {
            const pixels = await renderer.referenceTexture(id)!.readPixels(); if (!pixels) throw new Error('Pixels du direct indisponibles.');
            const bytes = new Uint8Array(new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength));
            return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].join(',');
          }));
        },
        async startPreviewTest(mode: TransitionMode = 'dissolve', waypoints: readonly Position3[] = []) {
          await ready; resetClock(); director().configureTransition({ mode, durationMs: 1000, waypoints });
          if (!director().snapshot().targets.length) return controller.test();
          const state = controller.snapshot(); const unchanged = state.reference !== null && director().snapshot().routes[state.reference] === registry.snapshot().selectedId;
          let rejected: unknown;
          running = controller.test(); void running.catch((error: unknown) => { rejected = error; });
          await waitFor(() => rejected !== undefined || waiting() || controller.snapshot().phase === 'error' || (mode === 'cut' || unchanged) && controller.snapshot().phase === 'ready');
          if (rejected !== undefined) throw rejected;
          await nextFrame(); return controller.snapshot();
        },
        async advancePreview(progress: number) {
          advance(progress);
          await waitFor(() => progress === 1 ? ['ready', 'error'].includes(controller.snapshot().phase) : waiting() || controller.snapshot().phase === 'error');
          await nextFrame(); return controller.snapshot();
        },
        async stopPreviewTest() { await controller.stopTest(); await running; await nextFrame(); return controller.snapshot(); },
        async quality(profile: string) { await director().changeQuality(() => renderer.setQuality(profile)); return controller.snapshot(); },
        observerPose: () => ({ position: observer.position.asArray(), rotation: observer.rotation.asArray(), mask: observer.layerMask }),
        async stopPreview() { controller.dispose(); monitor.dispose(); root.dispose(); await nextFrame(); },
      };
    },
    dispose() { controller.dispose(); monitor.dispose(); root.dispose(); },
  };
}
