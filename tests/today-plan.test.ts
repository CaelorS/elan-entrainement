import test from 'node:test';
import assert from 'node:assert/strict';
import {todayPlan} from '../lib/today-plan.ts';
import type {Model,Session} from '../lib/types';

const day=new Date(2026,10,6,10),date='2026-11-06';
const model=(id:string,jours=[5])=>({id,jours,version:3,archive:false,actif_au:''}) as Model;
const done=(id:string,extra:Partial<Session>={})=>({seance_id:id,date,statut:'terminee',seance_version:1,...extra}) as Session;
const models=[model('poussee'),model('bloc_matin'),model('mobilite'),model('tirage',[4])];

test('today advances through the scheduled sessions after each completed workout',()=>{
 assert.equal(todayPlan(models,[],day).next?.id,'bloc_matin');
 assert.equal(todayPlan(models,[done('bloc_matin')],day).next?.id,'poussee');
 assert.equal(todayPlan(models,[done('bloc_matin'),done('poussee')],day).next?.id,'mobilite');
 const all=todayPlan(models,[done('bloc_matin'),done('poussee'),done('mobilite')],day);
 assert.equal(all.next,undefined);assert.equal(all.remaining.length,0);
 assert.equal(all.candidates.length,3,'do not suggest another day after completing today');
});
test('saved history survives reopening and matches the session id across versions and renames',()=>{
 const saved=JSON.parse(JSON.stringify({models,sessions:[done('bloc_matin',{nom:'Ancien nom'})]}));
 assert.equal(todayPlan(saved.models,saved.sessions,day).next?.id,'poussee');
});
test('interrupted workouts and other dates do not complete today; tomorrow resets',()=>{
 assert.equal(todayPlan(models,[done('bloc_matin',{statut:'abandonnee'}),done('bloc_matin',{date:'2026-11-05'})],day).next?.id,'bloc_matin');
 assert.equal(todayPlan([model('bloc_matin',[5,6])],[done('bloc_matin')],new Date(2026,10,7)).next?.id,'bloc_matin');
});
test('daily completion uses the local calendar date, including shortly after midnight',()=>{
 const localMidnight=new Date(2026,10,6,0,1);
 assert.equal(todayPlan(models,[done('bloc_matin')],localMidnight).next?.id,'poussee');
});
test('unscheduled days keep optional choices but never repeat completed or archived sessions',()=>{
 const optional=[model('a',[]),model('b',[]),{...model('old',[]),actif_au:date},{...model('archived',[]),archive:true}];
 assert.equal(todayPlan(optional,[done('a')],day).next?.id,'b');
 assert.equal(todayPlan(optional,[done('a'),done('b')],day).next,undefined);
 assert.equal(todayPlan([],[],day).next,undefined);
});
