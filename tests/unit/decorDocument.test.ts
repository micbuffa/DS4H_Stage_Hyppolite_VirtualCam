import { describe, expect, it } from 'vitest';
import { createPreset, duplicateObject, newObject, parseDocument, serializeDocument, validateDocument } from '../../src/domain/decors/decorDocument';
import { loadDecor, saveDecor } from '../../src/infrastructure/persistence/decorStorage';

describe('document de décors',()=>{
  it('propose trois écrans ou un écran et trois spots RGB',()=>{
    const festival=createPreset('festival'),compact=createPreset('compact');
    expect(festival.objects.filter(o=>o.kind==='screen')).toHaveLength(3);
    expect(compact.objects.filter(o=>o.kind==='screen')).toHaveLength(1);
    expect(festival.objects.filter(o=>o.kind==='lamp').map(o=>o.color)).toEqual(['#ff4066','#48ed9d','#498aff']);
  });
  it('préserve toutes les propriétés après export et réimport',()=>{
    const d=createPreset('compact');d.floor='wood';d.objects[0].rotation=[0,0.5,0];d.objects[0].scale=[2,1,0.5];
    expect(parseDocument(serializeDocument(d))).toEqual(d);
  });
  it('duplique sans partager les transformations et refuse les IDs dupliqués',()=>{
    const d=createPreset('compact'),copy=duplicateObject(d,'screen-0','copy');
    copy.objects.at(-1)!.position[1]=8;
    expect(d.objects[0].position[1]).toBe(7);
    expect(()=>duplicateObject(d,'screen-0','screen-0')).toThrow();
    expect(()=>duplicateObject(d,'absent','copy')).toThrow();
  });
  it.each([NaN,Infinity,-Infinity,101])('refuse une position non valide %s',n=>{
    const d=createPreset('compact');d.objects[0].position[0]=n;expect(()=>validateDocument(d)).toThrow();
  });
  it.each([0,-1,6])('refuse une échelle dangereuse %s',n=>{
    const d=createPreset('compact');d.objects[0].scale[0]=n;expect(()=>validateDocument(d)).toThrow();
  });
  it('refuse les types et versions inconnus, la couleur invalide et les IDs dupliqués',()=>{
    const d=createPreset('compact');
    expect(()=>validateDocument({...d,version:2})).toThrow();
    expect(()=>validateDocument({...d,objects:[{...d.objects[0],kind:'constructor'}]})).toThrow();
    expect(()=>validateDocument({...d,objects:[{...d.objects[0],color:'red'}]})).toThrow();
    expect(()=>validateDocument({...d,objects:[d.objects[0],d.objects[0]]})).toThrow();
  });
  it('refuse les documents corrompus et surdimensionnés',()=>{
    expect(()=>parseDocument('{')).toThrow();expect(()=>parseDocument(' '.repeat(200001))).toThrow();
    const d=createPreset('compact');expect(()=>validateDocument({...d,objects:Array(101).fill(d.objects[0])})).toThrow();
  });
  it('valide les limites des lampes',()=>{
    const d=createPreset('compact');d.objects[1].intensity=-1;expect(()=>validateDocument(d)).toThrow();
    d.objects[1].intensity=0;expect(validateDocument(d).objects[1].intensity).toBe(0);
    d.objects[1].intensity=11;expect(()=>validateDocument(d)).toThrow();
  });
  it('sauvegarde et restaure avec une interface de stockage isolée',()=>{
    const memory=new Map<string,string>();
    const storage={setItem:(k:string,v:string)=>{memory.set(k,v);},getItem:(k:string)=>memory.get(k)??null};
    expect(()=>loadDecor(storage)).toThrow();saveDecor(storage,createPreset('festival'));
    expect(loadDecor(storage)).toEqual(createPreset('festival'));
    expect(()=>saveDecor({setItem(){throw new Error('Quota dépassé');}},createPreset('compact'))).toThrow('Quota');
  });
  it('crée un objet indépendant pour chaque ajout',()=>{
    const a=newObject('speaker','a'),b=newObject('speaker','b');a.position[0]=8;expect(b.position[0]).toBe(0);
  });
});
