import { EngineStore } from '@babylonjs/core/Engines/engineStore';
import { SceneInstrumentation } from '@babylonjs/core/Instrumentation/sceneInstrumentation';
import { createBabylonRuntime } from '../../../src/infrastructure/babylon/engine/createBabylonRuntime';

const canvas = document.querySelector('canvas')!;
const size = () => EngineStore.Instances.length;
const runtimeForTest = () => createBabylonRuntime(canvas, { count: 100, seed: 2026 });

const start = async () => {
  const runtime = runtimeForTest();
  runtime.resize(Math.min(devicePixelRatio, 1.5));
  runtime.start();
  try {
    await runtime.whenReady();
    return runtime;
  } catch (error) {
    runtime.dispose();
    throw error;
  }
};

Object.assign(window, {
  async cycleRuntime(times: number) {
    const baseline = size();
    for (let i = 0; i < times; i++) {
      const runtime = await start();
      const scene = EngineStore.Instances.at(-1)!.scenes[0];
      if (scene.customRenderTargets.length !== 1) throw new Error('Nombre de flux incorrect au démarrage.');
      runtime.dispose();
      runtime.dispose();
      if (size() !== baseline || scene.customRenderTargets.length || scene.meshes.length || scene.onBeforeRenderObservable.hasObservers()) {
        throw new Error(`Ressources restantes après le cycle ${i + 1}.`);
      }
    }
    return times;
  },
  async startConcert() {
    const runtime = await start();
    window.addEventListener('pagehide', () => runtime.dispose(), { once: true });
  },
  async measureConcert(seconds: number) {
    const engine = EngineStore.Instances.at(-1)!;
    const scene = engine.scenes[0];
    const instrumentation = new SceneInstrumentation(scene);
    const frames: number[] = [];
    let drawCalls = 0;
    let previous = performance.now();
    const start = previous;
    try {
      await new Promise<void>((resolve, reject) => {
        const frame = engine.onEndFrameObservable.add(() => {
          const now = performance.now();
          if (document.hidden) {
            engine.onEndFrameObservable.remove(frame);
            reject(new Error('Onglet masqué pendant la mesure.'));
            return;
          }
          frames.push(now - previous);
          previous = now;
          drawCalls += instrumentation.drawCallsCounter.current;
          if (now - start >= seconds * 1000) {
            engine.onEndFrameObservable.remove(frame);
            resolve();
          }
        });
      });
      const averageMs = (previous - start) / frames.length;
      const sorted = [...frames].sort((a, b) => a - b);
      const context = canvas.getContext('webgl2')!;
      const debug = context.getExtension('WEBGL_debug_renderer_info');
      return {
        averageMs, fps: 1000 / averageMs, p95Ms: sorted[Math.ceil(frames.length * 0.95) - 1],
        samples: frames.length, durationSeconds: (previous - start) / 1000,
        drawCalls: drawCalls / frames.length, meshes: scene.meshes.length, sceneCount: engine.scenes.length,
        renderWidth: engine.getRenderWidth(), renderHeight: engine.getRenderHeight(), dpr: devicePixelRatio,
        targets: scene.customRenderTargets.map((target) => target.getSize()),
        gpu: debug ? context.getParameter(debug.UNMASKED_RENDERER_WEBGL) : context.getParameter(context.RENDERER),
        browser: navigator.userAgent,
      };
    } finally { instrumentation.dispose(); }
  },
});
