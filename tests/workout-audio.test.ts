import test from 'node:test';
import assert from 'node:assert/strict';
import {workoutAudioPlan,exerciseVoiceKey} from '../lib/workout-audio.ts';
import type {Run,Task} from '../lib/types';
const task={ex:{id:'droit_femoral',nom:'Droit fémoral',categorie:'mobilite',type_charge:'aucune'},entry:{mesure:'duration'},kind:'set',side:'droite',seconds:30} as Task;
const run=(phase:Run['phase'],changes:Partial<Run>={})=>({uuid:'session',phase,cursor:0,tasks:[task],pausedAt:null,deadline:30000,fillerIndex:0,...changes}) as Run;
test('timed activity, automatic preparation and rest get countdown cues',()=>{
 for(const phase of ['EXECUTION','COUNTDOWN','REST'] as const)assert.deepEqual(workoutAudioPlan(run(phase)).deadlines,[30000]);
 assert.deepEqual(workoutAudioPlan(run('VALIDATION',{restDeadline:40000})).deadlines,[40000]);
 assert.deepEqual(workoutAudioPlan(run('EXECUTION',{pausedAt:1000})).deadlines,[]);
});
test('manual series do not receive preparation beeps; timed manual efforts still beep at the end',()=>{
 const loaded={...task,ex:{...task.ex,type_charge:'halteres',categorie:'force'}};
 for(const phase of ['CHARGE','READY','COUNTDOWN'] as const)assert.deepEqual(workoutAudioPlan(run(phase,{tasks:[loaded]})).deadlines,[]);
 assert.deepEqual(workoutAudioPlan(run('EXECUTION',{tasks:[loaded]})).deadlines,[30000]);
 assert.deepEqual(workoutAudioPlan(run('EXECUTION',{tasks:[{...task,entry:{...task.entry,mesure:'reps'}}],deadline:null})).deadlines,[]);
});
test('timed intercalaires have their own deadline as well as recovery',()=>{
 const rest={...task,kind:'rest',fillers:[task]} as Task;
 const plan=workoutAudioPlan(run('REST',{tasks:[rest],fillerDeadline:12000}));
 assert.deepEqual(plan.deadlines,[30000,12000]);
 assert.deepEqual(plan.announcement?.clips,['repos',exerciseVoiceKey(task.ex),'cote_droite']);
});
test('names load for every execution path without repeating at countdown end',()=>{
 const prepare=workoutAudioPlan(run('COUNTDOWN')).announcement!;
 const execute=workoutAudioPlan(run('EXECUTION')).announcement!;
 assert.equal(prepare.key,execute.key);
 assert.deepEqual(execute.clips,[exerciseVoiceKey(task.ex),'cote_droite']);
 assert.equal(workoutAudioPlan(run('READY')).announcement?.text,'Droit fémoral. Côté droit');
 assert.notEqual(exerciseVoiceKey({nom:'Développé épaules debout'}),exerciseVoiceKey({nom:'Développé épaules, haltères assis sans dossier'}));
 assert.equal(exerciseVoiceKey({nom:'  DROIT   FÉMORAL '}),exerciseVoiceKey(task.ex));
});
