import test from 'node:test';import assert from 'node:assert/strict';
import {regularity} from '../lib/regularity.ts';import type {Model,Session} from '../lib/types';
const model={id:'strength',actif_du:'2026-10-12',actif_au:'',archive:false,jours:[1,3,5]} as Model;
const done=(date:string)=>({date,statut:'terminee'}) as Session;
test('elapsed planned rest preserves streak and future days never add to it',()=>{const result=regularity([model],[done('2026-10-12'),done('2026-10-14')],'2026-10-15');assert.equal(result.streak,3);assert.equal(result.days.length,42);assert.equal(result.days.filter(d=>d.future).length,14);assert.equal(result.days.find(d=>d.date==='2026-10-13')?.valid,true);assert.equal(result.days.find(d=>d.date==='2026-10-15')?.valid,false)});
test('missed planned training breaks streak, today still has time',()=>{assert.equal(regularity([model],[done('2026-10-12')],'2026-10-15').streak,0);assert.equal(regularity([model],[done('2026-10-12')],'2026-10-14').streak,2)});
test('without a schedule empty days do not invent rest credit',()=>assert.equal(regularity([{...model,jours:[]}],[done('2026-10-12')],'2026-10-14').streak,0));
test('rest today can be validated by a completed activity but tomorrow remains future',()=>{const r=regularity([model],[done('2026-10-12'),done('2026-10-14'),done('2026-10-15'),done('2026-10-16')],'2026-10-15');assert.equal(r.streak,4);assert.equal(r.days.find(d=>d.date==='2026-10-16')?.valid,false)});
