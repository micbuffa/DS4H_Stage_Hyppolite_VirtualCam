import { describe, expect, it } from 'vitest';
import { createTravelPath, travelClearance, travelPose, travelWaypoints } from '../../src/domain/cameras/travelPath';
import type { CameraDefinition, Position3, Rotation4 } from '../../src/domain/cameras/cameraDefinition';
import { segmentHitsObstacle } from '../../src/domain/cameras/travelCollision';
import type { TravelObstacle } from '../../src/domain/cameras/travelCollision';
import { createCameraPresets } from '../../src/domain/cameras/cameraPresets';
import { createConcertTravelObstacles } from '../../src/domain/concert/travelObstacles';
import { transitionSettings } from '../../src/domain/direction/transitionDefinition';
import { planTransition } from '../../src/domain/direction/transitionPlan';
import { captureTravelPlan } from '../../src/domain/direction/captureTravelPlan';

const camera = (position: Position3, rotation: Rotation4 = [0, 0, 0, 1], fovDegrees = 40): CameraDefinition => ({
  id: 1, name: 'Test', pose: { position, rotation }, fovDegrees, near: 0.1, far: 200,
});
const obstacle: TravelObstacle = { id: 'wall', label: 'mur de test', min: [-0.01, 1, -1], max: [0.01, 5, 1] };

