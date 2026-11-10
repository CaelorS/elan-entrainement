import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProgram} from '../lib/legacy-formats.ts';
import {compile} from '../lib/engine.ts';
import {readFileSync} from 'node:fs';
import type {Program,Entry} from '../lib/types.ts';
const demo=JSON.parse(readFileSync(new URL('../public/data/programme.json',import.meta.url),'utf8')) as Program;
const entry:Entry={exercice_id:'knee_to_wall',ordre:10,series:1,reps_min:0,reps_max:0,duree_s:30,repos_s:0,approche:false,intercalaire_de:[],format:'',note:''};
test('legacy groups expand losslessly, remap pause links, preserve history and normalize only once',()=>{
 const sequence={...entry,steps:[{exercice_id:'knee_to_wall',duree_s:30,consigne:'Gauche',cote:'gauche' as const},{exercice_id:'knee_to_wall',duree_s:30,consigne:'Droite',cote:'droite' as const}]};
 const main={...entry,exercice_id:'squat',ordre:20,series:2,repos_s:120};
 const filler={...entry,exercice_id:'pied_court',ordre:30,cycle:{count:10,work_s:5,rest_s:5},intercalaire_de:[20],pause:{approche:false,index:1}};
 const current={...demo.modeles[0],pauses_explicites:true,exercices:[sequence,main,filler]},history={...current,actif_au:'2026-01-01'};
 const before={...demo,modeles:[history,current]},copy=structuredClone(before),after=normalizeProgram(before);
 assert.deepEqual(before,copy);assert.equal(after.modeles[0],history);assert.equal(normalizeProgram(after),after);
 const e=after.modeles[1].exercices;assert.deepEqual(e.map(x=>x.ordre),[1,2,3,4]);assert.deepEqual(e[3].intercalaire_de,[3]);assert.deepEqual(e[3].pause,filler.pause);assert.equal(e[3].duree_s,100);assert.ok(e.every(x=>!x.steps&&!x.cycle));
 const tasks=compile(after.modeles[1],after,false,-1);assert.deepEqual(tasks.filter(t=>t.warmup).map(t=>[t.seconds,t.side,t.ex.consigne]),[[30,'gauche','Gauche'],[30,'droite','Droite']]);assert.equal(tasks.flatMap(t=>t.fillers??[]).length,1);
});
test('short foot timed prescription produces exactly one 30-second hold on each side',()=>{
 const program={...demo,catalogue:demo.catalogue.map(e=>e.id==='pied_court'?{...e,unilateral:true}:e)};
 const model={...demo.modeles[0],exercices:[{...entry,exercice_id:'pied_court'}]};
 assert.deepEqual(compile(model,program,false,-1).filter(t=>t.kind==='set').map(t=>[t.side,t.seconds]),[['gauche',30],['droite',30]]);
});
