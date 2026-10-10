import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const script=await readFile(new URL('../public/sw.js',import.meta.url),'utf8');
test('a PWA update waits for every window, and never activates while a workout is active',async()=>{
 const handlers:Record<string,Function>={},sent:any[]=[];let skipped=0;
 const self={location:{href:'https://example.org/elan-entrainement/sw.js',origin:'https://example.org'},addEventListener:(event:string,handler:Function)=>handlers[event]=handler,skipWaiting:async()=>{skipped++},clients:{matchAll:async()=>['one','two'].map(id=>({id,url:'https://example.org/elan-entrainement/',postMessage:(message:unknown)=>sent.push({id,message})})),claim:async()=>{}}};
 vm.runInNewContext(script,{self,URL,crypto:{randomUUID:()=>String(sent.length)},caches:{open:async()=>({addAll:async()=>{}})}});
 async function dispatch(event:string,data:any){const pending:Promise<unknown>[]=[];handlers[event]({...data,waitUntil:(p:Promise<unknown>)=>pending.push(p)});await Promise.all(pending)}
 await dispatch('install',{});assert.equal(skipped,0);
 await dispatch('message',{data:{type:'REQUEST_UPDATE'}});let requestId=sent[0].message.requestId;
 await dispatch('message',{source:{id:'one'},data:{type:'UPDATE_READY',requestId,safe:true}});assert.equal(skipped,0);
 await dispatch('message',{source:{id:'two'},data:{type:'UPDATE_READY',requestId,safe:false}});assert.equal(skipped,0);
 await dispatch('message',{data:{type:'REQUEST_UPDATE'}});requestId=sent[2].message.requestId;
 for(const id of ['one','two'])await dispatch('message',{source:{id},data:{type:'UPDATE_READY',requestId,safe:true}});
 assert.equal(skipped,1);
 let intercepted=false;handlers.fetch({request:{url:'https://example.supabase.co/rest/v1/elan_programs',method:'GET'},respondWith:()=>{intercepted=true}});assert.equal(intercepted,false);
});
