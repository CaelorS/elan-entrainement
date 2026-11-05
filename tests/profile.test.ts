import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {parseProfile} from '../lib/profile.ts';
import {illustrationFor,illustrationSide,exerciseIllustrations} from '../lib/exercise-illustrations.ts';
import {createHash} from 'node:crypto';

test('every published exercise board is a distinct landscape PNG with two equal square halves',async()=>{
 const seen=new Set<string>();
 const manifest=JSON.parse(await readFile(new URL('../public/exercise-illustrations-bd/catalogue.json',import.meta.url),'utf8'));
 assert.deepEqual(manifest,exerciseIllustrations);
 for(const art of exerciseIllustrations){
  const file=await readFile(new URL('../public/exercise-illustrations-bd/'+art.file,import.meta.url));
  assert.equal(file.subarray(0,8).toString('hex'),'89504e470d0a1a0a',art.id);
  assert.equal(file.readUInt32BE(16),2*file.readUInt32BE(20),art.id);
  assert.ok(file.readUInt32BE(20)>=800,art.id);
  const hash=createHash('sha256').update(file).digest('hex');assert.ok(!seen.has(hash),'Duplicate board: '+art.id);seen.add(hash);
 }
});

test('illustrations resolve the actual equipment, respect gender preference and keep unknown UGC unmapped',()=>{
 assert.equal(exerciseIllustrations.length,100);
 assert.equal(new Set(exerciseIllustrations.map(e=>e.id)).size,100);
 assert.equal(exerciseIllustrations.filter(e=>e.interpretation).length,4);
 assert.equal(illustrationFor({id:'developpe_epaules',type_charge:'barre'})?.file,'developpe_epaules.png');
 assert.equal(illustrationFor({id:'developpe_epaules',type_charge:'halteres'})?.file,'developpe_epaules_halteres_sans_dossier.png');
 assert.equal(illustrationFor({id:'future_custom_exercise',type_charge:'barre'}),null);
 for(const e of exerciseIllustrations){assert.equal(illustrationSide(e.id,'male'),'male');assert.equal(illustrationSide(e.id,'female'),'female')}
 assert.equal(exerciseIllustrations.filter(e=>illustrationSide(e.id,'mixed')==='female').length,50);
 assert.equal(parseProfile({gender:'other',illustration_gender:'female'})?.illustration_gender,'female');
 assert.equal(parseProfile({gender:'female',illustration_gender:'unknown'}),null);
});

test('private profiles: safe signup, direct owner only, OAuth and suspended accounts excluded',async()=>{
 const db=new PGlite(),a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002',c='00000000-0000-4000-8000-000000000003';
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth,public to anon,authenticated,service_role;insert into auth.users values('${a}','first@example.invalid',null);`);
  for(const f of ['schema','admin','ai-access'])await db.exec(await readFile(new URL('../supabase/'+f+'.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261105111626_user_illustration_preferences.sql',import.meta.url),'utf8'));
  await db.query('insert into auth.users values($1,$2,$3),($4,$5,$6)',[b,'second@example.invalid',JSON.stringify({gender:'female',illustration_gender:'female'}),c,'third@example.invalid',JSON.stringify({gender:{invalid:true}})]);
  assert.deepEqual((await db.query('select gender,illustration_gender from public.elan_profiles order by user_id')).rows,[{gender:'unspecified',illustration_gender:'mixed'},{gender:'female',illustration_gender:'mixed'},{gender:'unspecified',illustration_gender:'mixed'}]);
  await db.exec(`set role authenticated;set request.jwt.claim.sub='${b}'`);
  assert.equal((await db.query('select * from public.elan_profiles')).rows.length,1);
  assert.equal((await db.query('update public.elan_profiles set illustration_gender=$1 where user_id=$2 returning *',['female',a])).rows.length,0);
  assert.equal((await db.query<{gender:string;illustration_gender:string}>('update public.elan_profiles set illustration_gender=$1 where user_id=$2 returning gender,illustration_gender',['female',b])).rows[0].gender,'female');
  await assert.rejects(db.query('update public.elan_profiles set user_id=$1 where user_id=$2',[a,b]),/permission denied/);
  await assert.rejects(db.query("update public.elan_profiles set gender='invalid'"),/check constraint/);
  await assert.rejects(db.query('delete from public.elan_profiles'),/permission denied/);
  await db.exec(`set request.jwt.claims='{"client_id":"claude"}'`);
  assert.equal((await db.query('select * from public.elan_profiles')).rows.length,0);
  assert.equal((await db.query("update public.elan_profiles set gender='male' returning *")).rows.length,0);
  await db.exec(`reset role;insert into public.elan_account_status(user_id,suspended) values('${b}',true);set role authenticated;set request.jwt.claims='{}'`);
  assert.equal((await db.query('select * from public.elan_profiles')).rows.length,0);
  await db.exec('reset role;set role anon');await assert.rejects(db.query('select * from public.elan_profiles'),/permission denied/);
 }finally{await db.close()}
});
