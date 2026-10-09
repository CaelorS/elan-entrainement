import type {Entry,Exercise,Measure,Row,Task} from './types';

export function measureFor(ex:Exercise,entry:Entry):Measure {
 return entry.mesure??(ex.id==='marche_escargot'?'distance':entry.duree_s>0?'duration':entry.reps_max>0?'reps':'execution');
}
export const hasWeight=(ex?:Exercise)=>!!ex&&ex.categorie!=='echauffement'&&['barre','halteres'].includes(ex.type_charge);
export const hasResistance=(ex?:Exercise)=>!!ex&&ex.categorie!=='echauffement'&&ex.type_charge==='elastique';
export const hasLoad=(ex?:Exercise)=>hasWeight(ex)||hasResistance(ex);
export const distanceFor=(ex:Exercise,entry:Entry)=>entry.distance_m??(ex.id==='marche_escargot'?2:0);
export const rowMeasure=(row:Row):Measure=>row.mesure??(row.exercice_id==='marche_escargot'?'distance':row.reps_prevues>0?'reps':row.duree_s>0?'duration':'execution');
export const rowHasWeight=(row:Row,ex?:Exercise)=>row.charge_applicable??(ex?hasWeight(ex):row.charge_kg>0);
export const rowDistance=(row:Row)=>row.distance_m??(row.exercice_id==='marche_escargot'?2:0);
const number=(n:number)=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1}).format(n);
export const durationLabel=(seconds:number)=>seconds>=60?`${Math.floor(seconds/60)} min${seconds%60?` ${Math.round(seconds%60)} s`:''}`:`${Math.round(seconds)} s`;
export function targetLabel(ex:Exercise,entry:Entry){
 if(entry.steps?.length)return `${durationLabel(entry.steps.reduce((n,s)=>n+s.duree_s,0))} · ${entry.steps.length} étapes`;
 if(entry.cycle)return `${entry.cycle.count} cycles · ${entry.cycle.work_s} s / ${entry.cycle.rest_s} s · deux pieds ensemble`;
 switch(measureFor(ex,entry)){
  case 'duration':return durationLabel(entry.duree_s);
  case 'distance':return `${number(distanceFor(ex,entry))} m`;
  case 'reps':return `${entry.reps_min===entry.reps_max?entry.reps_max:`${entry.reps_min}–${entry.reps_max}`} répétitions`;
  default:return 'À réaliser';
 }
}
export const entryLabel=(ex:Exercise,entry:Entry)=>`${entry.series>1?entry.series+' × ':''}${targetLabel(ex,entry)}${ex.unilateral?' par côté':''}`;
// Estimates are for distributing existing work only; they never add repetitions or extend holds.
export function estimatedSeconds(task:Task){
 const measure=measureFor(task.ex,task.entry);
 return measure==='duration'?task.seconds:measure==='reps'?Math.max(20,task.reps*3):measure==='distance'?Math.max(20,distanceFor(task.ex,task.entry)*10):30;
}

export const isGuided=(task:Task)=>!!task.warmup||task.ex.categorie!=='force';
export const isWarmupRow=(row:Row,catalogue:Exercise[])=>row.echauffement??catalogue.find(e=>e.id===row.exercice_id)?.categorie==='echauffement';
export const primaryRows=(rows:Row[],catalogue:Exercise[])=>rows.filter(r=>!r.intercalaire&&!isWarmupRow(r,catalogue));
export function cycleState(task:Task,startedAt:number,now:number){
 const cycle=task.entry.cycle;if(!cycle)return null;
 const period=cycle.work_s+cycle.rest_s,elapsed=Math.max(0,(now-startedAt)/1000),position=elapsed%period;
 return {index:Math.min(cycle.count,Math.floor(elapsed/period)+1),count:cycle.count,contract:position<cycle.work_s,remaining:Math.ceil(position<cycle.work_s?cycle.work_s-position:period-position),done:elapsed>=period*cycle.count};
}
