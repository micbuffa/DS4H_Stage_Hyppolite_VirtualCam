import { beforeEach, expect, it, vi } from 'vitest';

const { engine, scene, detachKeyboard } = vi.hoisted(() => ({
  detachKeyboard: vi.fn(),
  engine: {
    webGLVersion: 2,
    runRenderLoop: vi.fn(), stopRenderLoop: vi.fn(),
    setHardwareScalingLevel: vi.fn(), resize: vi.fn(), dispose: vi.fn(),
  },
  scene: {
    activeCamera: { attachControl: vi.fn(), detachControl: vi.fn() },
    render: vi.fn(), dispose: vi.fn(),
  },
}));
vi.mock('../../src/infrastructure/babylon/interaction/attachObserverKeyboard', () => ({ attachObserverKeyboard: () => detachKeyboard }));
vi.mock('@babylonjs/core/Engines/engine', () => ({ Engine: class { constructor() { return engine; } } }));
vi.mock('../../src/infrastructure/babylon/engine/createObservationScene', () => ({ createObservationScene: () => scene }));
import { createBabylonRuntime } from '../../src/infrastructure/babylon/engine/createBabylonRuntime';

beforeEach(() => { vi.clearAllMocks(); engine.webGLVersion = 2; });

it('stops the same render callback, detaches controls and disposes owned resources once', () => {
  const runtime = createBabylonRuntime({} as HTMLCanvasElement);
  runtime.start();
  runtime.start();
  const render = engine.runRenderLoop.mock.calls[0][0] as () => void;
  render();
  expect(scene.render).toHaveBeenCalledOnce();
  runtime.resize(1.5);
  expect(engine.setHardwareScalingLevel).toHaveBeenCalledWith(1 / 1.5);
  expect(engine.resize).toHaveBeenCalledOnce();
  runtime.dispose();
  runtime.dispose();
  runtime.start();
  runtime.resize(1);
  expect(engine.runRenderLoop).toHaveBeenCalledOnce();
  expect(engine.stopRenderLoop).toHaveBeenCalledExactlyOnceWith(render);
  expect(detachKeyboard).toHaveBeenCalledOnce();
  expect(scene.activeCamera.detachControl).toHaveBeenCalledOnce();
  expect(scene.dispose).toHaveBeenCalledOnce();
  expect(engine.dispose).toHaveBeenCalledOnce();
  expect(engine.resize).toHaveBeenCalledOnce();
});

it('rejects WebGL1 and releases the allocated engine', () => {
  engine.webGLVersion = 1;
  expect(() => createBabylonRuntime({} as HTMLCanvasElement)).toThrow('WebGL2');
  expect(engine.dispose).toHaveBeenCalledOnce();
});