describe('captured and eased travel', () => {
  it('owns immutable endpoints, parameters and waypoints without changing the input cameras', () => {
    const from = camera([-4, 3, 0]), to = camera([4, 5, 0], [0, 1, 0, 0], 70);
    const original = structuredClone([from, to]);
    const waypoint: [number, number, number] = [0, 6, 0];
    const path = createTravelPath(from, to, [waypoint]);
    expect([from, to]).toEqual(original);
    from.pose.position = [30, 9, 0]; to.fovDegrees = 20; waypoint[1] = 20;
    expect(travelPose(path, 0)).toEqual({ position: [-4, 3, 0], rotation: [0, 0, 0, 1], fovDegrees: 40, near: 0.1, far: 200 });
    expect(travelPose(path, 1)).toEqual({ position: [4, 5, 0], rotation: [0, 1, 0, 0], fovDegrees: 70, near: 0.1, far: 200 });
    expect(path.points[1]).toEqual([0, 6, 0]);
    expect(() => Object.assign(path.from.position, { 0: 2 })).toThrow();
    expect(() => Object.assign(path.to, { far: 0 })).toThrow();
  });
  it('matches known elapsed times with progressive departure and arrival', () => {
    const path = createTravelPath(camera([0, 3, 0]), camera([8, 3, 0], [0, 1, 0, 0], 80));
    expect(travelPose(path, 0.25).position).toEqual([1.25, 3, 0]);
    expect(travelPose(path, 0.5).position).toEqual([4, 3, 0]);
    expect(travelPose(path, 0.75).position).toEqual([6.75, 3, 0]);
    expect(travelPose(path, 0.25).fovDegrees).toBe(46.25);
    const epsilon = 1e-5;
    expect(travelPose(path, epsilon).position[0] / epsilon).toBeLessThan(0.001);
    expect((8 - travelPose(path, 1 - epsilon).position[0]) / epsilon).toBeLessThan(0.001);
  });
  it('allocates segment time by length and stops smoothly at a waypoint without overshooting', () => {
    const path = createTravelPath(camera([0, 3, 0]), camera([8, 3, 0]), [[2, 3, 0]]);
    expect(path.length).toBe(8);
    expect(travelPose(path, 0.25).position).toEqual([2, 3, 0]);
    expect(travelPose(path, 0.125).position).toEqual([1, 3, 0]);
    expect(travelPose(path, 0.625).position).toEqual([5, 3, 0]);
    const epsilon = 1e-6;
    expect((2 - travelPose(path, 0.25 - epsilon).position[0]) / epsilon).toBeLessThan(0.001);
    expect((travelPose(path, 0.25 + epsilon).position[0] - 2) / epsilon).toBeLessThan(0.001);
    for (let i = 0; i <= 100; i++) {
      const p = travelPose(path, i / 100).position;
      expect(p[0]).toBeGreaterThanOrEqual(0); expect(p[0]).toBeLessThanOrEqual(8);
      expect(p.slice(1)).toEqual([3, 0]);
    }
  });
  it('handles identical positions, duplicate nodes and an orientation-only travel', () => {
    const path = createTravelPath(camera([0, 3, 0]), camera([0, 3, 0], [0, 1, 0, 0], 60), [[0, 3, 0], [0, 3, 0]]);
    expect(path.length).toBe(0); expect(path.points).toHaveLength(1);
    const pose = travelPose(path, 0.5);
    expect(pose.position).toEqual([0, 3, 0]); expect(pose.fovDegrees).toBe(50);
    expect(pose.rotation[1]).toBeCloseTo(Math.SQRT1_2);
    expect(pose.rotation[3]).toBeCloseTo(Math.SQRT1_2);
  });
  it('preserves constant FOV and clipping values exactly, including the smallest positive near value', () => {
    const from = camera([0, 3, 0], [0, 0, 0, 1], 20), to = camera([1, 3, 0], [0, 0, 0, 1], 20);
    from.near = to.near = Number.MIN_VALUE;
    const path = createTravelPath(from, to);
    for (let i = 1; i < 100; i++) {
      const pose = travelPose(path, i / 100);
      expect(pose.fovDegrees).toBe(20); expect(pose.near).toBe(Number.MIN_VALUE); expect(pose.far).toBe(200);
    }
  });
  it('takes the short quaternion arc across +170° / -170°', () => {
    const yaw = (degrees: number): Rotation4 => [0, Math.sin(degrees * Math.PI / 360), 0, Math.cos(degrees * Math.PI / 360)];
    const path = createTravelPath(camera([0, 3, 0], yaw(170)), camera([0, 3, 0], yaw(-170)));
    const halfway = travelPose(path, 0.5).rotation;
    expect(Math.abs(halfway[1])).toBeCloseTo(1); expect(halfway[3]).toBeCloseTo(0);
  });
  it.each([0.1, 0.5, 0.9])('keeps antipodal quaternions at the same physical orientation at %s', (progress) => {
    const path = createTravelPath(camera([0, 3, 0]), camera([0, 3, 0], [0, 0, 0, -1]));
    expect(travelPose(path, progress).rotation).toEqual([0, 0, 0, 1]);
    expect(travelPose(path, 1).rotation).toEqual([0, 0, 0, -1]);
  });
  it('keeps all interpolated poses finite, bounded and normalized including the near-linear quaternion branch', () => {
    const from = camera([-35, 0.5, -35], [0, 0, 0, 1], 20), to = camera([35, 25, 25], [0, Math.sin(0.001), 0, Math.cos(0.001)], 90);
    to.near = 0.2; to.far = 300;
    const path = createTravelPath(from, to, [[-20, 20, 0], [0, 25, 15], [30, 25, 20]]);
    for (let i = 0; i <= 100; i++) {
      const p = travelPose(path, i / 100);
      expect([...p.position, ...p.rotation, p.fovDegrees, p.near, p.far].every(Number.isFinite)).toBe(true);
      expect(Math.hypot(...p.rotation)).toBeCloseTo(1, 10);
      expect(p.fovDegrees).toBeGreaterThanOrEqual(20); expect(p.fovDegrees).toBeLessThanOrEqual(90);
      expect(p.near).toBeGreaterThan(0); expect(p.far).toBeGreaterThan(p.near);
      expect(() => travelWaypoints([p.position])).not.toThrow();
    }
    expect(travelPose(path, -10)).toBe(path.from); expect(travelPose(path, 10)).toBe(path.to);
    expect(() => travelPose(path, NaN)).toThrow('non finie'); expect(() => travelPose(path, Infinity)).toThrow('non finie');
  });
  it.each<Position3>([[NaN, 1, 0], [0, Infinity, 0], [-35.01, 3, 0], [35.01, 3, 0], [0, 0.49, 0], [0, 25.01, 0], [0, 3, -35.01], [0, 3, 25.01]])('rejects an invalid waypoint %j', (x, y, z) => {
    expect(() => travelWaypoints([[x, y, z]])).toThrow();
  });
  it('rejects too many or incomplete points and invalid camera optics or orientations', () => {
    expect(() => travelWaypoints(Array.from({ length: 4 }, () => [0, 3, 0] as const))).toThrow('trois');
    expect(() => travelWaypoints([[0, 3] as unknown as Position3])).toThrow('incomplet');
    const from = camera([0, 3, 0]), to = camera([2, 3, 0]);
    for (const change of [{ fovDegrees: 91 }, { near: 0 }, { far: 0.05 }, { fovDegrees: NaN }]) {
      expect(() => createTravelPath(from, { ...to, ...change })).toThrow();
    }
    expect(() => createTravelPath(from, camera([2, 3, 0], [0, 0, 0, 0]))).toThrow('Rotation');
  });
});

