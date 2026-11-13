import { catalog, createPreset, duplicateObject, newObject, parseDocument, serializeDocument, validateDocument } from '../domain/decors/decorDocument';
import type { DecorDocument, DecorKind, DecorObject } from '../domain/decors/decorDocument';
import type { DecorTool } from '../application/ports/decorRenderer';
import { loadDecor, saveDecor } from '../infrastructure/persistence/decorStorage';
import { createDecorRuntime } from '../infrastructure/babylon/engine/createDecorRuntime';

export function createDecorEditor(canvas: HTMLCanvasElement, host: HTMLElement) {
  let document=createPreset('festival'), selected:string|undefined, tool:DecorTool='move';
  const abort=new AbortController();
  const find=<T extends HTMLElement>(id:string)=>host.querySelector<T>('#'+id)!;
  const message=(text:string,error=false)=>{const el=find('decor-status');el.textContent=text;el.dataset.state=error?'error':'ready';};
  const protect=(fn:()=>void)=>{try{fn();}catch(e){runtime.sync(document);render();message(e instanceof Error?e.message:'Erreur inattendue.',true);}};
  const update=(next:DecorDocument,text?:string)=>{
    document=validateDocument(next);runtime.sync(document);render();
    if(text)message(text);
  };
  const change=(patch:Partial<DecorObject>)=>{
    const next=structuredClone(document),obj=next.objects.find(o=>o.id===selected);
    if(!obj)throw new Error('Sélectionnez un décor.');
    Object.assign(obj,patch);update(next);
  };
  const choose=(id:string|undefined)=>{selected=id;render();};
  function render() {
    const list=find<HTMLSelectElement>('objects');
    list.replaceChildren(...document.objects.map((o,i)=>new Option((i+1)+'. '+catalog[o.kind],o.id)));
    list.value=selected??''; list.selectedIndex=selected?list.selectedIndex:-1;
    find('count').textContent=document.objects.length+' décors';
    find<HTMLSelectElement>('preset').value=document.preset;find<HTMLSelectElement>('floor').value=document.floor;
    const obj=document.objects.find(o=>o.id===selected);
    find('selection-name').textContent=obj?catalog[obj.kind]:'Aucun décor sélectionné';
    find<HTMLFieldSetElement>('properties').disabled=!obj;
    for(const [key,values]of Object.entries({position:obj?.position,rotation:obj?.rotation,scale:obj?.scale})) {
      for(let i=0;i<3;i++)find<HTMLInputElement>(key+i).value=String(Number(((values?.[i]??(key==='scale'?1:0))*(key==='rotation'?180/Math.PI:1)).toFixed(2)));
    }
    find<HTMLInputElement>('color').value=obj?.color??'#865bff';
    find<HTMLInputElement>('intensity').value=String(obj?.intensity??3);
    find<HTMLInputElement>('beam').checked=obj?.beam??true;
    find('light-controls').hidden=obj?.kind!=='lamp';
    find<HTMLButtonElement>('duplicate').disabled=!obj;find<HTMLButtonElement>('delete').disabled=!obj;
    host.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===tool)));
    runtime.select(selected,tool);
  }
  const runtime=createDecorRuntime(canvas,{
    select:choose,
    transform(id,value){selected=id;protect(()=>change(value));},
  });
  const listen=(id:string,event:string,fn:()=>void)=>find(id).addEventListener(event,()=>protect(fn),{signal:abort.signal});
  host.querySelectorAll<HTMLButtonElement>('[data-add]').forEach(button=>button.addEventListener('click',()=>protect(()=>{
    const next=structuredClone(document),o=newObject(button.dataset.add as DecorKind,crypto.randomUUID());
    next.objects.push(o);selected=o.id;update(next,catalog[o.kind]+' ajouté.');
  }),{signal:abort.signal}));
  host.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach(button=>button.addEventListener('click',()=>{
    tool=button.dataset.tool as DecorTool;render();
  },{signal:abort.signal}));
  listen('objects','change',()=>choose(find<HTMLSelectElement>('objects').value));
  listen('preset','change',()=>{
    const preset=find<HTMLSelectElement>('preset').value as DecorDocument['preset'];
    // Changing the stage never deletes the user's objects.
    const next=structuredClone(document);next.preset=preset;
    const screens=next.objects.filter(o=>o.id.startsWith('screen-')&&o.kind==='screen');
    next.objects=next.objects.filter(o=>!screens.includes(o));
    next.objects.unshift(...createPreset(preset).objects.filter(o=>o.kind==='screen'));
    selected=undefined;update(next,'Configuration de scène actualisée ; les décors ajoutés sont conservés.');
  });
  listen('floor','change',()=>update({...document,floor:find<HTMLSelectElement>('floor').value as DecorDocument['floor']}));
  for(const key of ['position','rotation','scale'] as const)for(let i=0;i<3;i++)listen(key+i,'change',()=>{
    const values=[0,1,2].map(axis=>Number(find<HTMLInputElement>(key+axis).value)*(key==='rotation'?Math.PI/180:1)) as DecorObject['position'];
    change({[key]:values});
  });
  listen('color','change',()=>change({color:find<HTMLInputElement>('color').value}));
  listen('intensity','change',()=>change({intensity:Number(find<HTMLInputElement>('intensity').value)}));
  listen('beam','change',()=>change({beam:find<HTMLInputElement>('beam').checked}));
  listen('duplicate','click',()=>{
    const id=crypto.randomUUID(),next=duplicateObject(document,selected??'',id);selected=id;update(next,'Décor dupliqué.');
  });
  listen('delete','click',()=>{
    const next={...document,objects:document.objects.filter(o=>o.id!==selected)};selected=undefined;update(next,'Décor supprimé.');
  });
  listen('save','click',()=>{saveDecor(localStorage,document);message('Enregistré sur cet ordinateur.');});
  listen('restore','click',()=>{const next=loadDecor(localStorage);selected=undefined;update(next,'Sauvegarde locale restaurée.');});
  listen('export','click',()=>{
    const url=URL.createObjectURL(new Blob([serializeDocument(document)],{type:'application/json'}));
    const a=window.document.createElement('a');a.href=url;a.download='aya-decors.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    message('JSON du prototype exporté. Compatibilité WAM JAM Party à valider.');
  });
  listen('import','change',()=>{
    const input=find<HTMLInputElement>('import'),file=input.files?.[0];if(!file)return;
    if(file.size>200000)throw new Error('Fichier trop volumineux.');
    void file.text().then(text=>protect(()=>{
      const next=parseDocument(text);selected=undefined;update(next,'Scène importée.');input.value='';
    })).catch(()=>message('Lecture du fichier impossible.',true));
  });
  listen('view','click',()=>runtime.resetView());
  window.addEventListener('pagehide',()=>{abort.abort();runtime.dispose();},{once:true,signal:abort.signal});
  update(document);
  void runtime.ready.then(()=>message('Prêt · Cliquez sur un décor ou choisissez-le dans la liste.')).catch(e=>message(String(e),true));
  return {dispose(){abort.abort();runtime.dispose();}};
}
