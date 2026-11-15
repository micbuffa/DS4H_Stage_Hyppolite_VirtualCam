import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial';
import '@babylonjs/core/Shaders/ShadersInclude/helperFunctions';
import type { Scene } from '@babylonjs/core/scene';
import type { BaseTexture } from '@babylonjs/core/Materials/Textures/baseTexture';
import type { TransitionCompositionPort, PreparedTransition } from '../../../application/ports/transition';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { ScreenId } from '../../../domain/direction/screenRouting';
import { availableTransitionModes, wipeDirections } from '../../../domain/direction/basicTransitions';
import { shaderSeed } from '../../../domain/direction/gridTransitions';
import { transitionVertex, transitionFragment } from './shaders/basicTransitionShaders';
import { watchSceneReadiness } from '../engine/watchSceneReadiness';

export interface TransitionSurfaces { screens: readonly { definition: { id: ScreenId }; surface: Mesh; material: StandardMaterial }[] }
export function createTransitionComposition(scene: Scene, screens: TransitionSurfaces, shaders = { vertex: transitionVertex, fragment: transitionFragment }): TransitionCompositionPort<BaseTexture> {
  return { async prepare(plan, sources, signal): Promise<PreparedTransition> {
    if (plan.settings.mode === 'virtual-travel') throw new Error('Ce compositeur ne prend en charge que les effets 2D.');
    const entries: { screen: typeof screens.screens[number]; shader: ShaderMaterial; bound: boolean }[] = [];
    let settled = false;
    let fault: Error | undefined;
    let presentation: ReturnType<typeof watchSceneReadiness> | undefined;
    const restore = () => {
      for (const entry of entries) if (entry.bound && entry.screen.surface.material === entry.shader) entry.screen.surface.material = entry.screen.material;
    };
    const dispose = () => { for (const entry of entries) { entry.shader.onError = null; entry.shader.dispose(false, false); } };
    const rollback = () => { if (settled) return; settled = true; presentation?.dispose(); restore(); dispose(); };
    try {
      if (signal.aborted) throw new Error('Transition annulée.');
      for (const step of plan.steps) {
        const screen = screens.screens.find((item) => item.definition.id === step.screen)!;
        const pair = sources.get(step.screen)!;
        if (!pair.from) throw new Error('Image de départ indisponible.');
        // Own the effect in the material: preparatory isReady(mesh) has no submesh.
        // Otherwise a failed preparatory effect survives disposal and blocks scene readiness.
        const shader = new ShaderMaterial(`transition-screen-${step.screen}`, scene,
          { vertexSource: shaders.vertex, fragmentSource: shaders.fragment },
          { attributes: ['position', 'uv'], uniforms: ['worldViewProjection', 'progress', 'effectMode', 'wipeDirection', 'gridSize', 'gridSeed', 'strength'], samplers: ['sourceA', 'sourceB'] }, false);
        entries.push({ screen, shader, bound: false });
        shader.setTexture('sourceA', pair.from); shader.setTexture('sourceB', pair.to);
        shader.setFloat('progress', 0);
        shader.setFloat('effectMode', Math.max(0, availableTransitionModes.findIndex((mode) => mode === plan.settings.mode) - 1));
        shader.setFloat('wipeDirection', wipeDirections.indexOf(plan.settings.parameters.direction));
        shader.setArray2('gridSize', [plan.settings.parameters.columns, plan.settings.parameters.rows]);
        shader.setFloat('gridSeed', shaderSeed(plan.settings.parameters.seed));
        shader.setFloat('strength', plan.settings.parameters.strength);
      }
      // No polling timers: callbacks are owned and removed on readiness, abort or error.
      await new Promise<void>((resolve, reject) => {
        let pending = true;
        const cleanup = () => {
          scene.onAfterRenderObservable.remove(frame);
          scene.onDisposeObservable.remove(stopped);
          signal.removeEventListener('abort', abort);
        };
        const finish = (error?: Error) => {
          if (!pending) return;
          pending = false; cleanup();
          if (error) reject(error); else resolve();
        };
        const abort = () => finish(new Error('Transition annulée.'));
        const check = () => {
          try {
            if (entries.every((entry) => entry.shader.isReady(entry.screen.surface))) finish();
          } catch (error) { finish(error instanceof Error ? error : new Error('Shader de transition indisponible.')); }
        };
        const frame = scene.onAfterRenderObservable.add(check);
        const stopped = scene.onDisposeObservable.add(abort);
        signal.addEventListener('abort', abort, { once: true });
        for (const entry of entries) entry.shader.onError = (_effect, errors) => {
          fault = new Error(`Shader de transition impossible : ${errors}`); finish(fault);
        };
        if (signal.aborted) abort(); else check();
      });
      return {
        render(frame) {
          if (settled || fault) throw fault ?? new Error('Transition annulée.');
          for (const entry of entries) {
            const progress = frame.screens.find((item) => item.screen === entry.screen.definition.id)!.progress;
            entry.shader.setFloat('progress', progress);
            entry.screen.surface.material = entry.shader; entry.bound = true;
          }
        },
        async commit() {
          if (settled || fault) throw fault ?? new Error('Transition annulée.');
          restore();
          presentation = watchSceneReadiness(scene);
          await presentation.ready;
          if (settled || fault) throw fault ?? new Error('Transition annulée.');
        },
        complete() { if (settled) return; settled = true; presentation?.dispose(); restore(); dispose(); },
        rollback,
      };
    } catch (error) { rollback(); throw error; }
  } };
}
