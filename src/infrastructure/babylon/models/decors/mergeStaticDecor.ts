import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Material } from '@babylonjs/core/Materials/material';
/** Only for static, non-pickable groups. Source transforms are baked in world space. */
export function mergeStaticDecor(root: TransformNode): void {
 const groups=new Map<Material,Mesh[]>();
 for(const mesh of root.getChildMeshes()) {
  if(!(mesh instanceof Mesh)||!mesh.material||mesh.getTotalVertices()===0)continue;
  mesh.computeWorldMatrix(true);
  const group=groups.get(mesh.material)??[];group.push(mesh);groups.set(mesh.material,group);
 }
 for(const meshes of groups.values())if(meshes.length>1) {
  const merged=Mesh.MergeMeshes(meshes,true,true);
  if(merged){merged.parent=root;merged.isPickable=false;}
 }
}
