import { expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { stageLayout, screenLayout } from '../../../src/domain/concert/concertLayout';
import { createStage } from '../../../src/infrastructure/babylon/models/stage/createStage';
import { createScreens } from '../../../src/infrastructure/babylon/models/screens/createScreens';

it('builds a correctly sized stage with themed parents and releases the complete group', () => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  try {
    const group = createStage(scene, stageLayout);
    const deck = scene.getMeshByName('stage-deck')!;
    const ground = scene.getMeshByName('festival-ground')!;
    deck.computeWorldMatrix(true);
    ground.computeWorldMatrix(true);
    expect(deck.parent).toBe(group.root);
    expect(deck.position.z).toBe(10);
    expect(deck.getBoundingInfo().boundingBox.maximumWorld.y).toBeCloseTo(1.5);
    expect(deck.getBoundingInfo().boundingBox.extendSizeWorld.scale(2).asArray()).toEqual([20, 1.5, 12]);
    expect(ground.getBoundingInfo().boundingBox.maximumWorld.y).toBeLessThan(0);
    for (const name of ['stage-roof', 'stage-backdrop', 'drum-riser', 'barrier-post-0', 'speaker--1-0', 'speaker-1-0']) {
      expect(scene.getMeshByName(name)?.parent).toBe(group.root);
    }
    expect(scene.meshes.every((mesh) => !mesh.isPickable && mesh.metadata.category === 'concert')).toBe(true);
    group.dispose();
    group.dispose();
    expect(scene.meshes).toHaveLength(0);
    expect(scene.materials).toHaveLength(0);
    expect(scene.transformNodes).toHaveLength(0);
  } finally { scene.dispose(); engine.dispose(); }
});

it('separates the three video surfaces from their frames, faces the audience and disposes textures', () => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  try {
    const group = createScreens(scene, screenLayout);
    expect(group.screens).toHaveLength(3);
    for (const { definition, root, surface, frame } of group.screens) {
      expect(root.parent).toBe(group.root);
      expect(root.position.asArray()).toEqual(Object.values(definition.position));
      expect(surface.parent).toBe(root);
      expect((surface.material as StandardMaterial).emissiveColor.asArray()).toEqual([0, 0, 0]);
      expect(surface.metadata).toEqual({ category: 'video-surface', screenId: definition.id });
      expect(frame.metadata.category).toBe('concert');
      surface.computeWorldMatrix(true);
      expect(Vector3.TransformNormal(new Vector3(0, 0, -1), surface.getWorldMatrix()).z).toBeLessThan(0);
      expect(surface.getBoundingInfo().boundingBox.extendSize.x / surface.getBoundingInfo().boundingBox.extendSize.y).toBeCloseTo(16 / 9);
      expect(surface.getAbsolutePosition().z).toBeLessThan(frame.getAbsolutePosition().z);
    }
    expect(scene.textures).toHaveLength(3);
    group.dispose(); group.dispose();
    expect(scene.meshes).toHaveLength(0);
    expect(scene.transformNodes).toHaveLength(0);
    expect(scene.materials).toHaveLength(0);
    expect(scene.textures).toHaveLength(0);
  } finally { scene.dispose(); engine.dispose(); }
});
