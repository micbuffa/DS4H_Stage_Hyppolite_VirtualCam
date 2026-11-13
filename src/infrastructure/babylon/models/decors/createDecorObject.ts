import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Quaternion } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { createModelGroup } from '../modelGroup';
import { createDecorLight } from '../lighting/createDecorLight';
import type { DecorObject } from '../../../../domain/decors/decorDocument';

export function createDecorObject(scene: Scene, object: DecorObject) {
  const group = createModelGroup(scene, object.id);
  const primary = group.material('primary', object.color);
  const dark = group.material('dark', '#111827');
  const steel = group.material('steel', '#8894ab');
  const box = (name: string, dimensions: number[], position: number[], material = primary) => {
    const m = CreateBox(object.id + '-' + name, {width:dimensions[0],height:dimensions[1],depth:dimensions[2]}, scene);
    m.parent=group.root; m.position.set(position[0],position[1],position[2]); m.material=material;
    return m;
  };
  let lighting: ReturnType<typeof createDecorLight> | undefined;
  if (object.kind === 'screen') {
    box('frame',[7.5,4.4,0.4],[0,0,0],dark);
    const surface = box('surface',[7,3.94,0.06],[0,0,-0.24]);
    primary.disableLighting=true; primary.emissiveColor=Color3.FromHexString(object.color);
    for (let i=-3;i<=3;i++) box('graphic-'+i,[0.08,2.6-Math.abs(i)*0.5,0.02],[i*0.65,0,-0.28],steel);
    surface.metadata={decorId:object.id};
  } else if (object.kind === 'speaker') {
    box('cabinet',[1.8,3.6,1.4],[0,1.8,0],dark);
    for (const y of [0.9,2.6]) {
      const cone=CreateCylinder(object.id+'-woofer-'+y,{height:0.08,diameter:1.3,tessellation:16},scene);
      cone.parent=group.root;cone.position.set(0,y,-0.74);cone.rotation.x=Math.PI/2;cone.material=primary;
    }
  } else if (object.kind === 'tower') {
    for (const x of [-0.4,0.4]) for (const z of [-0.4,0.4]) box('upright',[0.12,8,0.12],[x,4,z],steel);
    for (let y=0;y<=8;y++) {box('brace-x',[0.95,0.08,0.12],[0,y,-0.4]);box('brace-z',[0.12,0.08,0.95],[-0.4,y,0]);}
    box('foot',[1.4,0.15,1.4],[0,0.075,0],dark);
  } else if (object.kind === 'booth') {
    box('desk',[4,0.25,2],[0,1.2,0],dark);
    for(const x of [-1.6,1.6])box('leg',[0.15,1.2,1.7],[x,0.6,0],steel);
    box('console',[3.2,0.12,1.3],[0,1.4,0]);
    for(let i=0;i<8;i++)box('fader',[0.06,0.08,0.5],[-1.2+i*0.34,1.51,0],steel);
  } else if (object.kind === 'stairs') {
    for(let i=0;i<4;i++)box('step-'+i,[2,(i+1)*0.375,0.6],[0,(i+1)*0.1875,i*0.6],primary);
  } else lighting=createDecorLight(scene,group.root,primary,object);
  for(const mesh of group.root.getChildMeshes()) if(!mesh.name.endsWith('-beam')) {
    mesh.metadata={decorId:object.id};mesh.isPickable=true;
  }
  function update(o: DecorObject) {
    group.root.position.fromArray(o.position);
    group.root.rotationQuaternion=Quaternion.FromEulerAngles(...o.rotation);
    group.root.scaling.fromArray(o.scale);
    primary.diffuseColor=Color3.FromHexString(o.color);
    if(o.kind==='screen')primary.emissiveColor=Color3.FromHexString(o.color);
    if(lighting) {
      lighting.light.diffuse=Color3.FromHexString(o.color);lighting.light.intensity=o.intensity;
      lighting.cone.setEnabled(o.beam);lighting.beamMaterial.emissiveColor=Color3.FromHexString(o.color);
    }
  }
  update(object);
  let disposed=false;
  return {root:group.root, update, dispose() {
    if(disposed)return;disposed=true;
    lighting?.light.dispose();lighting?.beamMaterial.dispose();group.dispose();
  }};
}
export function decorIdFromNode(node: TransformNode | null): string | undefined {
  while(node) {
    if(typeof node.metadata?.decorId==='string')return node.metadata.decorId;
    node=node.parent instanceof TransformNode ? node.parent : null;
  }
  return undefined;
}
