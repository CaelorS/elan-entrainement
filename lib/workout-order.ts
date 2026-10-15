import type {Run} from './types.ts';
import {enter,validateExecution,togglePause} from './engine.ts';

function pendingStart(run:Run){return run.cursor+(['REST','REVIEW','VALIDATION'].includes(run.phase)?1:0)}
export function remainingExercises(run:Run){
 if(run.phase==='BILAN')return [];
 const current=run.tasks[run.cursor]?.entry.ordre;
 const sets=run.tasks.slice(pendingStart(run)).filter(t=>t.kind==='set');
 return [...new Set(sets.map(t=>t.entry.ordre))].filter(order=>order!==current).map(order=>{
  const tasks=sets.filter(t=>t.entry.ordre===order),first=tasks[0];
  return {order,name:first.ex.nom,exerciseId:first.ex.id,remaining:new Set(tasks.filter(t=>!t.approach).map(t=>t.index)).size,approaches:tasks.some(t=>t.approach)};
 });
}
// Move existing tasks, never recompile: completed sets and insert identities stay intact.
export function changeWorkoutExercise(run:Run,order:number,barKg:number,now=Date.now()):Run{
 if(!remainingExercises(run).some(e=>e.order===order))return run;
 let base=run.pausedAt===null?run:togglePause(run,now);
 if(base.phase==='VALIDATION')base=validateExecution(base,barKg,false,now);
 const start=pendingStart(base);
 const pending=base.tasks.slice(start),chosen=pending.filter(t=>t.entry.ordre===order),deferred=pending.filter(t=>t.entry.ordre!==order);
 const tail=[...chosen,...deferred];
 while(tail.length&&tail.at(-1)!.kind!=='set')tail.pop();
 const tasks=[...base.tasks.slice(0,start),...tail];
 if(base.phase==='REST'||base.phase==='REVIEW')return {...base,tasks,savedAt:now};
 return enter({...base,tasks,restDeadline:undefined,restCursor:undefined},start,now);
}
export function workoutOrderSignature(run:Run){const {savedAt,...state}=run;return JSON.stringify(state)}
