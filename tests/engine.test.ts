import {measureFor,distanceFor,rowMeasure,rowDistance,targetLabel,cycleState,primaryRows} from '../lib/activity.ts';
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {compile,enter,makeRun,suggest,taskLoad,finishRun,startExecution,rowFor,completeExecution,confirmLoad,validateExecution,completeFiller,togglePause,restartTimer,isLastSet,nextSet} from '../lib/engine.ts';import type {Program,Session,Row,Run} from '../lib/types.ts';
const p=JSON.parse(readFileSync(new URL('../public/data/programme.json',import.meta.url),'utf8')) as Program;const model=p.modeles.find(m=>m.id==='bas_lourde')!;const squat=p.catalogue.find(e=>e.id==='squat')!,entry=model.exercices.find(e=>e.exercice_id==='squat')!;
const session=(days:number,feedback='ok',reps=5,charge=50):Session=>({seance_uuid:crypto.randomUUID(),date:'2026-10-01',seance_id:'bas_lourde',seance_version:1,nom:'Test',heure_debut:new Date(Date.now()-days*86400000).toISOString(),heure_fin:new Date().toISOString(),duree_min:45,exercices_prevus:3,exercices_faits:3,volume_kg:1000,rpe_global:5,ressenti:'',records:[],statut:'terminee',series:Array.from({length:4},(_,i)=>({exercice_id:'squat',charge_kg:charge,reps_faites:reps,approche:false,cote:'bilateral',index_serie:i+1} as Row)),retours:[{exercice_id:'squat',retour:feedback} as any]});
test('demo catalogue and models are consistent',()=>{assert.equal(p.catalogue.length,34);assert.equal(p.modeles.length,5);for(const m of p.modeles)for(const e of m.exercices)assert.ok(p.catalogue.some(x=>x.id===e.exercice_id))});
test('no history asks for initial load',()=>assert.equal(suggest(squat,entry,model.id,[]).charge,null));
test('two full sessions progress, a hard feedback cancels progression',()=>{assert.equal(suggest(squat,entry,model.id,[session(2),session(9)]).charge,55);assert.equal(suggest(squat,entry,model.id,[session(2,'trop_dur'),session(9)]).charge,45);assert.equal(suggest(squat,entry,model.id,[session(2,'facile'),session(9)]).charge,60)});
test('failed sets do not automatically reduce load',()=>assert.equal(suggest(squat,entry,model.id,[session(2,'ok',3)]).charge,50));
test('long breaks reduce load or request fresh discovery',()=>{assert.equal(suggest(squat,entry,model.id,[session(30)]).charge,40);assert.equal(suggest(squat,entry,model.id,[session(70)]).charge,null)});
test('90% references heavy session once',()=>assert.equal(suggest(squat,entry,'bas_90',[session(2)]).charge,45));

import {migrateData} from '../lib/migrations.ts';
import type {LocalData} from '../lib/types.ts';
const warmModel={...model,exercices:[{...entry,exercice_id:'transition',ordre:1,approche:false,series:1,mesure:'duration' as const,steps:[{exercice_id:'knee_to_wall',duree_s:120,consigne:'10 par côté'},{exercice_id:'pont_fessier',duree_s:60,consigne:'15 mouvements'},{exercice_id:'fente_psoas',duree_s:60,consigne:'3 × 5 s par côté'},{exercice_id:'rotation_thoracique',duree_s:120,consigne:'8 par côté'}]}, {...entry,ordre:2}]};
const forceRun=():Run=>{const run=makeRun({...model,exercices:[{...entry,ordre:1}]},p,[],false);return {...run,loads:{squat:50}}};

