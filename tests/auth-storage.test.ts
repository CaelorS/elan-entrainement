import test from 'node:test';import assert from 'node:assert/strict';
import {createAuthStorage} from '../lib/auth-storage.ts';
const store=()=>{const m=new Map<string,string>();return {getItem:(k:string)=>m.get(k)??null,setItem:(k:string,v:string)=>{m.set(k,v)},removeItem:(k:string)=>{m.delete(k)}}};
test('remembered login survives a new tab; session-only login does not fall back to persistent tokens or offline identity',()=>{
 const local=store(),tab=store(),key='sb-test-auth-token';let auth=createAuthStorage(local,tab,key);
 auth.setItem(key,'persistent');auth.identityStorage().setItem('elan-offline-account','identity');
 assert.equal(createAuthStorage(local,store(),key).getItem(key),'persistent');
 local.setItem('unrelated','keep');auth.configure(false);auth.setItem(key,'temporary');auth.identityStorage().setItem('elan-offline-account','temporary-id');
 assert.equal(local.getItem(key),null);assert.equal(local.getItem('elan-offline-account'),null);assert.equal(local.getItem('unrelated'),'keep');
 auth=createAuthStorage(local,tab,key);assert.equal(auth.getItem(key),'temporary');assert.equal(auth.identityStorage().getItem('elan-offline-account'),'temporary-id');
 const fresh=createAuthStorage(local,store(),key);assert.equal(fresh.getItem(key),null);assert.equal(fresh.identityStorage().getItem('elan-offline-account'),null);
 auth.removeItem(key);auth.clearIdentity();assert.equal(tab.getItem(key),null);assert.equal(tab.getItem('elan-offline-account'),null);
 auth.configure(true);auth.setItem(key,'remembered-again');assert.equal(local.getItem(key),'remembered-again');assert.equal(tab.getItem(key),null);
});