describe('continuous swept envelopes', () => {
  it('detects an obstacle between distant safe vertices in both directions', () => {
    expect(segmentHitsObstacle([-30, 3, 0], [30, 3, 0], obstacle, 0)).toBe(true);
    expect(segmentHitsObstacle([30, 3, 0], [-30, 3, 0], obstacle, 0)).toBe(true);
    expect(() => createTravelPath(camera([-30, 3, 0]), camera([30, 3, 0]), [], [obstacle])).toThrow('mur de test (segment 1)');
  });
  it('includes grazing contact, parallel segments, endpoints, and a zero-length segment', () => {
    expect(segmentHitsObstacle([-3, 6, 0], [3, 6, 0], obstacle, 1)).toBe(true);
    expect(segmentHitsObstacle([-3, 6.001, 0], [3, 6.001, 0], obstacle, 1)).toBe(false);
    expect(segmentHitsObstacle([0, 3, 0], [0, 3, 0], obstacle, 0)).toBe(true);
    expect(segmentHitsObstacle([0, 6, 0], [0, 6, 0], obstacle, 0)).toBe(false);
    expect(segmentHitsObstacle([-3, 3, 0], [-0.01, 3, 0], obstacle, 0)).toBe(true);
    expect(() => createTravelPath(camera([0, 3, 0]), camera([0, 3, 0]), [], [obstacle])).toThrow('bloqué');
  });
  it('validates every segment, and accepts a detour whose segments clear the same obstacle', () => {
    const a = camera([-4, 3, 0]), b = camera([4, 3, 0]);
    expect(() => createTravelPath(a, b, [[-4, 3, 2]], [obstacle])).toThrow('segment 2');
    expect(() => createTravelPath(a, b, [[-4, 3, 4], [4, 3, 4]], [obstacle])).not.toThrow();
  });
  it('uses clearance plus a conservative near-plane sphere, with a larger envelope for wider/nearer optics', () => {
    const small = createTravelPath(camera([-3, 3, 0]), camera([3, 3, 0]));
    expect(small.radius).toBeGreaterThan(travelClearance + 0.1);
    const large = camera([3, 3, 0], [0, 0, 0, 1], 90); large.near = 2;
    const wide = createTravelPath(camera([-3, 3, 0]), large);
    expect(wide.radius).toBeCloseTo(0.25 + 2 * Math.sqrt(2 + (16 / 9) ** 2));
    expect(wide.radius).toBeGreaterThan(small.radius);
    const thin = { ...obstacle, min: [-0.01, 1, 1] as const, max: [0.01, 5, 1.01] as const };
    expect(() => createTravelPath(camera([-3, 3, 0]), camera([3, 3, 0]), [], [thin])).not.toThrow();
    expect(() => createTravelPath(camera([-3, 3, 0]), large, [], [thin])).toThrow('bloqué');
  });
  it('rejects malformed obstacles and invalid margins instead of silently disabling checks', () => {
    for (const invalid of [{ ...obstacle, min: [NaN, 0, 0] as const }, { ...obstacle, max: [-10, 5, 1] as const }, { ...obstacle, id: '' }]) {
      expect(() => createTravelPath(camera([-3, 3, 0]), camera([3, 3, 0]), [], [invalid])).toThrow('obstacle invalide');
    }
    for (const margin of [-1, NaN, Infinity]) expect(() => segmentHitsObstacle([-3, 3, 0], [3, 3, 0], obstacle, margin)).toThrow('Marge');
    expect(() => createTravelPath(camera([-3, 3, 0]), camera([3, 3, 0]), [], [obstacle, obstacle])).toThrow('dupliqué');
  });
  it('accepts the frontal concert path and refuses the declared ground, structure, screen and panel volumes', () => {
    const cameras = createCameraPresets(), obstacles = createConcertTravelObstacles();
    expect(() => createTravelPath(cameras[0], cameras[3], [], obstacles)).not.toThrow();
    for (const id of ['ground', 'deck', 'tower-10-4', 'screen-1', 'panel', 'preview', 'preview-bridge']) {
      const volume = obstacles.find((o) => o.id === id)!;
      const p = volume.min.map((value, i) => (value + volume.max[i]) / 2) as unknown as Position3;
      const position: Position3 = id === 'ground' ? [0, 0.5, -25] : p;
      const from = camera(position), to = camera(position); from.near = to.near = 0.5;
      expect(() => createTravelPath(from, to, [], [volume]), id).toThrow('bloqué');
    }
  });
});

