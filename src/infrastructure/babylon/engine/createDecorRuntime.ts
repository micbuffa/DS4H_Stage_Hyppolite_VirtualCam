import '@babylonjs/core/Culling/ray';
import { mergeStaticDecor } from '../models/decors/mergeStaticDecor';
import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { GizmoManager } from '@babylonjs/core/Gizmos/gizmoManager';
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import { createObserver } from '../cameras/createObserver';
import { createStage } from '../models/stage/createStage';
import { createBand } from '../models/musicians/createBand';
import { createDecorObject } from '../models/decors/createDecorObject';
import { createDecorAudience } from '../models/audience/createDecorAudience';
import { stageLayout } from '../../../domain/concert/concertLayout';
import type { DecorDocument, DecorObject } from '../../../domain/decors/decorDocument';
import type { DecorCallbacks, DecorRenderer, DecorTool } from '../../../application/ports/decorRenderer';
import { watchSceneReadiness } from './watchSceneReadiness';

export function createDecorRuntime(canvas: HTMLCanvasElement, callbacks: DecorCallbacks): DecorRenderer {
  const engine=new Engine(canvas,true,{stencil:true,preserveDrawingBuffer:true});
  engine.maxFPS=30;
  const scene=new Scene(engine);
  scene.skipPointerMovePicking=true;
  let awakeUntil=performance.now()+2000;
  const wake=()=>{awakeUntil=performance.now()+1200;};
  scene.clearColor=new Color4(0.035,0.052,0.085,1);
  const camera=createObserver(scene);
  const resetView=()=>{camera.setTarget(new Vector3(0,4,7));camera.alpha=-Math.PI/2-0.16;camera.beta=1.23;camera.radius=46;};
  resetView();camera.attachControl(canvas,false);
  const ambient=new HemisphericLight('decor-ambient',Vector3.Up(),scene);ambient.intensity=0.8;
  ambient.groundColor=Color3.FromHexString('#1d2535');
  let stage:ReturnType<typeof createStage> | undefined;
  let band:ReturnType<typeof createBand> | undefined;
  const audience=createDecorAudience(scene);
  const objects=new Map<string,ReturnType<typeof createDecorObject>>();
  const kinds=new Map<string,string>();
  const manager=new GizmoManager(scene);manager.usePointerToAttachGizmos=false;
  manager.positionGizmoEnabled=true;manager.rotationGizmoEnabled=true;manager.scaleGizmoEnabled=true;
  const gizmos=[manager.gizmos.positionGizmo!,manager.gizmos.rotationGizmo!,manager.gizmos.scaleGizmo!];
  manager.gizmos.positionGizmo!.updateGizmoRotationToMatchAttachedMesh=false;
  let current:DecorDocument | undefined, selected:string | undefined, tool:DecorTool='move', dragging=false;
  const enableTool=()=>{
    manager.positionGizmoEnabled=tool==='move';manager.rotationGizmoEnabled=tool==='rotate';manager.scaleGizmoEnabled=tool==='scale';
    manager.attachToNode(selected ? objects.get(selected)?.root ?? null : null);
  };
  const restore=()=>{
    dragging=false;
    const original=current?.objects.find(o=>o.id===selected);
    if(original)objects.get(original.id)?.update(original);
    manager.attachToNode(null);enableTool();camera.attachControl(canvas,false);
  };
  for(const gizmo of gizmos) {
    gizmo.onDragStartObservable.add(()=>{dragging=true;camera.detachControl();});
    gizmo.onDragEndObservable.add(()=>{
      if(!dragging)return;
      dragging=false;camera.attachControl(canvas,false);
      const root=selected ? objects.get(selected)?.root : undefined;
      if(!root || !selected)return;
      const position=root.position.asArray() as DecorObject['position'];
      const rotation=(root.rotationQuaternion?.toEulerAngles() ?? root.rotation).asArray() as DecorObject['rotation'];
      const scale=root.scaling.asArray().map(n=>Math.max(0.1,Math.min(5,n))) as DecorObject['scale'];
      callbacks.transform(selected,{position,rotation,scale});
    });
  }
  scene.onPointerObservable.add(info=>{
    if(info.type!==PointerEventTypes.POINTERTAP || dragging)return;
    const id=info.pickInfo?.pickedMesh?.metadata?.decorId;
    callbacks.select(typeof id==='string' ? id : undefined);
  });
  const controller=new AbortController(), options={signal:controller.signal};
  window.addEventListener('blur',()=>{if(dragging)restore();},options);
  canvas.addEventListener('pointercancel',()=>{if(dragging)restore();},options);
  window.addEventListener('keydown',event=>{if(event.key==='Escape'){restore();callbacks.select(undefined);}},options);
  const resize=()=>{engine.setHardwareScalingLevel(1/Math.min(window.devicePixelRatio||1,1.5));engine.resize();};
  window.addEventListener('resize',resize,options);
  const readiness=watchSceneReadiness(scene);
  let firstFrame=false;
  void readiness.ready.then(()=>{firstFrame=true;wake();}).catch(()=>undefined);
  for(const event of ['pointerdown','pointermove','pointerup','wheel','input','change','keydown'])window.addEventListener(event,wake,{...options,capture:true,passive:true});
  engine.runRenderLoop(()=>{if(!firstFrame || dragging || performance.now()<awakeUntil || !scene.isReady())scene.render();});
  resize();
  let disposed=false;
  return {
    ready:readiness.ready,resetView(){wake();resetView();},
    sync(document) {
      wake();
      if(dragging)restore();
      if(!current || current.preset!==document.preset) {
        stage?.dispose();band?.dispose();
        const layout={...stageLayout,width:document.preset==='compact'?16:24};
        stage=createStage(scene,layout);band=createBand(scene,layout);
        mergeStaticDecor(stage.root);mergeStaticDecor(band.root);
      }
      const deck=scene.getMaterialByName('stage-deck');
      if(deck instanceof StandardMaterial)deck.diffuseColor=Color3.FromHexString(document.floor==='wood'?'#8e6747':'#3a424e');
      const ids=new Set(document.objects.map(o=>o.id));
      for(const [id,object] of objects)if(!ids.has(id)){object.dispose();objects.delete(id);kinds.delete(id);}
      for(const object of document.objects) {
        if(kinds.get(object.id)!==object.kind) {objects.get(object.id)?.dispose();objects.delete(object.id);}
        if(!objects.has(object.id)){objects.set(object.id,createDecorObject(scene,object));kinds.set(object.id,object.kind);}
        else objects.get(object.id)!.update(object);
      }
      current=structuredClone(document);
      if(selected&&!ids.has(selected))selected=undefined;
      enableTool();
    },
    select(id,newTool) {
      wake();if(dragging)restore();selected=id;tool=newTool;enableTool();
      for(const [key,obj]of objects)for(const mesh of obj.root.getChildMeshes())mesh.showBoundingBox=key===id && mesh.isPickable;
    },
    dispose() {
      if(disposed)return;disposed=true;controller.abort();readiness.dispose();
      engine.stopRenderLoop();manager.dispose();objects.forEach(o=>o.dispose());
      band?.dispose();stage?.dispose();audience.dispose();scene.dispose();engine.dispose();
    },
  };
}
