import {measureFor,hasWeight,hasLoad,distanceFor,estimatedSeconds,isGuided} from './activity.ts';
import type {Program,Model,Entry,Exercise,Task,Session,Run,Row,Feedback} from './types';
export const AUTO_VALIDATE_SECONDS=8;
export const uid=()=>crypto.randomUUID();
export const localDate=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export const fmtTime=(seconds:number)=>`${Math.floor(Math.max(0,seconds)/60).toString().padStart(2,'0')}:${Math.floor(Math.max(0,seconds)%60).toString().padStart(2,'0')}`;
export const fmt=(n:number)=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1}).format(n);
const mode=(a:number[])=>a.reduce((best,v)=>a.filter(x=>x===v).length>a.filter(x=>x===best).length?v:best,a[0]??0);
export function suggest(ex:Exercise,entry:Entry,sid:string,history:Session[],now=Date.now()){
 const all=history.filter(s=>s.statut==='terminee'&&s.series.some(r=>r.exercice_id===ex.id&&!r.approche&&!r.intercalaire&&!r.echauffement)).sort((a,b)=>b.heure_debut.localeCompare(a.heure_debut));
 const latest=all[0];if(!latest)return {charge:null,motif:'Première séance',reference:'Choisis une charge confortable.'};
 const age=(now-new Date(latest.heure_debut).getTime())/86400000;
 if(age>60)return {charge:null,motif:'Reprise après une longue coupure',reference:'Définis une nouvelle charge de départ.'};
 // Friday uses the heavy session as its reference, so 90% never compounds.
 const referenceSid=sid==='bas_90'&&['squat','souleve_terre'].includes(ex.id)?'bas_lourde':sid;
 let sessions=all.filter(s=>s.seance_id===referenceSid&&(now-new Date(s.heure_debut).getTime())/86400000<=56);
 if(!sessions.length)sessions=all.slice(0,2);
 const rows=(s:Session)=>s.series.filter(r=>r.exercice_id===ex.id&&!r.approche&&!r.intercalaire&&!r.echauffement);
 let ref=mode(rows(sessions[0]).map(r=>r.charge_kg));
 if(ex.unilateral){const sides=['gauche','droite'].map(side=>rows(sessions[0]).filter(r=>r.cote===side));if(sides.every(x=>x.length))ref=Math.min(...sides.map(x=>mode(x.map(r=>r.charge_kg))));}
 const complete=(s:Session)=>{const r=rows(s);return r.length>=entry.series*(ex.unilateral?2:1)&&r.every(x=>x.reps_faites>=entry.reps_max)};
 const progress=sessions.length>=2&&sessions.slice(0,2).every(complete);
 let charge=ref+(progress?ex.increment_kg:0),motif=progress?'Progression':'Consolidation';
 if(rows(sessions[0]).some(x=>x.reps_faites<entry.reps_min))motif='Reprise de la charge';
 const fb=all[0].retours.find(x=>x.exercice_id===ex.id)?.retour;
 if(fb==='trop_dur'){charge=ref-ex.increment_kg;motif='Ajustement · trop dur'}
 if(fb==='facile'){charge+=ex.increment_kg;motif='Ajustement · facile'}
 if(sid==='bas_90'&&referenceSid==='bas_lourde'&&sessions[0].seance_id==='bas_lourde'){charge=Math.floor(charge*.9/ex.increment_kg)*ex.increment_kg;motif+=' · 90 %'}
 if(age>21){charge=ref*.8;motif='Reprise après coupure'}
 charge=Math.max(0,Math.round(charge/ex.increment_kg)*ex.increment_kg);
 return {charge,motif,reference:`${fmt(ref)} kg le ${new Date(sessions[0].heure_debut).toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}`};
}
function sets(ex:Exercise,e:Entry,approach=false,factor=1,indexOffset=0):Task[]{
 const measure=measureFor(ex,e),out:Task[]=[];
 for(let i=1;i<=e.series;i++)for(const side of ex.unilateral?['gauche','droite'] as const:['bilateral'] as const)
  out.push({id:uid(),kind:'set',ex,entry:e,index:i+indexOffset,side,approach,factor,reps:measure==='reps'?e.reps_max:0,seconds:measure==='duration'?e.duree_s:0,warmup:ex.categorie==='echauffement'});
 return out;
}
export function compile(model:Model,program:Program,reduced=false,day=new Date().getDay()):Task[]{
 const catalogue=new Map(program.catalogue.map(e=>[e.id,e]));
 const active=model.exercices.filter(e=>!e.jours||e.jours.includes(day));
 const main=active.filter(e=>!e.intercalaire_de.length&&catalogue.has(e.exercice_id)).sort((a,b)=>a.ordre-b.ordre);
 const out:Task[]=[],slots:Task[]=[];
 main.forEach((raw,blockIndex)=>{
  const ex=catalogue.get(raw.exercice_id)!;
  const e={...raw,series:reduced&&ex.categorie==='force'?Math.ceil(raw.series/2):raw.series};
  if(e.steps?.length){
   e.steps.forEach((step,i)=>{const stepEx=catalogue.get(step.exercice_id);if(!stepEx)return;
    const entry={...e,steps:undefined,cycle:undefined,exercice_id:step.exercice_id,mesure:'duration' as const,duree_s:step.duree_s};
    out.push({id:uid(),kind:'set',ex:{...stepEx,unilateral:false,consigne:step.consigne},entry,index:1,side:'bilateral',approach:false,factor:1,reps:0,seconds:step.duree_s,warmup:true,step:i+1,stepCount:e.steps!.length});
   });return;
  }
  if(e.approche){[0,.75,.9].forEach((factor,i)=>{
   const reps=Math.max(1,Math.round(e.reps_max*[1,3/5,2/5][i]));
   const task=sets(ex,{...e,mesure:'reps',series:1,reps_min:reps,reps_max:reps},true,factor,i)[0];
   out.push(task,{...task,id:uid(),kind:'rest',seconds:45,fillers:[]});
  })}
  const work=sets(ex,e);
  work.forEach((task,i)=>{
   out.push(task);
   const finalInBlock=i===work.length-1,finalInSession=finalInBlock&&blockIndex===main.length-1;
   if(task.side==='gauche'||finalInSession||e.repos_s<=0)return;
   // A transition rest is useful only where inserts have been requested.
   const carrier=active.some(f=>f.intercalaire_de.includes(e.ordre));
   if(!finalInBlock||carrier){const rest={...task,id:uid(),kind:'rest' as const,seconds:e.repos_s,fillers:[]};out.push(rest);slots.push(rest)}
  });
  if(ex.categorie==='force'&&blockIndex<main.length-1)out.push({id:uid(),kind:'review',ex,entry:e,index:e.series,side:'bilateral',approach:false,factor:1,reps:0,seconds:AUTO_VALIDATE_SECONDS});
 });
 // One exercise per pause. Keep its sides/short holds together, but distribute long sets
 // (e.g. isometric holds) over separate pauses. Never create a post-session rest.
 const groups=active.filter(e=>e.intercalaire_de.length).flatMap(e=>{
  const ex=catalogue.get(e.exercice_id);if(!ex)return [];
  const tasks=sets(ex,e),maxRest=Math.max(0,...slots.filter(s=>e.intercalaire_de.includes(s.entry.ordre)).map(s=>s.seconds));
  const duration=tasks.reduce((n,t)=>n+estimatedSeconds(t),0);
  return duration<=maxRest&&ex.id!=='squat_isometrique'?[tasks]:Array.from({length:e.series},(_,i)=>tasks.filter(t=>t.index===i+1));
 }).filter(g=>g.length);
 const used=new Set<Task>();
 groups.sort((a,b)=>slots.filter(s=>a[0].entry.intercalaire_de.includes(s.entry.ordre)).length-slots.filter(s=>b[0].entry.intercalaire_de.includes(s.entry.ordre)).length||a[0].entry.ordre-b[0].entry.ordre);
 groups.forEach((group,i)=>{
  const free=slots.filter(s=>!used.has(s));if(!free.length)return;
  const preferred=free.filter(s=>group[0].entry.intercalaire_de.includes(s.entry.ordre));
  const candidates=preferred.length?preferred:free;
  const target=(i+.5)*slots.length/groups.length-.5;
  candidates.sort((a,b)=>Math.abs(slots.indexOf(a)-target)-Math.abs(slots.indexOf(b)-target));
  const slot=candidates[0];used.add(slot);slot.fillers=group;
  // Isometric holds retain the prescribed recovery after the effort.
  if(group[0].ex.id==='squat_isometrique')slot.seconds=Math.max(slot.seconds,group.reduce((n,t)=>n+estimatedSeconds(t),0)+Math.max(90,group[0].entry.repos_s));
 });
 return out;
}
export function enter(run:Run,cursor:number,now=Date.now()):Run {
 const t=run.tasks[cursor];
 if(!t)return {...run,cursor,phase:'BILAN',deadline:null,pausedAt:null,restDeadline:undefined,restCursor:undefined,finishedAt:now,savedAt:now};
 const confirmed=run.confirmedLoads??[...new Set(run.rows.filter(r=>!r.intercalaire).map(r=>r.exercice_id))];
 const phase:Run['phase']=t.kind==='review'?'REVIEW':t.kind==='rest'?'REST':hasLoad(t.ex)&&!isGuided(t)?confirmed.includes(t.ex.id)?'READY':'CHARGE':'COUNTDOWN';
 const sec=phase==='REVIEW'?AUTO_VALIDATE_SECONDS:phase==='REST'?t.seconds:phase==='COUNTDOWN'?5:0;
 const carriedRest=phase==='REST'&&run.restCursor===cursor?run.restDeadline:undefined;
 const f=t.fillers?.[0];
 const next:Run={...run,confirmedLoads:confirmed,cursor,phase,phaseAt:now,executionAt:undefined,executionEnd:undefined,duration_s:undefined,distance_m:distanceFor(t.ex,t.entry),deadline:carriedRest??(sec?now+sec*1000:null),restDeadline:phase==='REST'?carriedRest??now+t.seconds*1000:undefined,restCursor:phase==='REST'?cursor:undefined,pausedAt:null,reps:t.reps,rir:null,auto:true,fillerIndex:0,fillerAt:now,fillerDeadline:f?.seconds?now+f.seconds*1000:null,fillerDone:[],savedAt:now};
 // Warm-up stages and the two sides of guided activities flow directly into one another.
 const previous=run.tasks[cursor-1];
 return phase==='COUNTDOWN'&&previous?.kind==='set'&&isGuided(previous)&&isGuided(t)?startExecution(next,now):next;
}
export function confirmLoad(run:Run,now=Date.now()):Run {
 if(run.phase!=='CHARGE')return run;
 return {...run,confirmedLoads:[...new Set([...(run.confirmedLoads??[]),run.tasks[run.cursor].ex.id])],phase:'COUNTDOWN',phaseAt:now,deadline:now+5000};
}
export function startExecution(run:Run,now=Date.now()):Run {
 if(!['COUNTDOWN','READY'].includes(run.phase)||run.pausedAt!==null)return run;
 const task=run.tasks[run.cursor];
 return {...run,phase:'EXECUTION',phaseAt:now,executionAt:now,executionEnd:undefined,deadline:measureFor(task.ex,task.entry)==='duration'&&task.seconds?now+task.seconds*1000:null};
}
export function togglePause(run:Run,now=Date.now()):Run {
 if(run.pausedAt===null)return {...run,pausedAt:now};
 const delta=now-run.pausedAt,shift=(value?:number)=>value===undefined?undefined:value+delta;
 return {...run,pausedAt:null,phaseAt:run.phaseAt+delta,executionAt:shift(run.executionAt),executionEnd:shift(run.executionEnd),deadline:run.deadline===null?null:run.deadline+delta,restDeadline:shift(run.restDeadline),fillerAt:run.fillerAt+delta,fillerDeadline:run.fillerDeadline===null?null:run.fillerDeadline+delta};
}
export function restartTimer(run:Run,target:'activity'|'rest'='activity',now=Date.now()):Run {
 const task=run.tasks[run.cursor],at=run.pausedAt??now;
 if(run.phase==='REST'){
  if(target==='rest')return {...run,deadline:at+task.seconds*1000,restDeadline:at+task.seconds*1000};
  const filler=task.fillers?.[run.fillerIndex];
  return filler?.seconds?{...run,fillerAt:at,fillerDeadline:at+filler.seconds*1000}:run;
 }
 if(run.phase==='EXECUTION'&&task.seconds)return {...run,executionAt:at,phaseAt:at,deadline:at+task.seconds*1000};
 return run;
}
export function nextSet(run:Run){return run.tasks.slice(run.cursor+1).find(t=>t.kind==='set')}
export function isLastSet(run:Run){const task=run.tasks[run.cursor];return task?.kind==='set'&&!task.approach&&!isGuided(task)&&!run.tasks.slice(run.cursor+1).some(t=>t.kind==='set'&&t.ex.id===task.ex.id&&!t.approach)}
export function makeRun(model:Model,program:Program,history:Session[],reduced:boolean):Run{const now=Date.now();if(model.id==='bloc_matin'&&![2,5].includes(new Date(now).getDay())){const yesterday=new Date(now);yesterday.setDate(yesterday.getDate()-1);const moved=new Set(history.filter(s=>s.statut==='terminee'&&s.date===localDate(yesterday)).flatMap(s=>s.series.filter(r=>r.intercalaire).map(r=>r.exercice_id)));model={...model,exercices:model.exercices.filter(e=>!moved.has(e.exercice_id))}}const tasks=compile(model,program,reduced);const suggestions:Run['suggestions']={};const loads:Run['loads']={};const bands:Run['bands']={};for(const t of tasks){if(!hasLoad(t.ex)||suggestions[t.ex.id])continue;suggestions[t.ex.id]=suggest(t.ex,t.entry,model.id,history);if(suggestions[t.ex.id].charge!==null)loads[t.ex.id]=suggestions[t.ex.id].charge!;const previous=history.flatMap(s=>s.series).filter(r=>r.exercice_id===t.ex.id&&r.charge_libelle).at(-1);if(previous)bands[t.ex.id]=previous.charge_libelle;}
 return enter({uuid:uid(),model,tasks,cursor:0,phase:'COUNTDOWN',startedAt:now,phaseAt:now,deadline:null,pausedAt:null,rows:[],retours:{},loads,bands,reps:0,rir:null,auto:true,fillerIndex:0,fillerAt:now,fillerDeadline:null,fillerDone:[],suggestions,savedAt:now,rpe:null,note:'',reduced},0,now)}
