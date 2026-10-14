import {compile} from './engine.ts';
import {measureFor} from './activity.ts';
import type {Model,Entry} from './types.ts';
export function orderedEntries(model:Model){
 const roots=model.exercices.filter(e=>!e.intercalaire_de.length);const linked=new Set<number>();
 const result:Entry[]=[];
 for(const root of roots){result.push(root);for(const e of model.exercices.filter(e=>e.intercalaire_de.includes(root.ordre))){if(!linked.has(e.ordre)){result.push(e);linked.add(e.ordre)}}}
 return [...result,...model.exercices.filter(e=>e.intercalaire_de.length&&!linked.has(e.ordre))];
}
export function moveEntry(model:Model,order:number,direction:number):Model{
 const source=model.exercices.find(e=>e.ordre===order);if(!source)return model;
 const peers=model.exercices.filter(e=>source.intercalaire_de.length?e.intercalaire_de.length&&e.intercalaire_de.some(x=>source.intercalaire_de.includes(x)):!e.intercalaire_de.length);
 const index=peers.findIndex(e=>e.ordre===order),other=peers[index+direction];if(!other)return model;
 const entries=[...model.exercices],a=entries.indexOf(source),b=entries.indexOf(other);[entries[a],entries[b]]=[entries[b],entries[a]];
 const ids=new Map(entries.map((e,i)=>[e.ordre,i+1]));return {...model,exercices:entries.map((e,i)=>({...e,ordre:i+1,intercalaire_de:e.intercalaire_de.map(x=>ids.get(x)??x)}))};
}

export function dropEntry(model:Model,source:number,target:number,insert:boolean,after=false):Model{
 if(source===target)return model;
 const entries=orderedEntries(model),item=entries.find(e=>e.ordre===source),anchor=entries.find(e=>e.ordre===target);if(!item||!anchor)return model;
 const next=entries.filter(e=>e.ordre!==source);let index=next.findIndex(e=>e.ordre===target);
 const parent=anchor.intercalaire_de[0]??anchor.ordre;
 const moved={...item,intercalaire_de:insert?[parent]:[]};
 next.splice(insert||after?index+1:index,0,moved);
 const ids=new Map(next.map((e,i)=>[e.ordre,i+1]));return {...model,exercices:next.map((e,i)=>({...e,ordre:i+1,intercalaire_de:e.intercalaire_de.map(x=>ids.get(x)??x)}))};
}
export function duplicateInsert(model:Model,order:number):Model{
 const source=model.exercices.find(e=>e.ordre===order);if(!source?.intercalaire_de.length)return model;
 const copy={...structuredClone(source),ordre:Math.max(...model.exercices.map(e=>e.ordre))+1};return {...model,exercices:[...model.exercices,copy]};
}
export function restBudget(model:Model,catalogue:import('./types').Exercise[]){
 const tasks=compile(model,{catalogue,modeles:[model]},false,-1,false);
 const slots=tasks.filter(t=>t.kind==='rest').map(t=>({order:t.entry.ordre,seconds:t.seconds,approach:t.approach,used:false}));
 const reports=model.exercices.filter(e=>!e.intercalaire_de.length).map(e=>({order:e.ordre,available:slots.filter(s=>s.order===e.ordre).reduce((n,s)=>n+s.seconds,0),required:0,missing:0,extraSlots:0}));
 for(const e of model.exercices.filter(e=>e.intercalaire_de.length).sort((a,b)=>a.intercalaire_de.length-b.intercalaire_de.length)){
  const ex=catalogue.find(x=>x.id===e.exercice_id);if(!ex)continue;
  const perSide=(i:number)=>e.cycle?e.cycle.count*(e.cycle.work_s+e.cycle.rest_s):measureFor(ex,e)==='duration'?(e.durees_s?.[i]??e.duree_s):measureFor(ex,e)==='distance'?Math.max(20,(e.distance_m??0)*10):Math.max(20,e.reps_max*3);
  const durations=Array.from({length:e.series},(_,i)=>Math.ceil(perSide(i)*(ex.unilateral?2:1)));
  const eligible=slots.filter(s=>e.intercalaire_de.includes(s.order));const total=durations.reduce((n,v)=>n+v,0);
  const groups=eligible.some(s=>s.seconds>=total)?[total]:durations;
  for(const seconds of groups){const free=eligible.filter(s=>!s.used).sort((a,b)=>Number(b.seconds>=seconds)-Number(a.seconds>=seconds)||a.seconds-b.seconds);const slot=free[0];const report=reports.find(r=>r.order===(slot?.order??e.intercalaire_de[0]));if(!report)continue;report.required+=seconds;if(!slot){report.extraSlots++;report.missing+=seconds;continue}slot.used=true;report.missing+=Math.max(0,seconds-slot.seconds);}
 }
 return {reports,slots};
}
export function fitRest(model:Model,catalogue:import('./types').Exercise[]):Model{
 const {reports}=restBudget(model,catalogue);
 let fixed={...model,exercices:model.exercices.map(e=>{const report=reports.find(r=>r.order===e.ordre);return report&&report.missing&&!report.extraSlots?{...e,repos_s:e.repos_s+report.missing,approche_repos_s:(e.approche_repos_s??90)+report.missing}:e})};
 const final=restBudget(fixed,catalogue).reports;
 return {...fixed,exercices:fixed.exercices.map(e=>({...e,repos_total_s:final.find(r=>r.order===e.ordre)?.available??0}))};
}
