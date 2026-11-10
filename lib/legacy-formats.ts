import type {Entry,Model,Program} from './types.ts';

// Read compatibility only: old backups become ordinary timed exercises.
export function normalizeEntry(entry:Entry):Entry {
 if(!entry.cycle&&!entry.steps)return entry;
 const {cycle,steps,...rest}=entry;
 const seconds=steps?.reduce((n,s)=>n+s.duree_s,0)??(cycle?cycle.count*(cycle.work_s+cycle.rest_s):entry.duree_s);
 return {...rest,mesure:'duration',duree_s:seconds,reps_min:0,reps_max:0,format:''};
}
export function normalizeModel(model:Model):Model {
 if(!model.exercices.some(e=>e.cycle||e.steps))return model;
 const expanded=model.exercices.some(e=>e.steps?.length);
 const orders=new Map<number,number>();
 let next=1;
 const entries=model.exercices.slice().sort((a,b)=>a.ordre-b.ordre).flatMap(entry=>{
  const clean=normalizeEntry(entry);
  const children=entry.steps?.length?entry.steps.map(step=>({...clean,exercice_id:step.exercice_id,series:1,duree_s:step.duree_s,repos_s:0,approche:false,approche_repos_s:undefined,durees_s:undefined,cote:step.cote??'bilateral',consigne:step.consigne,echauffement:true})): [clean];
  const result=children.map(e=>({...e,ordre:expanded?next++:e.ordre}));
  // References to a former group follow its final explicit exercise.
  orders.set(entry.ordre,result.at(-1)!.ordre);
  return result;
 });
 return {...model,exercices:entries.map(e=>({...e,intercalaire_de:e.intercalaire_de.map(o=>orders.get(o)??o)}))};
}
export function normalizeProgram(program:Program):Program {
 const catalogue=program.catalogue.map(ex=>{const d=ex.parametres_defaut&&normalizeEntry(ex.parametres_defaut);return d!==ex.parametres_defaut?{...ex,parametres_defaut:d}:ex});
 const modeles=program.modeles.map(m=>m.actif_au?m:normalizeModel(m));
 return catalogue.some((e,i)=>e!==program.catalogue[i])||modeles.some((m,i)=>m!==program.modeles[i])?{...program,catalogue,modeles}:program;
}
