import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder';
import { CreateLineSystem } from '@babylonjs/core/Meshes/Builders/linesBuilder';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { LinesMesh } from '@babylonjs/core/Meshes/linesMesh';
import type { CameraId } from '../../../domain/cameras/cameraDefinition';
import type { CameraRegistry } from '../../../domain/cameras/cameraRegistry';
import { frustumSegments } from '../../../domain/cameras/frustumSegments';
import { createModelGroup } from '../models/modelGroup';
import { cameraLabel } from '../ui/cameraLabel';

export const concertLayer = 1;
export const cameraHelperLayer = 2;

export function createCaptureCameras(scene: Scene, registry: CameraRegistry) {
  const group = createModelGroup(scene, 'capture-cameras');
  const shell = group.material('shell', '#477685');
  const selectedShell = group.material('selected', '#dc9b33', true);
  const lensMaterial = group.material('lens', '#10232f');
  const handleMaterial = group.material('handle', '#a8b7c2');
  const rigs = new Map<CameraId, {
    root: TransformNode; camera: FreeCamera; body: Mesh; label: Mesh; texture: RawTexture; selected: boolean;
  }>();
  for (const definition of registry.snapshot().cameras) {
    const { id } = definition;
    const root = new TransformNode(`camera-rig-${id}`, scene);
    root.parent = group.root;
    const camera = new FreeCamera(`capture-camera-${id}`, Vector3.Zero(), scene);
    camera.inputs.clear();
    camera.parent = root;
    camera.rotationQuaternion = Quaternion.Identity();
    camera.fovMode = Camera.FOVMODE_VERTICAL_FIXED;
    camera.layerMask = concertLayer;
    const body = CreateBox(`camera-${id}-body`, { width: 0.8, height: 0.55, depth: 0.9 }, scene);
    body.parent = root;
    body.material = shell;
    const lens = CreateCylinder(`camera-${id}-lens`, { diameter: 0.4, height: 0.45, tessellation: 16 }, scene);
    lens.parent = root;
    lens.rotation.x = Math.PI / 2;
    lens.position.z = 0.62;
    lens.material = lensMaterial;
    const handle = CreateBox(`camera-${id}-handle`, { width: 0.12, height: 0.15, depth: 0.55 }, scene);
    handle.parent = root;
    handle.position.y = 0.35;
    handle.material = handleMaterial;
    const label = CreatePlane(`camera-${id}-label`, { width: 1.4, height: 0.7 }, scene);
    label.parent = group.root;
    label.billboardMode = Mesh.BILLBOARDMODE_ALL;
    const labelMaterial = group.material(`label-${id}`, '#ffffff', true);
    labelMaterial.diffuseColor = Color3.Black();
    labelMaterial.emissiveColor = Color3.Black();
    labelMaterial.backFaceCulling = false;
    const texture = group.ownTexture(RawTexture.CreateRGBATexture(cameraLabel(id, false), 128, 64, scene, false, false, Texture.NEAREST_SAMPLINGMODE));
    texture.name = `camera-${id}-label-texture`;
    labelMaterial.emissiveTexture = texture;
    label.material = labelMaterial;
    for (const mesh of [body, lens, handle, label]) {
      mesh.layerMask = cameraHelperLayer;
      mesh.metadata = { category: 'camera-helper', cameraId: id };
      mesh.isPickable = true;
    }
    rigs.set(id, { root, camera, body, label, texture, selected: false });
  }
  let frustum: LinesMesh | undefined;
  const unsubscribe = registry.subscribe((snapshot) => {
    for (const definition of snapshot.cameras) {
      const rig = rigs.get(definition.id)!;
      rig.root.position.set(...definition.pose.position);
      rig.root.rotationQuaternion = Quaternion.FromArray(definition.pose.rotation);
      rig.root.computeWorldMatrix(true);
      rig.camera.fov = definition.fovDegrees * Math.PI / 180;
      rig.camera.minZ = definition.near;
      rig.camera.maxZ = definition.far;
      rig.label.position.copyFrom(rig.root.position).addInPlaceFromFloats(0, 0.95, 0);
      const selected = definition.id === snapshot.selectedId;
      rig.body.material = selected ? selectedShell : shell;
      if (selected !== rig.selected) rig.texture.update(cameraLabel(definition.id, selected));
      rig.selected = selected;
    }
    frustum?.dispose();
    const selected = snapshot.cameras.find((definition) => definition.id === snapshot.selectedId)!;
    frustum = CreateLineSystem('camera-selection-frustum', {
      lines: frustumSegments(selected.fovDegrees, selected.near).map((line) => line.map((point) => Vector3.FromArray(point))),
    }, scene);
    frustum.parent = rigs.get(snapshot.selectedId)!.root;
    frustum.color = Color3.FromHexString('#f2b64c');
    frustum.layerMask = cameraHelperLayer;
    frustum.isPickable = false;
    frustum.metadata = { category: 'camera-helper', cameraId: snapshot.selectedId };
    frustum.setEnabled(snapshot.aidsVisible);
  });
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    unsubscribe();
    scene.onDisposeObservable.remove(onDispose);
    group.dispose();
  };
  const onDispose = scene.onDisposeObservable.add(dispose);
  return { root: group.root, rigs, dispose };
}
