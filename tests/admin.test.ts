import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {AdminPreviewStore} from '../lib/admin.ts';
test('admin consultation requires a server role, records access, and never broadens owner writes',async()=>{
 const db=new PGlite();const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002';
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated;insert into auth.users values('${a}','admin@example.invalid'),('${b}','member@example.invalid');`);
  await db.exec(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
  const sql=await readFile(new URL('../supabase/admin.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
  await db.exec(`insert into public.elan_admins values('${a}');insert into public.elan_programs(user_id,payload) values('${b}','{"catalogue":[],"modeles":[]}');`);
  await db.exec('set role anon');await assert.rejects(db.query('select public.elan_admin_users()'),/permission denied/);
  await db.exec(`reset role;set role authenticated;set request.jwt.claim.sub='${b}';`);
  assert.equal((await db.query<{ok:boolean}>('select public.elan_is_admin() as ok')).rows[0].ok,false);
  await assert.rejects(db.query('select public.elan_admin_users()'),/Administrator required/);
  await assert.rejects(db.query('select public.elan_admin_view($1)',[a]),/Administrator required/);
  await assert.rejects(db.query(`insert into public.elan_admins values('${b}')`),/permission denied/);
  await db.exec(`set request.jwt.claim.sub='${a}'`);
  assert.equal((await db.query<{ok:boolean}>('select public.elan_is_admin() as ok')).rows[0].ok,true);
  assert.equal((await db.query<{users:any[]}>('select public.elan_admin_users() as users')).rows[0].users.length,2);
  const view=(await db.query<{view:any}>('select public.elan_admin_view($1) as view',[b])).rows[0].view;
  assert.deepEqual(view.program,{catalogue:[],modeles:[]});assert.deepEqual(view.sessions,[]);
  assert.equal((await db.query('select * from public.elan_programs')).rows.length,0);
  await assert.rejects(db.query(`insert into public.elan_programs(user_id,payload) values('${b}','{}')`),/row-level security/);
  await db.exec('reset role');assert.equal((await db.query('select * from public.elan_admin_views')).rows.length,1);
  await db.exec(`delete from public.elan_admins;set role authenticated;set request.jwt.claim.sub='${a}'`);
  await assert.rejects(db.query('select public.elan_admin_view($1)',[b]),/Administrator required/);
 }finally{await db.close()}
});
test('preview edits use memory only, do not mutate the source and are discarded on exit',async()=>{
 const remote={program:{catalogue:[],modeles:[]},revision:1,conflict:false,sessions:[],runs:[]};
 const preview=new AdminPreviewStore('a','b',remote);const local=await preview.load();local.runs.push({uuid:'trial',date:'2026-10-12',km:2});local.pending=['trial'];await preview.persist(local);await preview.flush();
 assert.equal((await preview.load()).runs.length,1);assert.equal(remote.runs.length,0);
 assert.deepEqual((await preview.sync(local)).data.pending,[]);
 assert.equal((await new AdminPreviewStore('a','b',remote).load()).runs.length,0);
});
