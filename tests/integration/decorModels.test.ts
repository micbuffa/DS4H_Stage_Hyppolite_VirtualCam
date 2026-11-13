import { describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { catalog,newObject } from '../../src/domain/decors/decorDocument';
import type { DecorKind } from '../../src/domain/decors/decorDocument';
import { createDecorObject } from '../../src/infrastructure/babylon/models/decors/createDecorObject';
import { createDecorAudience } from '../../src/infrastructure/babylon/models/audience/createDecorAudience';

describe('modèles procéduraux de décors',()=>{
  it.each(Object.keys(catalog) as DecorKind[])('construit, transforme et libère %s',kind=>{
    const engine=new NullEngine(),scene=new Scene(engine);
    const before={meshes:scene.meshes.length,nodes:scene.transformNodes.length,materials:scene.materials.length,lights:scene.lights.length};
    const o=newObject(kind,'test');o.position=[3,4,5];o.scale=[2,1,1];
    const model=createDecorObject(scene,o);
    expect(model.root.position.asArray()).toEqual([3,4,5]);expect(model.root.scaling.x).toBe(2);
    expect(model.root.getChildMeshes().length).toBeGreaterThan(0);
    expect(model.root.getChildMeshes().filter(m=>m.isPickable).every(m=>m.metadata.decorId==='test')).toBe(true);
    o.color='#00ff00';o.intensity=0;o.beam=false;model.update(o);
    if(kind==='lamp'){expect(scene.lights[0].intensity).toBe(0);expect(scene.getMeshByName('test-beam')!.isEnabled()).toBe(false);}
    model.dispose();model.dispose();
    expect(scene.meshes).toHaveLength(before.meshes);expect(scene.transformNodes).toHaveLength(before.nodes);
    expect(scene.lights).toHaveLength(before.lights);expect(scene.materials).toHaveLength(before.materials);
    scene.dispose();engine.dispose();
  });
  it('ne détruit pas les ressources d’un autre décor',()=>{
    const engine=new NullEngine(),scene=new Scene(engine);
    const a=createDecorObject(scene,newObject('screen','a')),b=createDecorObject(scene,newObject('screen','b'));
    a.dispose();expect(b.root.getChildMeshes().every(m=>!m.isDisposed()&&m.material&&scene.materials.includes(m.material))).toBe(true);
    b.dispose();scene.dispose();engine.dispose();
  });
  it('crée 60 spectateurs instanciés et les détruit',()=>{
    const engine=new NullEngine(),scene=new Scene(engine),audience=createDecorAudience(scene);
    expect(scene.meshes.filter(m=>m.name.startsWith('public-'))).toHaveLength(120);
    audience.dispose();expect(scene.meshes).toHaveLength(0);scene.dispose();engine.dispose();
  });
});
