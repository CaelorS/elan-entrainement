import type {Program,Model,Entry,Exercise,Task,Session,Run,Row,Feedback} from './types';
export const AUTO_VALIDATE_SECONDS=8;
export const uid=()=>crypto.randomUUID();
export const localDate=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export const fmtTime=(seconds:number)=>`${Math.floor(Math.max(0,seconds)/60).toString().padStart(2,'0')}:${Math.floor(Math.max(0,seconds)%60).toString().padStart(2,'0')}`;
export const fmt=(n:number)=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1}).format(n);
const mode=(a:number[])=>a.reduce((best,v)=>a.filter(x=>x===v).length>a.filter(x=>x===best).length?v:best,a[0]??0);
export function suggest(ex:Exercise,entry:Entry,sid:string,history:Session[],now=Date.now()){
 const all=history.filter(s=>s.statut==='terminee'&&s.series.some(r=>r.exercice_id===ex.id&&!r.approche)).sort((a,b)=>b.heure_debut.localeCompare(a.heure_debut));
 const latest=all[0];if(!latest)return {charge:null,motif:'Première séance',reference:'Choisis une charge confortable.'};
 const age=(now-new Date(latest.heure_debut).getTime())/86400000;
 if(age>60)return {charge:null,motif:'Reprise après une longue coupure',reference:'Définis une nouvelle charge de départ.'};
 // Friday uses the heavy session as its reference, so 90% never compounds.
 const referenceSid=sid==='bas_90'&&['squat','souleve_terre'].includes(ex.id)?'bas_lourde':sid;
 let sessions=all.filter(s=>s.seance_id===referenceSid&&(now-new Date(s.heure_debut).getTime())/86400000<=56);
 if(!sessions.length)sessions=all.slice(0,2);
 const rows=(s:Session)=>s.series.filter(r=>r.exercice_id===ex.id&&!r.approche);
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
function sets(ex:Exercise,e:Entry,approach=false,factor=1,indexOffset=0):Task[]{let out:Task[]=[];for(let i=1;i<=e.series;i++)for(const side of ex.unilateral?['gauche','droite'] as const:['bilateral'] as const)out.push({id:uid(),kind:'set',ex,entry:e,index:i+indexOffset,side,approach,factor,reps:e.reps_max,seconds:e.duree_s});return out}
export function compile(model:Model,program:Program,reduced=false,day=new Date().getDay()):Task[]{
 const catalogue=new Map(program.catalogue.map(e=>[e.id,e]));
 const main=model.exercices.filter(e=>!e.intercalaire_de.length&&(!e.jours||e.jours.includes(day))).sort((a,b)=>a.ordre-b.ordre);
 let fillers=model.exercices.filter(e=>e.intercalaire_de.length).sort((a,b)=>a.ordre-b.ordre).flatMap(e=>sets(catalogue.get(e.exercice_id)!,e));
 const out:Task[]=[];
 main.forEach(raw=>{const e={...raw,series:reduced&&catalogue.get(raw.exercice_id)?.categorie==='force'?Math.ceil(raw.series/2):raw.series};const ex=catalogue.get(e.exercice_id)!;if(!ex)return;
 if(e.approche){[0,.5,.8].forEach((factor,i)=>{const t=sets(ex,{...e,series:1,reps_max:[5,3,2][i],reps_min:[5,3,2][i]},true,factor,i)[0];out.push(t,{...t,id:uid(),kind:'rest',seconds:45,fillers:[]})})}
 const work=sets(ex,e);work.forEach((t,i)=>{out.push(t);if(t.side==='gauche')return;
 const eligible=fillers.filter(f=>f.entry.intercalaire_de.includes(e.ordre));let picked:Task[]=[];let budget=e.repos_s;
 // Keep one isometric hold per rest and at least its prescribed recovery after it.
 if(eligible.length){
  let occupied=0;
  while(eligible.length){
   const first=eligible[0];const group=eligible.filter(f=>f.ex.id===first.ex.id&&f.index===first.index);
   const duration=group.reduce((n,f)=>n+(f.seconds||Math.max(20,f.reps*3)),0);
   if(picked.length&&(occupied+duration>budget||first.ex.id==='squat_isometrique'||picked.some(f=>f.ex.id==='squat_isometrique')))break;
   picked.push(...group);occupied+=duration;eligible.splice(0,group.length);
   if(first.ex.id==='squat_isometrique')break;
  }
  fillers=fillers.filter(f=>!picked.some(p=>p.id===f.id));budget=Math.max(budget,occupied+(picked.some(f=>f.ex.id==='squat_isometrique')?90:0));
 }
 if((i<work.length-1||picked.length)&&budget>0)out.push({...t,id:uid(),kind:'rest',seconds:budget,fillers:picked});});
 // Exhaust remaining inserts only at their last possible carrier, preserving their order.
 const remaining=fillers.filter(f=>Math.max(...f.entry.intercalaire_de)<=e.ordre);
 while(remaining.length){const first=remaining.shift()!;let group=[first];if(first.side==='gauche'&&remaining[0]?.side==='droite'&&remaining[0].ex.id===first.ex.id)group.push(remaining.shift()!);out.push({...first,id:uid(),kind:'rest',seconds:Math.max(e.repos_s,group.reduce((n,f)=>n+(f.seconds||Math.max(30,f.reps*3)),0)+(first.ex.id==='squat_isometrique'?90:0)),fillers:group});fillers=fillers.filter(f=>!group.some(g=>g.id===f.id));}
 out.push({id:uid(),kind:'review',ex,entry:e,index:e.series,side:'bilateral',approach:false,factor:1,reps:0,seconds:AUTO_VALIDATE_SECONDS});
 });return out;
}
export function enter(run:Run,cursor:number,now=Date.now()):Run {const t=run.tasks[cursor];if(!t)return {...run,cursor,phase:'BILAN',deadline:null,pausedAt:null,savedAt:now};const key=t.ex.id;let phase:Run['phase']=t.kind==='review'?'REVIEW':t.kind==='rest'?'REST':(['barre','halteres','elastique'].includes(t.ex.type_charge)?'CHARGE':'COUNTDOWN');const sec=phase==='REVIEW'?AUTO_VALIDATE_SECONDS:phase==='REST'?t.seconds:phase==='COUNTDOWN'?5:0;const f=t.fillers?.[0];return {...run,cursor,phase,phaseAt:now,executionAt:undefined,executionEnd:undefined,deadline:sec?now+sec*1000:null,pausedAt:null,reps:t.reps,rir:null,auto:true,fillerIndex:0,fillerAt:now,fillerDeadline:f?.seconds?now+f.seconds*1000:null,fillerDone:[],savedAt:now};}
export function startExecution(run:Run,now=Date.now()):Run {
 if(run.phase!=='COUNTDOWN'||run.pausedAt!==null)return run;
 const task=run.tasks[run.cursor];
 return {...run,phase:'EXECUTION',phaseAt:now,executionAt:now,executionEnd:undefined,deadline:task.seconds?now+task.seconds*1000:null};
}
export function makeRun(model:Model,program:Program,history:Session[],reduced:boolean):Run{const now=Date.now();if(model.id==='bloc_matin'&&![2,5].includes(new Date(now).getDay())){const yesterday=new Date(now);yesterday.setDate(yesterday.getDate()-1);const moved=new Set(history.filter(s=>s.statut==='terminee'&&s.date===localDate(yesterday)).flatMap(s=>s.series.filter(r=>r.intercalaire).map(r=>r.exercice_id)));model={...model,exercices:model.exercices.filter(e=>!moved.has(e.exercice_id))}}const tasks=compile(model,program,reduced);const suggestions:Run['suggestions']={};const loads:Run['loads']={};const bands:Run['bands']={};for(const t of tasks){if(suggestions[t.ex.id])continue;suggestions[t.ex.id]=suggest(t.ex,t.entry,model.id,history);if(suggestions[t.ex.id].charge!==null)loads[t.ex.id]=suggestions[t.ex.id].charge!;const previous=history.flatMap(s=>s.series).filter(r=>r.exercice_id===t.ex.id&&r.charge_libelle).at(-1);if(previous)bands[t.ex.id]=previous.charge_libelle;}
 return enter({uuid:uid(),model,tasks,cursor:0,phase:'COUNTDOWN',startedAt:now,phaseAt:now,deadline:null,pausedAt:null,rows:[],retours:{},loads,bands,reps:0,rir:null,auto:true,fillerIndex:0,fillerAt:now,fillerDeadline:null,fillerDone:[],suggestions,savedAt:now,rpe:null,note:'',reduced},0,now)}
export function taskLoad(run:Run,t:Task,barKg:number){const base=run.loads[t.ex.id]??0;if(!t.approach)return base;if(t.factor===0)return Math.min(barKg,base||barKg);return Math.round(base*t.factor/t.ex.increment_kg)*t.ex.increment_kg;}
export function rowFor(run:Run,t:Task,barKg:number,auto:boolean,filler=false,now=Date.now()):Row{return {uuid:uid(),seance_uuid:run.uuid,date:localDate(new Date(run.startedAt)),heure_debut:new Date(filler?run.fillerAt:(run.executionAt??run.phaseAt)).toISOString(),seance_id:run.model.id,exercice_id:t.ex.id,index_serie:t.index,cote:t.side,charge_kg:taskLoad(run,t,barKg),charge_libelle:run.bands[t.ex.id]??'',reps_prevues:t.reps,reps_faites:filler?t.reps:run.reps,duree_s:t.seconds||Math.max(0,Math.round(((filler?now:run.executionEnd??now)-(filler?run.fillerAt:run.executionAt??run.phaseAt))/1000)),rir_ressenti:filler?null:run.rir,approche:t.approach,valide_auto:auto,intercalaire:filler}}
export function getRecords(rows:Row[],history:Session[]){return [...new Set(rows.filter(r=>!r.approche&&r.charge_kg>0).map(r=>r.exercice_id))].flatMap(id=>{const current=rows.filter(r=>r.exercice_id===id&&!r.approche);const old=history.filter(s=>s.statut==='terminee').flatMap(s=>s.series).filter(r=>r.exercice_id===id&&!r.approche);const max=Math.max(...current.map(r=>r.charge_kg)),prev=Math.max(0,...old.map(r=>r.charge_kg));return max>prev?[{id,old:prev,value:max}]:[]})}
export function finishRun(run:Run,history:Session[],status:Session['statut']='terminee'):Session{const now=Date.now();return {seance_uuid:run.uuid,date:localDate(new Date(run.startedAt)),seance_id:run.model.id,seance_version:run.model.version,nom:run.model.nom,heure_debut:new Date(run.startedAt).toISOString(),heure_fin:new Date(now).toISOString(),duree_min:Math.round((now-run.startedAt)/6000)/10,exercices_prevus:new Set(run.tasks.filter(t=>t.kind==='set').map(t=>t.ex.id)).size,exercices_faits:new Set(run.rows.filter(r=>!r.approche).map(r=>r.exercice_id)).size,volume_kg:run.rows.filter(r=>!r.approche).reduce((n,r)=>n+r.charge_kg*r.reps_faites,0),rpe_global:run.rpe,ressenti:run.note,records:getRecords(run.rows,history).map(x=>x.id),statut:status,series:run.rows,retours:Object.entries(run.retours).map(([id,retour])=>({uuid:uid(),seance_uuid:run.uuid,date:localDate(new Date(run.startedAt)),exercice_id:id,retour,saisi_en:'bilan_seance'}))}}
