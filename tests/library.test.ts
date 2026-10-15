import test from 'node:test';import assert from 'node:assert/strict';
import {moveEntry,orderedEntries} from '../lib/library.ts';import type {Model,Entry} from '../lib/types.ts';
const entry=(id:string,ordre:number,parents:number[]=[])=>({exercice_id:id,ordre,intercalaire_de:parents}) as Entry;
const model={exercices:[entry('squat',1),entry('deadlift',2),entry('ankle',3,[1]),entry('chair',4,[2])]} as Model;
test('moving a principal exercise preserves insert associations and leaves source untouched',()=>{const changed=moveEntry(model,2,-1);assert.deepEqual(orderedEntries(changed).map(e=>e.exercice_id),['deadlift','chair','squat','ankle']);assert.equal(changed.exercices.find(e=>e.exercice_id==='ankle')?.intercalaire_de[0],changed.exercices.find(e=>e.exercice_id==='squat')?.ordre);assert.deepEqual(model.exercices.map(e=>e.exercice_id),['squat','deadlift','ankle','chair']);assert.equal(moveEntry(model,1,-1),model)});
test('moving inserts stays within related exercises and preserves every entry',()=>{const m={...model,exercices:[...model.exercices,entry('foot',5,[1])]};const changed=moveEntry(m,5,-1);assert.deepEqual(orderedEntries(changed).map(e=>e.exercice_id),['squat','foot','ankle','deadlift','chair']);assert.equal(changed.exercices.length,5)});
import {previewDrop,dropEntry,fitRest,restBudget,duplicateInsert} from '../lib/library.ts';
test('dropping an insert reparents it and keeps all identities',()=>{const changed=dropEntry(model,3,2,true);const parent=changed.exercices.find(e=>e.exercice_id==='deadlift')!;assert.deepEqual(changed.exercices.find(e=>e.exercice_id==='ankle')!.intercalaire_de,[parent.ordre]);assert.equal(changed.exercices.length,4)});
import type {Exercise} from '../lib/types.ts';
const catalogue=['squat','deadlift','ankle','chair'].map(id=>({id,categorie:'force',type_charge:'barre',unilateral:false})) as Exercise[];
const realistic={...model,exercices:model.exercices.map(e=>({...e,series:e.intercalaire_de.length?1:4,mesure:e.intercalaire_de.length?'duration':'reps',repos_s:e.intercalaire_de.length?0:60,duree_s:e.intercalaire_de.length?100:0,reps_min:5,reps_max:5,approche:false}))} as Model;
test('rest correction increases only linked rest and preserves draft',()=>{const fixed=fitRest(realistic,catalogue);assert.equal(fixed.exercices[0].repos_s,100);assert.equal(realistic.exercices[0].repos_s,60)});
test('rest budget counts three 90s approaches plus actual work pauses',()=>{const m={...realistic,exercices:realistic.exercices.map(e=>({...e,approche:e.ordre===1,repos_s:e.intercalaire_de.length?0:180}))};const report=restBudget(m,catalogue).reports[0];assert.equal(report.available,990);assert.equal(fitRest(m,catalogue).exercices[0].repos_total_s,990);const last={...m,exercices:[m.exercices[0]]};assert.equal(restBudget(last,catalogue).reports[0].available,810)});
test('duplicating an insert preserves original and creates an independent entry',()=>{const result=duplicateInsert(realistic,3);assert.equal(result.exercices.length,5);result.exercices[4].intercalaire_de=[2];assert.deepEqual(realistic.exercices[2].intercalaire_de,[1]);assert.notEqual(result.exercices[4].ordre,3)});
test('total space alone cannot hide missing pause slots',()=>{const m={...realistic,exercices:[{...realistic.exercices[0],series:1,approche:false},realistic.exercices[2]]};assert.ok(restBudget(m,catalogue).reports[0].extraSlots>0)});

