import { expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { stageLayout } from '../../../src/domain/concert/concertLayout';
import { worldAnchor } from '../../../src/domain/concert/bandLayout';
import { createBand } from '../../../src/infrastructure/babylon/models/musicians/createBand';

it('builds four independently owned performers and correctly parented instruments', () => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  try {
    const band = createBand(scene, stageLayout);
    expect(band.musicians).toHaveLength(4);
    for (const musician of band.musicians) {
      expect(musician.root.parent).toBe(band.root);
      expect(musician.instrument.parent).toBe(musician.root);
      musician.root.computeWorldMatrix(true);
      const head = scene.getMeshByName(`${musician.root.name}-head`)!;
      head.computeWorldMatrix(true);
      const expected = worldAnchor(musician.definition, musician.anchors.head);
      expect(Vector3.Distance(head.getAbsolutePosition(), Vector3.FromArray(expected))).toBeLessThan(1e-5);
      for (const mesh of musician.root.getChildMeshes()) {
        expect(mesh.metadata.category).toBe('concert');
        expect(mesh.isPickable).toBe(false);
      }
      for (const foot of musician.root.getChildMeshes().filter((mesh) => mesh.name.includes('-boot-'))) {
        foot.computeWorldMatrix(true);
        expect(foot.getBoundingInfo().boundingBox.minimumWorld.y).toBeCloseTo(musician.definition.position[1], 5);
      }
    }
    const names = scene.meshes.map((mesh) => mesh.name);
    expect(new Set(names).size).toBe(names.length);
    for (const suffix of ['guitar-body-lower', 'guitar-neck', 'bass-body-lower', 'bass-neck', 'drums-kick-shell', 'drums-crash-cymbal', 'drums-ride-cymbal', 'drums-hi-hat-cymbal', 'microphone-capsule', 'amplifier-cabinet']) {
      expect(names.some((name) => name.endsWith(suffix))).toBe(true);
    }
    expect(names.filter((name) => /guitar-string-\d+$/.test(name))).toHaveLength(6);
    expect(names.filter((name) => /bass-string-\d+$/.test(name))).toHaveLength(4);
    const guitar = band.musicians[1];
    const bass = band.musicians[2];
    const bassMeshCount = bass.root.getChildMeshes().length;
    guitar.dispose(); guitar.dispose();
    expect(guitar.root.isDisposed()).toBe(true);
    expect(bass.root.getChildMeshes()).toHaveLength(bassMeshCount);
    expect(bass.root.getChildMeshes().every((mesh) => mesh.material !== null && scene.materials.includes(mesh.material))).toBe(true);
    band.dispose(); band.dispose();
    expect(scene.meshes).toHaveLength(0);
    expect(scene.transformNodes).toHaveLength(0);
    expect(scene.materials).toHaveLength(0);
  } finally { scene.dispose(); engine.dispose(); }
});
