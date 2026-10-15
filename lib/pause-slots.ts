import {compile} from './engine.ts';
import {exerciseDuration} from './library.ts';
import type {Model,Exercise,Entry} from './types';
export function pauseSlots(model:Model,catalogue:Exercise[]){
 return compile({...model,pauses_explicites:true},{modeles:[model],catalogue},false,-1,false).filter(t=>t.kind==='rest').map(t=>({parent:t.entry.ordre,approche:t.approach,index:t.index,seconds:t.seconds}));
}
export function explicitPauses(model:Model,catalogue:Exercise[]):Model{
 if(model.pauses_explicites)return model;
 const slots=pauseSlots(model,catalogue),used=new Set<string>(model.pauses_explicites?model.exercices.filter(e=>e.pause).map(e=>`${e.intercalaire_de[0]}:${e.pause!.approche}:${e.pause!.index}`):[]);let order=Math.max(0,...model.exercices.map(e=>e.ordre));
 const exercices=model.exercices.flatMap(e=>{
  if(!e.intercalaire_de.length)return [e];
  return Array.from({length:e.series},(_,i)=>{
   const copy:Entry={...e,ordre:i===0?e.ordre:++order,series:1,duree_s:e.durees_s?.[i]??e.duree_s,durees_s:undefined};
   if(model.pauses_explicites&&i===0)return copy;
   const seconds=exerciseDuration(catalogue.find(x=>x.id===e.exercice_id),copy);
   const options=slots.filter(s=>e.intercalaire_de.includes(s.parent)&&!used.has(`${s.parent}:${s.approche}:${s.index}`)).sort((a,b)=>Number(b.seconds>=seconds)-Number(a.seconds>=seconds)||Number(a.approche)-Number(b.approche));
   const slot=options[0];if(!slot)return {...copy,pause:undefined};
   used.add(`${slot.parent}:${slot.approche}:${slot.index}`);
   return {...copy,intercalaire_de:[slot.parent],pause:{approche:slot.approche,index:slot.index}};
  });
 });
 return {...model,pauses_explicites:true,exercices};
}
export function placeInPause(model:Model,source:number,parent:number,pause:NonNullable<Entry['pause']>):Model{
 if(model.exercices.some(e=>e.ordre!==source&&e.intercalaire_de[0]===parent&&e.pause?.approche===pause.approche&&e.pause?.index===pause.index))return model;
 return {...model,pauses_explicites:true,exercices:model.exercices.map(e=>e.ordre===source?{...e,intercalaire_de:[parent],pause}:e)};
}
