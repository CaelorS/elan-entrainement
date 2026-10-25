import test from 'node:test';
import assert from 'node:assert/strict';
import {createElanHandler,sessionSchema,type Snapshot} from './core.ts';
function fixture(){let state:Snapshot={program:{catalogue:[],modeles:[]},catalogue:[],revision:0,can_write:true};return {read:async()=>structuredClone(state),write:async(program:Snapshot['program'],revision:number)=>{if(revision!==state.revision)throw Error('conflict');state={...state,program,revision:revision+1};return state},readOnly:()=>{state.can_write=false}}}
async function rpc(repo:ReturnType<typeof fixture>,method:string,params:unknown={}){const res=await createElanHandler(repo).fetch(new Request('https://example.test/mcp',{method:'POST',headers:{'content-type':'application/json',accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})}));const body=await res.text();const parsed=JSON.parse(body.startsWith('event:')?body.split('\n').find(l=>l.startsWith('data:'))!.slice(5):body);return parsed}
test('MCP handshake and discovery expose tools with valid input schemas',async()=>{const r=fixture();const init=await rpc(r,'initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'test',version:'1'}});assert.equal(init.result.serverInfo.name,'elan');const list=await rpc(r,'tools/list');assert.equal(list.result.tools.length,7);assert.ok(list.result.tools.find((t:any)=>t.name==='elan_save_session').inputSchema.properties.session)});
test('MCP creates exercises and sessions, rejects stale writes and read-only writes',async()=>{const repo=fixture();const call=(name:string,args:unknown)=>rpc(repo,'tools/call',{name,arguments:args});let r=await call('elan_save_exercise',{revision:0,exercise:{id:'squat',nom:'Squat',type_charge:'barre'}});assert.equal(r.result.structuredContent.revision,1);r=await call('elan_save_session',{revision:1,session:{id:'lower',nom:'Bas du corps',jours:[1,4],exercices:[{exercice_id:'squat',series:3,reps_min:5,reps_max:5,mesure:'reps',repos:'03:00',repos_approche:'01:30'}]}});assert.equal(r.result.structuredContent.revision,2);assert.equal((await repo.read()).program.modeles[0].exercices[0].approche_repos_s,90);r=await call('elan_archive_session',{revision:1,id:'lower',archive:true});assert.equal(r.result.isError,true);repo.readOnly();r=await call('elan_archive_session',{revision:2,id:'lower',archive:true});assert.equal(r.result.isError,true)});
test('invalid durations and references cannot create corrupt sessions',async()=>{assert.equal(sessionSchema.safeParse({id:'x',nom:'x',exercices:[{exercice_id:'x',series:2,mesure:'duration',duree:'01:70'}]}).success,false);const repo=fixture();const r=await rpc(repo,'tools/call',{name:'elan_save_session',arguments:{revision:0,session:{id:'x',nom:'x',exercices:[{exercice_id:'missing',series:1,mesure:'duration',duree:'01:00'}]}}});assert.equal(r.result.isError,true);assert.equal((await repo.read()).revision,0)});
test('all advanced parameters round-trip and omitted fields survive legacy edits',async()=>{
 const repo=fixture();const call=async(name:string,args:any)=>(await rpc(repo,'tools/call',{name,arguments:args})).result;
 for(const id of ['main','warm','insert']){const r=await call('elan_save_exercise',{revision:(await repo.read()).revision,exercise:{id,nom:id,type_charge:'poids_corps',audio_nom:id+'.m4a',statut:'actif',reference_kg:10}});assert.ok(!r.isError,JSON.stringify(r));assert.ok(r.structuredContent.exercise.reference_at)}
 const input={id:'full',nom:'Complète',pauses_explicites:true,exercices:[{exercice_id:'main',ordre:10,series:2,mesure:'reps',reps_min:5,reps_max:8,repos:'02:00',approche:true,repos_approche:'00:50',angle_deg:90,jours:[1,4],format:'Libre'},{exercice_id:'warm',ordre:20,series:1,mesure:'duration',steps:[{exercice_id:'insert',duree:'00:45',consigne:'Doucement'}]},{exercice_id:'insert',ordre:30,series:1,mesure:'duration',cycle:{count:3,work:'00:05',rest:'00:10'},intercalaire_de:[10],pause:{approche:true,index:2}},{exercice_id:'warm',ordre:40,series:2,mesure:'duration',durees:['00:20','00:30']}]};
 let r=await call('elan_save_session',{revision:3,session:input});assert.ok(!r.isError,JSON.stringify(r));
 r=await call('elan_get_session',{id:'full'});const first=r.structuredContent;assert.equal(first.session.exercices[2].duree_s,45);assert.equal(first.session.exercices[1].steps[0].duree_s,45);
 let edit=first.editable_session;edit.nom='Renommée';r=await call('elan_save_session',{revision:first.revision,session:edit});assert.ok(!r.isError,JSON.stringify(r));
 r=await call('elan_get_session',{id:'full'});assert.equal(r.structuredContent.session.nom,'Renommée');assert.deepEqual(r.structuredContent.editable_session.exercices,first.editable_session.exercices);
 assert.equal((await call('elan_list_sessions',{})).structuredContent.sessions.length,1);assert.equal((await repo.read()).program.modeles.length,2);
 edit=r.structuredContent.editable_session;delete edit.exercices[0].angle_deg;delete edit.exercices[2].cycle;
 r=await call('elan_save_session',{revision:r.structuredContent.revision,session:edit});assert.ok(!r.isError,JSON.stringify(r));
 r=await call('elan_get_session',{id:'full'});assert.equal(r.structuredContent.session.exercices[0].angle_deg,90);assert.equal(r.structuredContent.session.exercices[2].cycle.count,3);
 edit=r.structuredContent.editable_session;edit.exercices[2].cycle=null;edit.exercices[0].repos_approche=null;
 r=await call('elan_save_session',{revision:r.structuredContent.revision,session:edit});assert.ok(!r.isError,JSON.stringify(r));
 const final=(await call('elan_get_session',{id:'full'})).structuredContent.session;assert.equal(final.exercices[2].cycle,undefined);assert.equal(final.exercices[0].approche_repos_s,undefined);
});
test('advanced invalid combinations and nested references fail without writing',async()=>{
 const repo=fixture();await rpc(repo,'tools/call',{name:'elan_save_exercise',arguments:{revision:0,exercise:{id:'x',nom:'X'}}});
 for(const extra of [{steps:[{exercice_id:'missing',duree:'00:10',consigne:''}]},{durees:['00:10','00:20']},{angle_deg:181},{cycle:{count:2,work:'00:05',rest:'00:05'},durees:['00:10']},{pause:{approche:false,index:1}}]){
 const r=await rpc(repo,'tools/call',{name:'elan_save_session',arguments:{revision:1,session:{id:'x',nom:'X',exercices:[{exercice_id:'x',series:1,mesure:'duration',duree:'00:30',...extra}]}}});assert.ok(r.result?.isError||r.error,JSON.stringify(r));assert.equal((await repo.read()).revision,1);
 }
});
test('reference is discoverable and covers every model field',async()=>{
 const r=await rpc(fixture(),'tools/call',{name:'elan_get_parameters',arguments:{}});assert.ok(!r.result.isError,JSON.stringify(r));assert.ok(r.result.structuredContent.session.properties.exercices.items.properties.steps);
 const {readFileSync}=await import('node:fs');const types=readFileSync(new URL('../lib/types.ts',import.meta.url),'utf8');
 const {fieldMap,managedFields}=await import('./parameters.ts');
 for(const [type,key] of [['Exercise','exercise'],['Model','session'],['Entry','entry'],['WarmupStep','step'],['Cycle','cycle']] as const){
 const body=types.match(new RegExp('export type '+type+'=\\{(.*)\\};'))![1].replace(/\{[^}]*\}/g,'OBJECT');
 const fields=body.split(';').map(s=>s.match(/^(\w+)\??:/)?.[1]).filter(Boolean).sort();
 const mapped=[...Object.values(fieldMap[key]),...Object.keys((managedFields as any)[key]??{})].sort();assert.deepEqual(mapped,fields,type);
 }
});
