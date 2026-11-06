import { expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { PointerEventTypes, PointerInfoPre } from '@babylonjs/core/Events/pointerEvents';
import { PickingInfo } from '@babylonjs/core/Collisions/pickingInfo';
import { CameraRegistry } from '../../src/domain/cameras/cameraRegistry';
import { createCameraPresets } from '../../src/domain/cameras/cameraPresets';
import { createObserver } from '../../src/infrastructure/babylon/cameras/createObserver';
import { attachCameraControls } from '../../src/infrastructure/babylon/interaction/attachCameraControls';

function fixture() {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const observer = createObserver(scene);
  const registry = new CameraRegistry(createCameraPresets());
  const host = new EventTarget();
  const buttons = new Map(['selected-camera', 'home-view', 'camera-aids', 'reset-camera'].map((id) => [id, Object.assign(new EventTarget(), { textContent: '', setAttribute: vi.fn() })]));
  const document = { defaultView: host, getElementById: (id: string) => buttons.get(id) };
  const canvas = Object.assign(new EventTarget(), { ownerDocument: document, focus: vi.fn(), blur: vi.fn() });
  const detach = attachCameraControls(canvas as unknown as HTMLCanvasElement, registry, observer);
  const dispose = () => { detach(); scene.dispose(); engine.dispose(); };
  return { engine, scene, observer, registry, host, canvas, buttons, detach, dispose };
}

it('selects a picked handle and consumes the gesture before orbit controls receive it', () => {
  const f = fixture();
  try {
    vi.spyOn(f.scene, 'pick').mockReturnValue({ pickedMesh: { metadata: { cameraId: 6 } } } as unknown as PickingInfo);
    const event = { button: 0, pointerId: 7 } as PointerEvent;
    const down = new PointerInfoPre(PointerEventTypes.POINTERDOWN, event, 400, 300);
    f.scene.onPrePointerObservable.notifyObservers(down);
    expect(f.registry.snapshot().selectedId).toBe(6);
    expect(down.skipOnPointerObservable).toBe(true);
    const move = new PointerInfoPre(PointerEventTypes.POINTERMOVE, event, 500, 350);
    f.scene.onPrePointerObservable.notifyObservers(move);
    expect(move.skipOnPointerObservable).toBe(true);
    const up = new PointerInfoPre(PointerEventTypes.POINTERUP, event, 500, 350);
    f.scene.onPrePointerObservable.notifyObservers(up);
    expect(up.skipOnPointerObservable).toBe(true);
    expect(f.observer.alpha).toBeCloseTo(-Math.PI / 2);
  } finally { f.dispose(); }
});

it('leaves empty and secondary clicks available for navigation', () => {
  const f = fixture();
  try {
    const pick = vi.spyOn(f.scene, 'pick').mockReturnValue(new PickingInfo());
    const empty = new PointerInfoPre(PointerEventTypes.POINTERDOWN, { button: 0, pointerId: 1 } as PointerEvent, 10, 10);
    f.scene.onPrePointerObservable.notifyObservers(empty);
    expect(empty.skipOnPointerObservable).toBe(false);
    const secondary = new PointerInfoPre(PointerEventTypes.POINTERDOWN, { button: 2, pointerId: 1 } as PointerEvent, 10, 10);
    f.scene.onPrePointerObservable.notifyObservers(secondary);
    expect(secondary.skipOnPointerObservable).toBe(false);
    expect(pick).toHaveBeenCalledOnce();
  } finally { f.dispose(); }
});

it('returns only the observer to the home view, toggles aids and cleans up DOM subscriptions', () => {
  const f = fixture();
  try {
    f.registry.select(4);
    const before = f.registry.snapshot();
    f.observer.alpha = 1;
    f.observer.target.x = 10;
    f.observer.inertialAlphaOffset = 0.1;
    f.buttons.get('home-view')!.dispatchEvent(new Event('click'));
    expect(f.observer.alpha).toBeCloseTo(-Math.PI / 2);
    expect(f.observer.target.x).toBe(0);
    expect(f.observer.inertialAlphaOffset).toBe(0);
    expect(f.registry.snapshot()).toEqual(before);
    f.buttons.get('camera-aids')!.dispatchEvent(new Event('click'));
    expect(f.registry.snapshot().aidsVisible).toBe(false);
    expect(f.buttons.get('selected-camera')!.textContent).toContain('C4');
    f.detach(); f.detach();
    f.buttons.get('camera-aids')!.dispatchEvent(new Event('click'));
    expect(f.registry.snapshot().aidsVisible).toBe(false);
    expect(f.scene.onPrePointerObservable.hasObservers()).toBe(false);
  } finally { f.dispose(); }
});

it('honors R and H without hijacking text inputs or modifier shortcuts', () => {
  const f = fixture();
  try {
    f.host.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { key: 'h' }));
    expect(f.registry.snapshot().aidsVisible).toBe(false);
    f.host.dispatchEvent(Object.assign(new Event('keydown'), { key: 'h', metaKey: true }));
    expect(f.registry.snapshot().aidsVisible).toBe(false);
    const typing = Object.assign(new Event('keydown'), { key: 'h' });
    Object.defineProperty(typing, 'target', { value: { tagName: 'INPUT' } });
    f.host.dispatchEvent(typing);
    expect(f.registry.snapshot().aidsVisible).toBe(false);
    f.observer.radius = 12;
    f.host.dispatchEvent(Object.assign(new Event('keydown'), { key: 'r' }));
    expect(f.observer.radius).toBe(44);
  } finally { f.dispose(); }
});
