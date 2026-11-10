import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {changeExerciseFormat,defaultExerciseEntry,entryParameterError,formatFor} from '../lib/exercise-format.ts';
import {compile} from '../lib/engine.ts';
import {sharedExerciseTemplate} from '../lib/exercise-picker.ts';
import {programSchema} from '../lib/backup.ts';
import type {Program,Entry} from '../lib/types.ts';
const program=JSON.parse(readFileSync(new URL('../public/data/programme.json',import.meta.url),'utf8')) as Program;
const ex=program.catalogue.find(e=>e.id==='knee_to_wall')!;
const model=program.modeles[0],base:Entry={...defaultExerciseEntry(ex),mesure:'reps',series:2,reps_min:10,reps_max:12,ordre:3,repos_s:60,jours:[2,5],note:'Garder le talon au sol',pause:{approche:false,index:1},intercalaire_de:[2]};
test('changing repetitions to timed holds preserves placement, schedule and series and creates 30 seconds per side',()=>{
 const before=structuredClone(base),entry=changeExerciseFormat(ex,base,'duration');
 assert.deepEqual(base,before);assert.equal(entry.duree_s,30);assert.equal(entry.reps_min,0);assert.equal(entry.reps_max,0);
 for(const key of ['series','repos_s','jours','note','pause','intercalaire_de'] as const)assert.deepEqual(entry[key],base[key]);
 const tasks=compile({...model,exercices:[{...entry,intercalaire_de:[],pause:undefined}]},{...program,modeles:[]},false,-1).filter(t=>t.kind==='set');
 assert.deepEqual(tasks.map(t=>[t.seconds,t.reps,t.side]),[[30,0,'gauche'],[30,0,'droite'],[30,0,'gauche'],[30,0,'droite']]);assert.equal(entryParameterError(ex,entry),null);
});
test('all formats clear incompatible plans, and changing nothing preserves variable durations',()=>{
 const advanced={...base,mesure:'duration' as const,duree_s:100,cycle:{count:10,work_s:5,rest_s:5},approche:true,distance_m:9,durees_s:[100,90]};
 for(const format of ['reps','duration','distance','execution','steps'] as const){const e=changeExerciseFormat(ex,{...advanced,intercalaire_de:[]},format);assert.equal(e.cycle,undefined);assert.equal(e.durees_s,undefined);assert.equal(formatFor(ex,e),format);assert.equal(entryParameterError(ex,e),null);if(format!=='steps')assert.equal(e.steps,undefined);if(format!=='distance')assert.equal(e.distance_m,undefined);if(format!=='reps')assert.equal(e.approche,false)}
 const variable={...base,mesure:'duration' as const,duree_s:20,durees_s:[20,30]};assert.equal(changeExerciseFormat(ex,variable,'duration'),variable);
 const free=changeExerciseFormat(ex,advanced,'execution');assert.equal(free.duree_s,0);assert.equal(free.reps_max,0);
});
test('cycles and sequences compile coherent timers',()=>{
 const cycle=changeExerciseFormat(ex,base,'cycle');assert.equal(cycle.duree_s,100);assert.deepEqual(cycle.cycle,{count:10,work_s:5,rest_s:5});
 const sequence=changeExerciseFormat(ex,{...base,intercalaire_de:[]},'steps');assert.equal(sequence.series,1);assert.equal(sequence.approche,false);assert.equal(sequence.repos_s,0);
 const tasks=compile({...model,exercices:[sequence]},program,false,-1);assert.equal(tasks.length,1);assert.equal(tasks[0].seconds,30);
 assert.ok(entryParameterError(ex,{...sequence,intercalaire_de:[2]}));
});
test('invalid targets cannot be saved',()=>{
 for(const e of [{...base,reps_min:13},{...base,reps_max:1.5},{...base,series:0},{...base,mesure:'duration' as const,duree_s:0},{...base,mesure:'distance' as const,distance_m:0},{...base,cycle:{count:1.5,work_s:5,rest_s:0}},{...base,cycle:{count:2,work_s:0,rest_s:1}}])assert.ok(entryParameterError(ex,e));
 assert.equal(entryParameterError(ex,{...base,cycle:{count:2,work_s:5,rest_s:0}}),null);
});
test('unused catalogue exercises retain their chosen defaults across backup and reuse',()=>{
 const updated={...ex,parametres_defaut:changeExerciseFormat(ex,defaultExerciseEntry(ex),'distance')};
 const restored=programSchema.parse({...program,catalogue:program.catalogue.map(e=>e.id===ex.id?updated:e)}) as Program;
 const saved=restored.catalogue.find(e=>e.id===ex.id)!;const template=sharedExerciseTemplate(saved,model,program.modeles);assert.equal(template.mesure,'distance');assert.equal(template.distance_m,2);
 template.distance_m=7;assert.equal(saved.parametres_defaut?.distance_m,2);
});