test('guided warm-up chains four stages totalling six minutes, without validation or feedback',()=>{
 let run=makeRun(warmModel,p,[],false),now=1000;
 assert.equal(run.tasks.filter(t=>t.warmup).reduce((n,t)=>n+t.seconds,0),360);
 run=startExecution(enter(run,0,now),now);
 for(let i=0;i<4;i++){
  assert.equal(run.phase,'EXECUTION');assert.equal(run.tasks[run.cursor].step,i+1);
  run=completeExecution({...run,rir:8},now+=10000);
  assert.equal(run.rows.length,i+1);assert.equal(run.rows.at(-1)!.rir_ressenti,null);
 }
 assert.equal(run.phase,'CHARGE');assert.equal(run.tasks[run.cursor].factor,0);
 assert.ok(run.rows.every(r=>r.echauffement&&r.reps_faites===0&&!r.charge_applicable));
 assert.deepEqual(run.retours,{});
});
test('approaches use empty bar / 75% / 90%, with full / three-fifths / two-fifths reps',()=>{
 const run=forceRun(),tasks=run.tasks.filter(t=>t.kind==='set'&&t.approach);
 assert.deepEqual(tasks.map(t=>t.factor),[0,.75,.9]);assert.deepEqual(tasks.map(t=>t.reps),[5,3,2]);
 assert.deepEqual(tasks.map(t=>taskLoad(run,t,20)),[20,37.5,45]);
 const fixture={...model,exercices:[{...entry,reps_min:10,reps_max:10}]};
 assert.deepEqual(compile(fixture,p).filter(t=>t.kind==='set'&&t.approach).map(t=>t.reps),[10,6,4]);
});
test('a suggestion does not confirm the load; one confirmation covers all approach and work sets',()=>{
 let run=forceRun();assert.equal(run.phase,'CHARGE');
 run=confirmLoad(run,1000);assert.equal(run.phase,'COUNTDOWN');assert.deepEqual(run.confirmedLoads,['squat']);
 for(let i=1;i<run.tasks.length;i++)if(run.tasks[i].kind==='set')assert.equal(enter(run,i,2000).phase,'READY');
 const started=startExecution(enter(run,run.tasks.findIndex(t=>t.kind==='set'&&!t.approach),2000),2500);
 assert.equal(started.phase,'EXECUTION');assert.equal(startExecution(started,3000),started);
 const restored=JSON.parse(JSON.stringify(run));assert.equal(enter(restored,2).phase,'READY');
});
test('editing a confirmed working load updates upcoming approaches and keeps it confirmed',()=>{
 let run=confirmLoad(forceRun(),1000);run={...run,phase:'CHARGE',loads:{squat:80}};run=confirmLoad(run,2000);
 assert.deepEqual(run.confirmedLoads,['squat']);
 assert.equal(taskLoad(run,run.tasks.find(t=>t.approach&&t.factor===.75)!,20),60);
});
test('recovery starts on set completion and includes time spent editing stats',()=>{
 const run=startExecution(confirmLoad(forceRun(),1000),2000);
 const done=completeExecution({...run,rir:4},12000),restAt=done.restDeadline;
 assert.equal(done.phase,'VALIDATION');assert.equal(done.deadline,20000);assert.equal(restAt,57000);
 const rest=validateExecution({...done,auto:false,deadline:null,reps:4},20,false,30000);
 assert.equal(rest.phase,'REST');assert.equal(rest.deadline,57000);assert.equal(rest.deadline!-30000,27000);
 assert.equal(rest.rows[0].reps_faites,4);assert.equal(rest.rows[0].rir_ressenti,null);
 const late=validateExecution(done,20,false,90000);assert.equal(late.deadline,57000);
});
test('work-set RIR remains available and approaches never record RIR',()=>{
 let run=confirmLoad(forceRun());const index=run.tasks.findIndex(t=>t.kind==='set'&&!t.approach);
 run=startExecution(enter(run,index,1000),2000);
 const completed=completeExecution({...run,rir:3},5000);assert.equal(rowFor(completed,completed.tasks[index],20,false).rir_ressenti,3);
});
test('normal plans preserve prescribed inserts with one activity per rest and no final rest',()=>{
 for(const model of p.modeles){
  const tasks=compile(model,p,false,5),lastSet=tasks.findLastIndex(t=>t.kind==='set');
  assert.equal(tasks.slice(lastSet+1).filter(t=>t.kind==='rest').length,0,model.id);
  for(const rest of tasks.filter(t=>t.kind==='rest'))assert.ok(new Set(rest.fillers?.map(t=>t.ex.id)).size<=1);
  const all=tasks.flatMap(t=>t.kind==='set'?[t]:t.fillers??[]);
  for(const e of model.exercices.filter(e=>!e.jours||e.jours.includes(5))){
   const ex=p.catalogue.find(x=>x.id===e.exercice_id)!;
   const expected=e.steps?.length??e.series*(ex.unilateral?2:1);
   assert.equal(all.filter(t=>t.entry.ordre===e.ordre&&!t.approach).length,expected,model.id+':'+ex.id);
  }
 }
});
test('reduced plans halve force volume, keep approaches and never add an extra rest',()=>{
 const tasks=compile(model,p,true);assert.equal(tasks.filter(t=>t.ex.id==='squat'&&t.kind==='set'&&!t.approach).length,2);
 assert.equal(tasks.filter(t=>t.ex.id==='squat'&&t.kind==='set'&&t.approach).length,3);
 assert.ok(tasks.filter(t=>t.kind==='rest').every(t=>new Set(t.fillers?.map(f=>f.ex.id)).size<=1));
 assert.equal(tasks.at(-1)!.kind,'set');
});
test('isometric inserts retain dedicated recovery after each hold',()=>{
 const fixture={...model,exercices:[{...entry,approche:false,series:4,ordre:1,repos_s:90},{...entry,exercice_id:'squat_isometrique',series:3,ordre:2,approche:false,duree_s:120,mesure:'duration' as const,intercalaire_de:[1]}]};
 const rests=compile(fixture,p).filter(t=>t.kind==='rest');assert.equal(rests.length,3);
 assert.ok(rests.every(t=>t.fillers?.length===1&&t.seconds>=t.fillers[0].seconds+90));
});
test('skipping recovery leaves uncompleted inserts unlogged',()=>{
 const fixture={...model,exercices:[{...entry,approche:false,series:2,ordre:1},{...entry,exercice_id:'fente_psoas',ordre:2,approche:false,series:3,mesure:'duration' as const,duree_s:5,intercalaire_de:[1]}]};
 let run=makeRun(fixture,p,[],false),index=run.tasks.findIndex(t=>t.kind==='rest');run=enter(run,index,1000);
 run=completeFiller(run,20,false,6000);assert.equal(run.rows.length,1);
 const next=enter(run,index+1,7000);assert.deepEqual(next.rows,run.rows);assert.equal(next.fillerIndex,0);
 assert.equal(run.rows[0].rir_ressenti,null);assert.equal(run.rows[0].charge_kg,0);assert.equal(run.rows[0].reps_faites,0);
});
test('pause and resume shift all deadlines, including recovery during validation',()=>{
 const done=completeExecution(startExecution(confirmLoad(forceRun(),1000),2000),5000);
 const paused=togglePause(done,6000),resumed=togglePause(paused,16000);
 assert.equal(resumed.restDeadline,done.restDeadline!+10000);assert.equal(resumed.deadline,done.deadline!+10000);
 assert.equal(resumed.executionEnd,resumed.executionAt!+3000);
});
test('restart restores the whole timer; pause does not consume a warm-up stage',()=>{
 let run=startExecution(enter(makeRun(warmModel,p,[],false),0,1000),2000);
 run=togglePause(run,12000);run=togglePause(run,22000);assert.equal(run.deadline,132000);
 run=restartTimer(run,'activity',32000);assert.equal(run.deadline,152000);assert.equal(run.executionAt,32000);
 const done=completeExecution(run,42000);assert.equal(done.rows[0].duree_s,10);
});
test('short foot alternates contraction and release ten times, bilaterally',()=>{
 const ex={...p.catalogue.find(e=>e.id==='pied_court')!,unilateral:false};
 const fixture={...model,exercices:[{...entry,exercice_id:ex.id,approche:false,series:1,mesure:'duration' as const,duree_s:100,cycle:{count:10,work_s:5,rest_s:5}}]};
 let run=makeRun(fixture,{...p,catalogue:p.catalogue.map(e=>e.id===ex.id?ex:e)},[],false),task=run.tasks[0];
 assert.equal(task.side,'bilateral');assert.equal(run.tasks.filter(t=>t.kind==='set').length,1);
 assert.deepEqual(cycleState(task,1000,1000),{index:1,count:10,contract:true,remaining:5,done:false});
 assert.equal(cycleState(task,1000,6000)!.contract,false);assert.equal(cycleState(task,1000,11000)!.index,2);
 assert.equal(cycleState(task,1000,101000)!.done,true);
 run=completeExecution(startExecution(enter(run,0,1000),1000),101000);
 assert.equal(run.phase,'BILAN');assert.equal(run.rows[0].duree_s,100);assert.equal(run.rows[0].rir_ressenti,null);
});
test('last set finishes the session directly after validation, preserving the finish time',()=>{
 let run=confirmLoad(forceRun(),1000);const last=run.tasks.findLastIndex(t=>t.kind==='set');
 run=startExecution(enter(run,last,2000),3000);assert.equal(isLastSet(run),true);assert.equal(nextSet(run),undefined);
 run=validateExecution(completeExecution(run,6000),20,false,7000);
 assert.equal(run.phase,'BILAN');assert.equal(run.deadline,null);assert.equal(run.finishedAt,7000);
 assert.equal(finishRun(run,[]).heure_fin,new Date(7000).toISOString());
});
test('eight-second reviews and validation remain the default',()=>{
 const run=makeRun(model,p,[],false),cursor=run.tasks.findIndex(t=>t.kind==='review');
 assert.ok(cursor>=0);assert.equal(enter(run,cursor,1000).deadline,9000);
 const done=completeExecution(startExecution(confirmLoad(forceRun(),1000),2000),5000);assert.equal(done.deadline,13000);
});
test('summary separates main sets from warm-up and intercalaires',()=>{
 const row={exercice_id:'squat',approche:false,charge_kg:50,reps_faites:5} as Row;
 const rows=[{...row,exercice_id:'knee_to_wall',echauffement:true},{...row,intercalaire:true},row,{...row,approche:true}];
 assert.deepEqual(primaryRows(rows,p.catalogue),rows.slice(2));
 const run={...forceRun(),rows};const summary=finishRun(run,[]);assert.equal(summary.exercices_faits,1);assert.equal(summary.volume_kg,250);
});
test('legacy distance values remain metres',()=>{
 const ex=p.catalogue.find(e=>e.id==='marche_escargot')!,e={...entry,exercice_id:ex.id,mesure:undefined,reps_min:2,reps_max:2,duree_s:0};
 assert.equal(measureFor(ex,e),'distance');assert.equal(distanceFor(ex,e),2);
 const legacy={exercice_id:ex.id,reps_prevues:2,reps_faites:2,duree_s:0} as Row;assert.equal(rowMeasure(legacy),'distance');assert.equal(rowDistance(legacy),2);
});
test('free guided execution records completion without stats or timer',()=>{
 const ex=p.catalogue.find(e=>e.id==='transition')!,e={...entry,exercice_id:ex.id,approche:false,series:1,reps_min:0,reps_max:0,duree_s:0,mesure:'execution' as const};
 let run=makeRun({...model,exercices:[e]},p,[],false);run=startExecution(run,run.phaseAt+1000);assert.equal(run.deadline,null);
 run=completeExecution(run,run.phaseAt+10000);assert.equal(run.phase,'BILAN');assert.equal(run.rows[0].reps_faites,0);assert.equal(run.rows[0].charge_applicable,false);
 assert.equal(targetLabel(ex,e),'À réaliser');
});
test('default revisions update only affected entries and preserve history, custom loads and active snapshots',()=>{
 const defaults={...p,revision:2,modeles:[warmModel]},old={...defaults,revision:1,modeles:[{...warmModel,version:3,exercices:warmModel.exercices.map(e=>({...e,steps:undefined,revision:0}))}]};
 defaults.modeles[0]={...warmModel,exercices:warmModel.exercices.map((e,i)=>i===0?{...e,revision:2}:e)};
 old.modeles[0].exercices[1].series=7;
 const data={program:old,sessions:[session(2)],running:forceRun(),pending:[],runs:[],settings:{audio:'beeps',barKg:20,reduced:false,sheetsUrl:''},lastSync:null} as LocalData;
 const migrated=migrateData(data,defaults);assert.equal(migrated.program.modeles[0].exercices[0].steps!.length,4);
 assert.equal(migrated.program.modeles[0].exercices[1].series,7);assert.equal(migrated.program.modeles[0].version,4);
 assert.equal(migrated.sessions,data.sessions);assert.equal(migrated.running,data.running);assert.ok(migrated.pending.includes('program'));
 assert.equal(migrateData(migrated,defaults),migrated);
});