describe('immutable travel command', () => {
  it('copies validated waypoints into settings and every leg into the effective screen order', () => {
    const point: [number, number, number] = [0, 10, 0];
    const settings = transitionSettings({ mode: 'virtual-travel', waypoints: [point], order: 'simultaneous' });
    point[1] = 3;
    expect(settings.waypoints).toEqual([[0, 10, 0]]);
    expect(() => Object.assign(settings.waypoints, { 0: [0, 1, 0] })).toThrow();
    const cameras = createCameraPresets();
    const plan = captureTravelPlan(planTransition({ 1: 1, 2: 2, 3: 3 }, 4, [1, 2, 3], settings), cameras, []);
    expect(plan.travel?.map((leg) => leg.screen)).toEqual([3, 1, 2]);
    cameras[3].pose.position = [0, 20, 20];
    expect(plan.travel?.every((leg) => leg.path.to.position[1] === 3.6)).toBe(true);
    expect(plan.maxActiveSources).toBe(5); expect(plan.settings.order).toBe('staggered');
  });
  it('rejects the whole command if a later sequential leg is blocked', () => {
    const cameras = createCameraPresets();
    cameras[0] = { ...camera([-3, 3, 4]), id: 1 }; cameras[1] = { ...camera([-3, 3, 0]), id: 2 }; cameras[3] = { ...camera([3, 3, 0]), id: 4 };
    const plan = planTransition({ 1: 1, 2: 2, 3: 1 }, 4, [1, 2], { mode: 'virtual-travel' });
    expect(() => captureTravelPlan(plan, cameras, [obstacle])).toThrow('bloqué');
    expect(plan.travel).toBeUndefined(); expect(plan.before).toEqual({ 1: 1, 2: 2, 3: 1 });
  });
  it('preserves ordinary effects and no-ops, and explicitly refuses missing departure or destination', () => {
    const cameras = createCameraPresets();
    const noOp = planTransition({ 1: 1, 2: 1, 3: 1 }, 1, [1], { mode: 'virtual-travel' });
    expect(captureTravelPlan(noOp, cameras, [])).toBe(noOp);
    const basic = planTransition({ 1: null, 2: 1, 3: 1 }, 2, [1], { mode: 'dissolve' });
    expect(captureTravelPlan(basic, cameras, [])).toBe(basic);
    const empty = planTransition({ 1: null, 2: 1, 3: 1 }, 2, [1], { mode: 'virtual-travel' });
    expect(() => captureTravelPlan(empty, cameras, [])).toThrow('sans source');
    const travel = planTransition({ 1: 1, 2: 1, 3: 1 }, 4, [1], { mode: 'virtual-travel' });
    expect(() => captureTravelPlan(travel, cameras.filter((c) => c.id !== 4), [])).toThrow('destination');
    expect(() => captureTravelPlan(travel, cameras.filter((c) => c.id !== 1), [])).toThrow('départ');
  });
});
