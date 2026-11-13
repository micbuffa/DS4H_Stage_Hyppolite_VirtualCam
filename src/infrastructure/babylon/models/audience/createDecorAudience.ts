import '@babylonjs/core/Meshes/instancedMesh';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import type { Scene } from '@babylonjs/core/scene';
import { createModelGroup } from '../modelGroup';
export function createDecorAudience(scene: Scene) {
  const group=createModelGroup(scene,'decor-audience');
  const shirt=group.material('shirt','#445b78'), skin=group.material('skin','#bd977c');
  const body=CreateBox('audience-body',{width:0.48,height:1,depth:0.3},scene);
  const head=CreateSphere('audience-head',{diameter:0.35,segments:6},scene);
  body.material=shirt;head.material=skin;body.isVisible=false;head.isVisible=false;
  body.parent=group.root;head.parent=group.root;body.isPickable=false;head.isPickable=false;
  for(let i=0;i<60;i++) {
    const x=(i%12-5.5)*1.6,z=-3-Math.floor(i/12)*2.2;
    const b=body.createInstance('public-'+i);b.parent=group.root;b.position.set(x,0.85,z);b.isPickable=false;
    const h=head.createInstance('public-head-'+i);h.parent=group.root;h.position.set(x,1.55,z);h.isPickable=false;
  }
  return group;
}