export function taskLoad(run:Run,t:Task,barKg:number){if(!hasWeight(t.ex))return 0;const base=run.loads[t.ex.id]??0;if(!t.approach)return base;if(t.factor===0)return barKg;return Math.round(base*t.factor/2.5)*2.5;}
export function completeExecution(run:Run,now=Date.now(),barKg=20,auto=false):Run {
 if(run.phase!=='EXECUTION'||run.pausedAt!==null)return run;
 const task=run.tasks[run.cursor],end=run.deadline?Math.min(now,run.deadline):now;
 const restCursor=run.tasks[run.cursor+1]?.kind==='rest'?run.cursor+1:undefined;
 const done={...run,phase:'VALIDATION' as const,phaseAt:now,executionEnd:end,duration_s:Math.max(0,Math.round((end-(run.executionAt??run.phaseAt))/1000)),deadline:now+AUTO_VALIDATE_SECONDS*1000,restCursor,restDeadline:restCursor===undefined?undefined:end+run.tasks[restCursor].seconds*1000,auto:true};
 if(isGuided(task))return enter({...done,rows:[...done.rows,rowFor(done,task,barKg,auto,false,now)]},run.cursor+1,now);
 return done;
}
export function validateExecution(run:Run,barKg:number,auto=false,now=Date.now()):Run {
 if(run.phase!=='VALIDATION')return run;
 return enter({...run,rows:[...run.rows,rowFor(run,run.tasks[run.cursor],barKg,auto,false,now)]},run.cursor+1,now);
}
export function completeFiller(run:Run,barKg:number,auto=false,now=Date.now()):Run {
 const task=run.tasks[run.cursor],f=task?.fillers?.[run.fillerIndex];if(run.phase!=='REST'||run.pausedAt!==null||!f)return run;
 const next=task.fillers?.[run.fillerIndex+1];
 return {...run,rows:[...run.rows,rowFor(run,f,barKg,auto,true,now)],fillerIndex:run.fillerIndex+1,fillerAt:now,fillerDeadline:next?.seconds?now+next.seconds*1000:null,fillerDone:[...run.fillerDone,f.id]};
}
export function rowFor(run:Run,t:Task,barKg:number,auto:boolean,filler=false,now=Date.now()):Row{
 const originalMeasure=measureFor(t.ex,t.entry),guided=filler||isGuided(t);
 const measure=guided&&originalMeasure==='reps'?'execution':originalMeasure,start=filler?run.fillerAt:(run.executionAt??run.phaseAt);
 const elapsed=Math.max(0,Math.round(((filler?now:run.executionEnd??now)-start)/1000));
 return {uuid:uid(),seance_uuid:run.uuid,date:localDate(new Date(run.startedAt)),heure_debut:new Date(start).toISOString(),seance_id:run.model.id,exercice_id:t.ex.id,index_serie:t.index,cote:t.side,charge_kg:guided?0:taskLoad(run,t,barKg),charge_applicable:!guided&&hasWeight(t.ex),charge_libelle:!guided&&hasLoad(t.ex)?run.bands[t.ex.id]??'':'',mesure:measure,distance_m:measure==='distance'?(filler?distanceFor(t.ex,t.entry):run.distance_m??distanceFor(t.ex,t.entry)):undefined,reps_prevues:measure==='reps'?t.reps:0,reps_faites:measure==='reps'?run.reps:0,duree_s:measure==='duration'&&!filler?(run.duration_s??elapsed):elapsed,rir_ressenti:measure==='reps'&&!guided&&!t.approach?run.rir:null,approche:t.approach,valide_auto:auto,intercalaire:filler,echauffement:!!t.warmup};
}
export function getRecords(rows:Row[],history:Session[]){return [...new Set(rows.filter(r=>!r.approche&&r.charge_kg>0).map(r=>r.exercice_id))].flatMap(id=>{const current=rows.filter(r=>r.exercice_id===id&&!r.approche&&!r.intercalaire&&!r.echauffement);const old=history.filter(s=>s.statut==='terminee').flatMap(s=>s.series).filter(r=>r.exercice_id===id&&!r.approche&&!r.intercalaire&&!r.echauffement);const max=Math.max(...current.map(r=>r.charge_kg)),prev=Math.max(0,...old.map(r=>r.charge_kg));return max>prev?[{id,old:prev,value:max}]:[]})}
export function finishRun(run:Run,history:Session[],status:Session['statut']='terminee'):Session{const now=run.finishedAt??Date.now();return {seance_uuid:run.uuid,date:localDate(new Date(run.startedAt)),seance_id:run.model.id,seance_version:run.model.version,nom:run.model.nom,heure_debut:new Date(run.startedAt).toISOString(),heure_fin:new Date(now).toISOString(),duree_min:Math.round((now-run.startedAt)/6000)/10,exercices_prevus:new Set(run.tasks.filter(t=>t.kind==='set'&&!t.warmup).map(t=>t.ex.id)).size,exercices_faits:new Set(run.rows.filter(r=>!r.approche&&!r.intercalaire&&!r.echauffement).map(r=>r.exercice_id)).size,volume_kg:run.rows.filter(r=>!r.approche&&!r.intercalaire&&!r.echauffement).reduce((n,r)=>n+r.charge_kg*r.reps_faites,0),rpe_global:run.rpe,ressenti:run.note,records:getRecords(run.rows,history).map(x=>x.id),statut:status,series:run.rows,retours:Object.entries(run.retours).map(([id,retour])=>({uuid:uid(),seance_uuid:run.uuid,date:localDate(new Date(run.startedAt)),exercice_id:id,retour,saisi_en:'bilan_seance'}))}}
