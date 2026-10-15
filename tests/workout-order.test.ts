import test from 'node:test';import assert from 'node:assert/strict';
import {makeRun,enter,togglePause,validateExecution} from '../lib/engine.ts';
import {changeWorkoutExercise,remainingExercises,workoutOrderSignature} from '../lib/workout-order.ts';
import type {Exercise,Entry,Model,Program,Run} from '../lib/types.ts';
const catalogue=['press','hip','row','ankle'].map(id=>({id,nom:id,categorie:'force',type_charge:id==='ankle'?'aucune':'machine',unilateral:false,increment_kg:2})) as Exercise[];
const entry=(id:string,ordre:number)=>({exercice_id:id,ordre,series:3,reps_min:10,reps_max:12,repos_s:60,duree_s:0,approche:false,intercalaire_de:[],mesure:'reps',note:'',format:''}) as Entry;
const model={id:'test',nom:'Test',version:1,exercices:[entry('press',1),entry('hip',2),entry('row',3),{...entry('ankle',4),series:1,mesure:'duration',duree_s:20,intercalaire_de:[1]}]} as Model;
const program={catalogue,modeles:[model]} as Program;
function setup():Run{const r=makeRun(model,program,[],false);return {...r,confirmedLoads:['press','hip','row'],loads:{press:45,hip:15,row:30}}}
test('changing exercise preserves completed prefix, remaining series and original programme',()=>{
 let r=setup();const cursor=r.tasks.findIndex(t=>t.ex.id==='press'&&t.kind==='set'&&t.index===2);r=enter(r,cursor,1000);const before=JSON.stringify(r);const next=changeWorkoutExercise(r,3,20,2000);
 assert.equal(next.tasks[next.cursor].ex.id,'row');assert.deepEqual(next.tasks.slice(0,cursor),r.tasks.slice(0,cursor));
 const deferred=next.tasks.slice(next.cursor).find(t=>t.ex.id==='press'&&t.kind==='set')!;assert.equal(deferred.index,2);
 assert.equal(next.model,r.model);assert.deepEqual(next.loads,r.loads);assert.equal(JSON.stringify(r),before);
 assert.equal(new Set(next.tasks.map(t=>t.id)).size,next.tasks.length);assert.equal(next.tasks.at(-1)!.kind,'set');
 const ids=next.tasks.filter(t=>t.kind==='set').map(t=>t.id).sort();assert.deepEqual(ids,r.tasks.filter(t=>t.kind==='set').map(t=>t.id).sort());
 const resumed=enter(next,next.tasks.indexOf(deferred),3000);assert.equal(resumed.phase,'READY');
});
test('reordering during rest retains its deadline, completed fillers and pending fillers',()=>{
 let r=setup();r=enter(r,r.tasks.findIndex(t=>t.kind==='rest'),1000);const frozen=togglePause(r,5000);const next=changeWorkoutExercise(frozen,3,20,10000);
 assert.equal(next.phase,'REST');assert.equal(next.deadline,r.deadline!+5000);assert.deepEqual(next.tasks[next.cursor].fillers,r.tasks[r.cursor].fillers);assert.deepEqual(next.fillerDone,r.fillerDone);assert.equal(next.tasks[next.cursor+1].ex.id,'row');
});
test('pending validation is recorded exactly once before changing',()=>{
 let r=enter(setup(),0,1000);r={...r,phase:'VALIDATION',executionAt:1000,executionEnd:2000,duration_s:1,reps:11,rir:2,setNote:'test',restCursor:1,restDeadline:62000};
 const next=changeWorkoutExercise(r,2,20,3000);assert.equal(next.rows.length,1);assert.equal(next.rows[0].reps_faites,11);assert.equal(next.rows[0].commentaire,'test');assert.equal(validateExecution(next,20).rows.length,1);assert.equal(next.phase,'REST');
});
test('unfinished execution is deferred without inventing a row and persisted order survives JSON',()=>{
 const r={...enter(setup(),0,1000),phase:'EXECUTION',executionAt:1000} as Run;const next=changeWorkoutExercise(r,2,20,2000);assert.equal(next.rows.length,0);const restored=JSON.parse(JSON.stringify(next));assert.equal(restored.tasks[restored.cursor].ex.id,'hip');assert.ok(remainingExercises(restored).some(x=>x.exerciseId==='press'));assert.equal(restored.model.id,model.id);
 assert.equal(changeWorkoutExercise(r,999,20),r);assert.equal(changeWorkoutExercise(r,1,20),r);
 assert.equal(workoutOrderSignature(next),workoutOrderSignature({...next,savedAt:99999}));assert.notEqual(workoutOrderSignature(next),workoutOrderSignature({...next,reps:8}));
});
