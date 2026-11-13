import { PositionGizmo } from '@babylonjs/core/Gizmos/positionGizmo';
import { RotationGizmo } from '@babylonjs/core/Gizmos/rotationGizmo';
import { UtilityLayerRenderer } from '@babylonjs/core/Rendering/utilityLayerRenderer';
import type { Scene } from '@babylonjs/core/scene';
import type { CameraRegistry } from '../../../domain/cameras/cameraRegistry';
import type { CameraEditor } from '../../../application/commands/cameraEditor';
import type { createCaptureCameras } from '../cameras/createCaptureCameras';

export function createCameraGizmos(scene: Scene, cameras: ReturnType<typeof createCaptureCameras>, registry: CameraRegistry, editor: CameraEditor) {
  const layer = new UtilityLayerRenderer(scene);
  layer.setRenderCamera(scene.activeCamera);
  const move = new PositionGizmo(layer, 1.5);
  const rotate = new RotationGizmo(layer, 32, false, 1.5);
  move.updateGizmoRotationToMatchAttachedMesh = false;
  move.planarGizmoEnabled = true;
  rotate.updateGizmoRotationToMatchAttachedMesh = true;
  move.scaleRatio = rotate.scaleRatio = 1.15;
  for (const gizmo of [move.xGizmo, move.yGizmo, move.zGizmo, move.xPlaneGizmo, move.yPlaneGizmo, move.zPlaneGizmo, rotate.xGizmo, rotate.yGizmo, rotate.zGizmo]) gizmo.dragBehavior.detachCameraControls = false;
  const safely = (operation: () => void) => {
    try { operation(); } catch (error) { editor.cancel(); editor.report(error); }
  };
  for (const gizmo of [move, rotate]) {
    gizmo.onDragStartObservable.add(() => safely(() => editor.begin()));
    gizmo.onDragObservable.add(() => safely(() => {
      if (!editor.snapshot().dragging) return;
      const root = cameras.rigs.get(editor.selected().id)!.root;
      editor.preview({ position: [root.position.x, root.position.y, root.position.z], rotation: [root.rotationQuaternion!.x, root.rotationQuaternion!.y, root.rotationQuaternion!.z, root.rotationQuaternion!.w] });
    }));
    gizmo.onDragEndObservable.add(() => safely(() => editor.finish()));
  }
  const sync = () => {
    const state = editor.snapshot();
    if (!state.dragging) { move.releaseDrag(); rotate.releaseDrag(); }
    const root = cameras.rigs.get(registry.snapshot().selectedId)!.root;
    const moveNode = state.mode === 'move' ? root : null;
    const rotateNode = state.mode === 'rotate' ? root : null;
    if (move.attachedNode !== moveNode) move.attachedNode = moveNode;
    if (rotate.attachedNode !== rotateNode) rotate.attachedNode = rotateNode;
  };
  const unsubscribeEditor = editor.subscribe(sync);
  const unsubscribeCameras = registry.subscribe(sync);
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true; editor.cancel();
    unsubscribeEditor(); unsubscribeCameras();
    scene.onDisposeObservable.remove(onDispose);
    move.dispose(); rotate.dispose(); layer.dispose();
  };
  const onDispose = scene.onDisposeObservable.add(dispose);
  return { move, rotate, layer, dispose };
}
