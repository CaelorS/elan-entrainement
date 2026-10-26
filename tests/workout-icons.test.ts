import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {workoutIcons,inferWorkoutIcon,workoutIconId} from '../lib/workout-icons.ts';
test('20 distinct SVG resources, stable IDs and useful attribution',()=>{
 assert.equal(workoutIcons.length,20);assert.equal(new Set(workoutIcons.map(i=>i.id)).size,20);
 const assets=workoutIcons.map(i=>readFileSync(new URL('../public/workout-icons/'+i.id+'.svg',import.meta.url),'utf8'));
 assert.equal(new Set(assets).size,20);assets.forEach(s=>{assert.match(s,/viewBox="0 0 48 48"/);assert.ok(!s.includes('<script'))});
 for(const [nom,icon] of [['Bas du corps · 90 %','lower_body'],['Cycle 1 · Corps entier','full_body'],['Poussée','push'],['Tirage','pull'],['Bloc du matin','morning_routine'],['Natation','swimming'],['Renfo + mobilité dos et genou','mobility'],['Inconnue','full_body']])assert.equal(inferWorkoutIcon({nom}),icon);
 assert.equal(workoutIconId({nom:'Tirage',icon_id:'recovery'}),'recovery');
 assert.equal(inferWorkoutIcon({nom:'Programme',exercices:[{exercice_id:'one'}]},[{id:'one',nom:'Haltères',categorie:'force'}]),'strength');
});
test('migration across accounts preserves every existing value and is idempotent',async()=>{
 const db=new PGlite();await db.exec('create table elan_programs(user_id uuid primary key,payload jsonb);create table elan_exercises(payload jsonb);');
 const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002';
 const originals=[{catalogue:[],modeles:[{id:'a',nom:'Bas du corps',exercices:[{exercice_id:'squat',series:4}],version:2},{id:'a',nom:'Bas du corps',actif_au:'2026-01-01',version:1},{id:'custom',nom:'Tirage',icon_id:'my-custom-icon',note:'Keep me'}]}, {catalogue:[{id:'x',nom:'Course à pied'}],modeles:[{id:'b',nom:'Bloc du matin',jours:[1,3]},{id:'c',nom:'Inconnue',exercices:[{exercice_id:'x'}]}]}];
 for(const [i,id] of [a,b].entries())await db.query('insert into elan_programs values($1,$2)',[id,JSON.stringify(originals[i])]);
 const sql=readFileSync(new URL('../supabase/workout-icons.sql',import.meta.url),'utf8');await db.exec(sql);
 const once=(await db.query<any>('select payload from elan_programs order by user_id')).rows.map(r=>r.payload);
 assert.deepEqual(once.map(p=>p.modeles.map((m:any)=>m.icon_id)),[['lower_body','lower_body','my-custom-icon'],['morning_routine','running']]);
 for(let i=0;i<once.length;i++)assert.deepEqual({...once[i],modeles:once[i].modeles.map(({icon_id,...m}:any)=>m)}, {...originals[i],modeles:originals[i].modeles.map(({icon_id,...m}:any)=>m)});
 await db.exec(sql);assert.deepEqual((await db.query<any>('select payload from elan_programs order by user_id')).rows.map(r=>r.payload),once);await db.close();
});
