import { expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { createAudience } from '../../../src/infrastructure/babylon/models/audience/createAudience';
import { createConcertScene } from '../../../src/infrastructure/babylon/engine/createObservationScene';
import { createCameraFeed } from '../../../src/infrastructure/babylon/rendering/createCameraFeed';

it('shares a small set of geometries and one material, then releases the entire audience', () => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  try {
    const audience = createAudience(scene);
    const sources = new Set(audience.spectators.map((person) => person.sourceMesh));
    expect(audience.spectators).toHaveLength(144);
    expect(sources.size).toBe(6);
    expect(scene.meshes).toHaveLength(150);
    expect(scene.materials).toHaveLength(1);
    for (const person of audience.spectators) {
      person.computeWorldMatrix(true);
      expect(person.getBoundingInfo().boundingBox.minimumWorld.y).toBeCloseTo(0, 5);
      expect(person.material).toBe(scene.materials[0]);
      expect(person.parent).toBe(audience.root);
      expect(person.isPickable).toBe(false);
    }
    audience.dispose();
    audience.dispose();
    expect(scene.meshes).toHaveLength(0);
    expect(scene.geometries).toHaveLength(0);
    expect(scene.transformNodes).toHaveLength(0);
    expect(scene.materials).toHaveLength(0);
  } finally { scene.dispose(); engine.dispose(); }
});

it('adds the configured spectators to the live render list without picking them', () => {
  const engine = new NullEngine();
  const { scene, observer, audience } = createConcertScene(engine, { count: 20, seed: 42 });
  try {
    const feed = createCameraFeed(scene, observer);
    void feed.ready.catch(() => undefined);
    expect(audience.spectators).toHaveLength(20);
    for (const person of audience.spectators) {
      expect(feed.texture.renderList).toContain(person);
      expect(person.isPickable).toBe(false);
    }
    audience.dispose();
    scene.onBeforeRenderObservable.notifyObservers(scene);
    expect(feed.texture.renderList?.some((mesh) => mesh.metadata?.theme === 'audience')).toBe(false);
    feed.dispose();
  } finally { scene.dispose(); engine.dispose(); }
});

it('uses no geometry or material for an empty audience', () => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  try {
    const audience = createAudience(scene, { count: 0, seed: 42 });
    expect(audience.spectators).toHaveLength(0);
    expect(scene.meshes).toHaveLength(0);
    expect(scene.materials).toHaveLength(0);
    audience.dispose();
  } finally { scene.dispose(); engine.dispose(); }
});
