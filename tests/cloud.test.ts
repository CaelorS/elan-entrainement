import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import 'fake-indexeddb/auto';
import {restoreBackup} from '../lib/backup.ts';
import {mergeSyncedData} from '../lib/sync-merge.ts';
import {TrainingStore,ProgramConflict} from '../lib/store.ts';
import type {LocalData,Program} from '../lib/types';
const demo=JSON.parse(await readFile(new URL('../public/data/programme.json',import.meta.url),'utf8')) as Program;
const blank=():LocalData=>({program:{catalogue:[],modeles:[]},sessions:[],runs:[],running:null,settings:{audio:'beeps',barKg:20,reduced:false,sheetsUrl:''},pending:[],lastSync:null,programRevision:0});
test('full backup restores programme and preferences, merges history, and rejects malformed files',()=>{
 const local=blank();local.runs=[{uuid:'existing',date:'2026-10-09',km:5}];
 const restored=restoreBackup(local,{program:demo,sessions:[],runs:[{uuid:'new',date:'2026-10-10',km:6}],settings:{audio:'silent',barKg:15,reduced:true}});
 assert.deepEqual(restored.program,demo);assert.equal(restored.settings.barKg,15);assert.equal(restored.runs.length,2);assert.deepEqual(restored.pending,['program','new']);
 assert.equal(local.program.modeles.length,0);
 assert.throws(()=>restoreBackup(local,{program:{catalogue:[],modeles:[{}]},sessions:[],runs:[]}));
 assert.throws(()=>restoreBackup(local,{program:demo,sessions:[],runs:[{uuid:'bad',date:'today',km:-1}]}));
});
test('sync preserves edits made during network requests and adopts the accepted revision',()=>{
 const snapshot=blank();snapshot.program=demo;snapshot.pending=['program'];
 const current=structuredClone(snapshot);current.program.modeles[0].nom='Edited offline';current.runs.push({uuid:'late-run',date:'2026-10-10',km:5});current.pending.push('late-run');
 const remote={...snapshot,pending:[],programRevision:5,lastSync:42};
 const merged=mergeSyncedData(current,snapshot,remote);
 assert.equal(merged.program.modeles[0].nom,'Edited offline');assert.equal(merged.programRevision,5);assert.deepEqual(merged.pending,['program','late-run']);assert.equal(merged.runs.length,1);
});
test('IndexedDB is isolated by account and survives new store instances',async()=>{
 const a=new TrainingStore('a'),b=new TrainingStore('b');const data=blank();data.program=demo;data.pending=['program'];await a.persist(data);
 assert.deepEqual((await new TrainingStore('a').load()).program,demo);assert.equal((await b.load()).program.modeles.length,0);
});
test('failed sync retains pending data; conflict does not overwrite the local programme',async()=>{
 const local=blank();local.program=demo;local.pending=['program'];
 const client={auth:{getSession:async()=>({data:{session:{user:{id:'a'}}}})},rpc:()=>({abortSignal:async()=>({data:null,error:{message:'offline'}})})};
 const store=new TrainingStore('a',client as any);await assert.rejects(store.sync(local),/offline/);assert.deepEqual(local.pending,['program']);
 client.rpc=()=>({abortSignal:async()=>({data:{conflict:true,revision:2,program:{catalogue:[],modeles:[]},sessions:[],runs:[]},error:null} as any)});
 await assert.rejects(store.sync(local),ProgramConflict);assert.deepEqual(local.program,demo);
});
test('Supabase SQL enforces owner isolation, blocks anonymous users and detects stale programme updates',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon; create role authenticated; create schema auth;
   create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   grant usage on schema auth,public to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;
   insert into auth.users values ('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');`);
  const schema=await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8');await db.exec(schema);await db.exec(schema);
  const login=async(id:number)=>db.exec(`reset role;set role authenticated;set request.jwt.claim.sub='00000000-0000-4000-8000-${String(id).padStart(12,'0')}';`);
  const sync=async(program:unknown=null,revision=0,sessions:unknown[]=[])=>{
   const result=await db.query<{result:any}>('select public.elan_sync($1::jsonb,$2::bigint,$3::jsonb) as result',[program?JSON.stringify(program):null,revision,JSON.stringify(sessions)]);return result.rows[0].result;
  };
  await db.exec('set role anon;');await assert.rejects(sync(),/permission denied/);await assert.rejects(db.query('select * from public.elan_sessions'),/permission denied/);
  await login(1);const p={catalogue:[],modeles:[]};const first=await sync(p,0,[{seance_uuid:'s1',series:[]}]);assert.equal(first.revision,1);assert.equal(first.sessions.length,1);
  assert.equal((await sync(p,0)).conflict,false); // Retry after lost response.
  const changed={...p,revision:2};const stale=await sync(changed,0);assert.equal(stale.conflict,true);assert.equal(stale.revision,1);
  const accepted=await sync(changed,1);assert.equal(accepted.revision,2);
  await login(2);const other=await sync();assert.equal(other.program,null);assert.equal(other.sessions.length,0);
  assert.equal((await db.query('select * from public.elan_programs')).rows.length,0);
  await assert.rejects(db.query("insert into public.elan_sessions values('00000000-0000-4000-8000-000000000001','attack','{}')"),/row-level security/);
  await sync(p,0,[{seance_uuid:'s1',series:[],nom:'Owner 2'}]);
  await login(1);assert.equal((await sync()).sessions[0].nom,undefined);
 }finally{await db.close()}
});

test('offline identity survives token expiry without storing credentials or granting server access',async()=>{
 const {readOfflineAccount,rememberAccount}=await import('../lib/offline-account.ts');
 const values=new Map<string,string>(),storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v)},removeItem:(k:string)=>{values.delete(k)}};
 assert.equal(readOfflineAccount(storage),null);
 rememberAccount(storage,{user:{id:'00000000-0000-4000-8000-000000000001',email:'test@example.invalid'},access_token:'must-not-copy'} as any);
 assert.equal(readOfflineAccount(storage)?.user.id,'00000000-0000-4000-8000-000000000001');assert.ok(![...values.values()].join('').includes('must-not-copy'));
 rememberAccount(storage,null);assert.equal(readOfflineAccount(storage),null);
});
