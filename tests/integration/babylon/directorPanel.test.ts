import { expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { createObservationScene } from '../../../src/infrastructure/babylon/engine/createObservationScene';
import { createDirectorPanel } from '../../../src/infrastructure/babylon/ui/createDirectorPanel';
import { directorPanelModel } from '../../../src/application/presentation/directorPanelModel';
import { CameraRegistry } from '../../../src/domain/cameras/cameraRegistry';
import { createCameraPresets } from '../../../src/domain/cameras/cameraPresets';
import { isFilmable } from '../../../src/domain/rendering/cameraFeed';

it('owns spatial keys, text faces and textures, excludes the whole panel from feeds and cleans once', () => {
  const engine = new NullEngine(); const scene = createObservationScene(engine);
  const baseline = { meshes: [...scene.meshes], textures: [...scene.textures], materials: [...scene.materials] };
  const panel = createDirectorPanel(scene, (scene) => ({ texture: RawTexture.CreateRGBATexture(new Uint8Array([30, 40, 50, 255]), 1, 1, scene), draw: () => undefined }));
  try {
    expect(panel.buttons.size).toBe(24);
    const cameras = new CameraRegistry(createCameraPresets());
    panel.render(directorPanelModel(cameras.snapshot(), { selectedId: 1, targets: [1], routes: { 1: 1, 2: 1, 3: 1 }, pending: null, error: null }, { mode: null, dragging: false, error: null }, false, null));
    for (const mesh of panel.root.getChildMeshes()) { expect(mesh.metadata.category).toBe('panel'); expect(isFilmable(mesh.metadata)).toBe(false); expect(mesh.layerMask).toBe(2); }
    expect(panel.buttons.get('camera-1')!.parent).toBe(panel.root);
    expect(panel.buttons.get('pause')!.metadata.enabled).toBe(false);
    expect(panel.buttons.get('broadcast')!.metadata.enabled).toBe(true);
    const counts = [scene.meshes.length, scene.materials.length, scene.textures.length];
    for (let index = 0; index < 20; index++) panel.hover(index % 2 ? 'camera-4' : null);
    expect([scene.meshes.length, scene.materials.length, scene.textures.length]).toEqual(counts);
    panel.dispose(); panel.dispose();
    expect(scene.meshes).toEqual(baseline.meshes); expect(scene.textures).toEqual(baseline.textures); expect(scene.materials).toEqual(baseline.materials);
  } finally { panel.dispose(); scene.dispose(); engine.dispose(); }
});
