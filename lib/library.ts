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
export function fitRest(model:Model,catalogue:import('./types').Exercise[]):Model{
 const needed=new Map<number,number>();
 for(const e of model.exercices){if(!e.intercalaire_de.length)continue;const ex=catalogue.find(x=>x.id===e.exercice_id);const seconds=e.cycle?e.cycle.count*(e.cycle.work_s+e.cycle.rest_s):e.durees_s?.length?Math.max(...e.durees_s):e.duree_s||Math.max(20,e.reps_max*3);const duration=Math.ceil(seconds*(ex?.unilateral?2:1)+e.repos_s);for(const id of e.intercalaire_de)needed.set(id,Math.max(needed.get(id)??0,duration));}
 return {...model,exercices:model.exercices.map(e=>({...e,repos_s:Math.max(e.repos_s,needed.get(e.ordre)??0)}))};
}
