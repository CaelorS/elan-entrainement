import type {Entry,Exercise,Measure,Row,Task} from './types';

export function measureFor(ex:Exercise,entry:Entry):Measure {
 return entry.mesure??(ex.id==='marche_escargot'?'distance':entry.duree_s>0?'duration':entry.reps_max>0?'reps':'execution');
}
export const hasWeight=(ex?:Exercise)=>!!ex&&ex.categorie!=='echauffement'&&['barre','halteres','machine','poulie'].includes(ex.type_charge);
export const hasResistance=(ex?:Exercise)=>!!ex&&ex.categorie!=='echauffement'&&ex.type_charge==='elastique';
export const hasLoad=(ex?:Exercise)=>hasWeight(ex)||hasResistance(ex);
export const distanceFor=(ex:Exercise,entry:Entry)=>entry.distance_m??(ex.id==='marche_escargot'?2:0);
export const rowMeasure=(row:Row):Measure=>row.mesure??(row.exercice_id==='marche_escargot'?'distance':row.reps_prevues>0?'reps':row.duree_s>0?'duration':'execution');
export const rowHasWeight=(row:Row,ex?:Exercise)=>row.charge_applicable??(ex?hasWeight(ex):row.charge_kg>0);
export const rowDistance=(row:Row)=>row.distance_m??(row.exercice_id==='marche_escargot'?2:0);
const number=(n:number)=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1}).format(n);
export const durationLabel=(seconds:number)=>{const total=Math.max(0,Math.round(Number.isFinite(seconds)?seconds:0));return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`};
export function targetLabel(ex:Exercise,entry:Entry){
 switch(measureFor(ex,entry)){
  case 'duration':return entry.durees_s?.length?entry.durees_s.map(durationLabel).join(' / '):durationLabel(entry.duree_s);
  case 'distance':return `${number(distanceFor(ex,entry))} m`;
  case 'reps':return `${entry.reps_min===entry.reps_max?entry.reps_max:`${entry.reps_min}–${entry.reps_max}`} répétitions`;
  default:return 'À réaliser';
 }
}
export const entryLabel=(ex:Exercise,entry:Entry)=>`${entry.series>1&&!entry.durees_s?.length?entry.series+' × ':''}${targetLabel(ex,entry)}${entry.cote&&entry.cote!=='bilateral'?' · '+entry.cote:!entry.cote&&ex.unilateral?' par côté':''}`;
// Repetition work has no implicit duration; zero excludes unknown time from scheduling totals.
export function estimatedSeconds(task:Task){
 const measure=measureFor(task.ex,task.entry);
 return measure==='duration'?task.seconds:measure==='reps'?0:measure==='distance'?Math.max(20,distanceFor(task.ex,task.entry)*10):30;
}

export const isGuided=(task:Task)=>!!task.warmup||task.ex.categorie!=='force';
export const isWarmupRow=(row:Row,catalogue:Exercise[])=>row.echauffement??catalogue.find(e=>e.id===row.exercice_id)?.categorie==='echauffement';
export const primaryRows=(rows:Row[],catalogue:Exercise[])=>rows.filter(r=>!r.intercalaire&&!isWarmupRow(r,catalogue));
export const hasAngle=(ex:Exercise)=>ex.id==='squat_isometrique';

// Manual +/- controls only. Automatic progression keeps its own programme rules.
export function manualLoadStep(ex?:Exercise):number{
 if(!ex)return 1;
 return /^(squat|souleve_terre|rdl_|hip_thrust|presse_|developpe_couche|developpe_incline|tirage_vertical|chest_press|kettlebell_swing|abducteurs_machine|adducteurs_machine)/.test(ex.id)?2:1;
}

export const approachRest=(entry:Entry)=>entry.approche_repos_s??Math.round(entry.repos_s/2);
