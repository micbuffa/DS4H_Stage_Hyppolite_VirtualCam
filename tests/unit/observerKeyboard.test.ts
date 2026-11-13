import { expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { createObserver } from '../../src/infrastructure/babylon/cameras/createObserver';
import { attachObserverKeyboard } from '../../src/infrastructure/babylon/interaction/attachObserverKeyboard';

function fixture(isEnabled = () => true) {
  const engine = new NullEngine();
  vi.spyOn(engine, 'getDeltaTime').mockReturnValue(100);
  const scene = new Scene(engine);
  const camera = createObserver(scene);
  const host = new EventTarget();
  const document = Object.assign(new EventTarget(), { defaultView: host, hidden: false });
  const canvas = Object.assign(new EventTarget(), { ownerDocument: document });
  const detach = attachObserverKeyboard(camera, canvas as unknown as HTMLCanvasElement, isEnabled);
  const key = (target: EventTarget, type: string, value: string, extra = {}) => {
    const event = Object.assign(new Event(type, { cancelable: true }), { key: value, ...extra });
    target.dispatchEvent(event);
    return event;
  };
  const tick = () => scene.onBeforeRenderObservable.notifyObservers(scene);
  const dispose = () => { detach(); scene.dispose(); engine.dispose(); };
  return { engine, scene, camera, host, document, canvas, detach, key, tick, dispose };
}

it('moves only while a focused canvas holds a mapped key and stops on release', () => {
  const f = fixture();
  try {
    const origin = f.camera.target.clone();
    expect(f.key(f.canvas, 'keydown', 'z').defaultPrevented).toBe(true);
    f.key(f.canvas, 'keydown', 'z'); // OS repeat must not double the movement.
    f.tick();
    expect(f.camera.target.z).toBeCloseTo(origin.z + 1);
    f.key(f.host, 'keyup', 'z');
    f.tick();
    expect(f.camera.target.z).toBeCloseTo(origin.z + 1);
    expect(f.camera.alpha).toBeCloseTo(-Math.PI / 2);
    expect(f.camera.target.y).toBe(origin.y);
  } finally { f.dispose(); }
});

it('keeps an alias held when the other key for the same direction is released', () => {
  const f = fixture();
  try {
    f.key(f.canvas, 'keydown', 'z'); f.key(f.canvas, 'keydown', 'ArrowUp');
    f.key(f.host, 'keyup', 'z'); f.tick();
    expect(f.camera.target.z).toBeCloseTo(10);
    f.key(f.host, 'keyup', 'ArrowUp'); f.tick();
    expect(f.camera.target.z).toBeCloseTo(10);
  } finally { f.dispose(); }
});

it.each(['blur', 'visibilitychange', 'modified-key'])('clears held keys on %s', (reason) => {
  const f = fixture();
  try {
    f.key(f.canvas, 'keydown', 'd');
    if (reason === 'blur') f.host.dispatchEvent(new Event('blur'));
    if (reason === 'visibilitychange') { f.document.hidden = true; f.document.dispatchEvent(new Event('visibilitychange')); }
    if (reason === 'modified-key') expect(f.key(f.canvas, 'keydown', 'd', { metaKey: true }).defaultPrevented).toBe(false);
    f.tick();
    expect(f.camera.target.x).toBe(0);
  } finally { f.dispose(); }
});

it('ignores other inputs, bounds horizontal movement and removes listeners on disposal', () => {
  const f = fixture();
  try {
    expect(f.key(f.canvas, 'keydown', 'Tab').defaultPrevented).toBe(false);
    f.key(f.host, 'keydown', 'd'); f.tick();
    expect(f.camera.target.x).toBe(0);
    f.camera.target.x = 35;
    f.key(f.canvas, 'keydown', 'd'); f.tick();
    expect(f.camera.target.x).toBe(35);
    f.detach(); f.detach();
    f.camera.target.x = 0;
    f.key(f.canvas, 'keydown', 'd'); f.tick();
    expect(f.camera.target.x).toBe(0);
    expect(f.scene.onBeforeRenderObservable.observers.filter((observer) => !observer._willBeUnregistered)).toHaveLength(0);
  } finally { f.dispose(); }
});

it('clears movement during an editing gesture and requires a fresh key after resuming', () => {
  let enabled = true;
  const f = fixture(() => enabled);
  try {
    const origin = f.camera.target.clone();
    f.key(f.canvas, 'keydown', 'z');
    enabled = false; f.tick();
    f.key(f.canvas, 'keydown', 'd'); f.tick();
    expect(f.camera.target.asArray()).toEqual(origin.asArray());
    enabled = true; f.tick();
    expect(f.camera.target.asArray()).toEqual(origin.asArray());
    f.key(f.canvas, 'keydown', 'd'); f.tick();
    expect(f.camera.target.x).toBeGreaterThan(origin.x);
  } finally { f.dispose(); }
});