test('drag preview matches committed order and preserves the untouched model',()=>{
 const original=JSON.stringify(model);
 for(const [source,target,insert,after] of [[1,2,false,true],[2,1,false,false],[3,2,true,true],[4,1,true,false],[1,1,false,false]] as const){
  const preview=previewDrop(model,source,target,insert,after);
  const result=dropEntry(model,source,target,insert,after);
  assert.deepEqual(preview.map(e=>e.exercice_id),orderedEntries(result).map(e=>e.exercice_id));
  assert.equal(new Set(preview.map(e=>e.ordre)).size,model.exercices.length);
  assert.equal(JSON.stringify(model),original);
 }
 assert.deepEqual(previewDrop(model,1,2,false,true).map(e=>e.exercice_id),['deadlift','chair','squat','ankle']);
});

import {newRestIssues,withRestTotals} from '../lib/library.ts';
test('editing an unrelated warm-up does not block on an existing insert shortage or change rests',()=>{
 const warm={...entry('warm',0),series:1,mesure:'duration' as const,duree_s:480,repos_s:0,approche:false,reps_min:0,reps_max:0};
 const cat=[...catalogue,{...catalogue[0],id:'warm',categorie:'echauffement',type_charge:'aucune'}];
 const before={...realistic,exercices:[warm,...realistic.exercices]};
 assert.ok(restBudget(before,cat).reports.some(r=>r.missing>0));
 const edited={...before,exercices:before.exercices.map(e=>e.ordre===0?{...e,duree_s:240}:e)};
 assert.deepEqual(newRestIssues(edited,cat,before,cat),[]);
 const saved=withRestTotals(edited,cat);assert.equal(saved.exercices[0].duree_s,240);assert.deepEqual(saved.exercices.map(e=>e.repos_s),before.exercices.map(e=>e.repos_s));
});
test('new or worsened insert shortages still warn; accepted correction affects only those parents',()=>{
 const edited={...realistic,exercices:realistic.exercices.map(e=>e.ordre===3?{...e,duree_s:150}:e)};
 const issues=newRestIssues(edited,catalogue,realistic);assert.deepEqual(issues.map(r=>r.order),[1]);
 const fixed=fitRest(edited,catalogue,issues.map(r=>r.order));assert.equal(fixed.exercices.find(e=>e.ordre===1)!.repos_s,150);assert.equal(fixed.exercices.find(e=>e.ordre===2)!.repos_s,60);
 assert.ok(newRestIssues(edited,catalogue).length>0);
 const improved={...realistic,exercices:realistic.exercices.map(e=>e.ordre===3?{...e,duree_s:80}:e)};assert.deepEqual(newRestIssues(improved,catalogue,realistic),[]);
 const reordered=moveEntry(realistic,2,-1);assert.deepEqual(newRestIssues(reordered,catalogue,realistic),[]);
});

import {exerciseDuration} from '../lib/library.ts';
test('total duration includes approaches and actual rest without a final recovery',()=>{
 const ex=catalogue[0],e={...realistic.exercices[0],series:4,reps_max:5,approche:true,repos_s:180};
 assert.equal(exerciseDuration(ex,e),950);
 const saved=withRestTotals({...realistic,exercices:[e]},catalogue);assert.equal(saved.exercices[0].duree_totale_s,950);
});
test('insert totals include both sides, varying holds, cycles and their own recovery',()=>{
 const ex={...catalogue[2],unilateral:true};const e={...realistic.exercices[2],series:3,duree_s:30,repos_s:10};
 assert.equal(exerciseDuration(ex,e),200);
 assert.equal(exerciseDuration(ex,{...e,durees_s:[20,30,40]}),200);
 assert.equal(exerciseDuration({...ex,unilateral:false},{...e,series:1,cycle:{count:10,work_s:5,rest_s:5}}),100);
});
test('guided warmup totals use all steps and recalculate after duration changes',()=>{
 const e={...realistic.exercices[0],series:1,approche:false,steps:[{exercice_id:'squat',consigne:'A',duree_s:120},{exercice_id:'ankle',consigne:'B',duree_s:240}]};
 assert.equal(exerciseDuration(catalogue[0],e,undefined,catalogue),360);
 assert.equal(exerciseDuration(catalogue[0],{...e,steps:e.steps.map(s=>({...s,duree_s:s.duree_s/2}))},undefined,catalogue),180);
});
