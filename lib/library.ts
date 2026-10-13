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
