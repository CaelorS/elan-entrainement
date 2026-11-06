import test from 'node:test';
import assert from 'node:assert/strict';
import {unlockAudio,scheduleCountdown,scheduleCountdowns,cancelCountdowns,stopSounds,stopVoice,announce,transitionSound,testAudio,closeAudio} from '../lib/audio.ts';

test('timer cues and voice loading survive real phase timing without duplicate or missing announcements',async()=>{
 type Node={starts:number[];stops:number[];buffer:AudioBuffer|null;frequency:{value:number};connect:()=>void;disconnect:()=>void;start:(at:number)=>void;stop:(at?:number)=>void;onended:unknown};
 const tones:Node[]=[],speech:Node[]=[];
 const node=():Node=>({starts:[],stops:[],buffer:null,frequency:{value:0},connect(){},disconnect(){},start(at){this.starts.push(at)},stop(at){this.stops.push(at??-1)},onended:null});
 let instance:Context;
 class Context {
  constructor(){instance=this} onstatechange:()=>void=()=>{};
  state='suspended';currentTime=10;destination={};resume(){this.state='running';this.onstatechange();return Promise.resolve()}
  suspend(){this.state='suspended';return Promise.resolve()}
  decodeAudioData(){return Promise.resolve({duration:2} as AudioBuffer)}
  createBufferSource(){const n=node();speech.push(n);return n}
  createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}}}
  createOscillator(){const n=node();tones.push(n);return n}
 }
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'AudioContext'),oldNow=Date.now,oldFetch=globalThis.fetch;
 const navDescriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator'),session={type:'auto'};Object.defineProperty(globalThis,'navigator',{value:{audioSession:session},configurable:true});
 Object.defineProperty(globalThis,'AudioContext',{value:Context,configurable:true});Date.now=()=>1000;
 try{
  // Even a timer scheduled while the context is being unlocked is retained.
  scheduleCountdown(11000,'rest','beeps');assert.equal(await unlockAudio(),true);assert.equal(session.type,'ambient');
  assert.deepEqual(tones.map(t=>t.starts[0]),[17,18,19]);assert.deepEqual(tones.map(t=>t.frequency.value),[750,750,750]);
  stopSounds();assert.ok(tones.every(t=>t.stops.includes(-1)));
  scheduleCountdown(11000,'finish','beeps');instance!.state='interrupted';await unlockAudio();assert.deepEqual(tones.slice(-3).map(t=>t.starts[0]),[17,18,19]);
  let count=tones.length;scheduleCountdowns([11000,11000],'beeps');assert.equal(tones.length-count,3,'simultaneous rest and filler deadlines share cues');
  count=tones.length;Date.now=()=>1050;scheduleCountdown(4000,'start','beeps');assert.equal(tones.length-count,3,'a slightly late React effect still plays the 3-second cue');assert.deepEqual(tones.slice(-3).map(t=>t.starts[0]),[10,10.95,11.95]);count=tones.length;scheduleCountdown(4000,'start','beeps');assert.equal(tones.length-count,2,'resuming the context must not replay the just-started cue');Date.now=()=>1000;
  count=tones.length;scheduleCountdown(11000,'rest','silent');assert.equal(tones.length,count);
  transitionSound('beeps');stopSounds(true);assert.ok(!tones.at(-1)!.stops.includes(-1));
  await unlockAudio(false);assert.equal(session.type,'playback');await testAudio();assert.equal(session.type,'ambient');
  let release:()=>void=()=>{};const pending=new Promise<void>(r=>release=r);let requests=0;
  globalThis.fetch=(async()=>{requests++;await pending;return {ok:true,arrayBuffer:async()=>new ArrayBuffer(1)} as Response}) as typeof fetch;
  const speaking=announce(['test-name','test-right']);assert.equal(speech.length,0,'wait for files before speaking');release();await speaking;
  assert.equal(requests,2);assert.deepEqual(speech.map(n=>Math.round(n.starts[0]*100)/100),[10,12.12],'side follows the full exercise name');
  cancelCountdowns();assert.ok(speech.every(n=>!n.stops.includes(-1)),'moving from preparation to execution must not cut off the name');
  stopVoice();assert.ok(speech.every(n=>n.stops.includes(-1)));
  const before=speech.length;const obsolete=announce(['late-file']);stopVoice();await obsolete;assert.equal(speech.length,before,'late files cannot speak an exercise that was skipped');
 }finally{closeAudio();assert.equal(session.type,'auto');globalThis.fetch=oldFetch;if(navDescriptor)Object.defineProperty(globalThis,'navigator',navDescriptor);else delete (globalThis as any).navigator;Date.now=oldNow;if(descriptor)Object.defineProperty(globalThis,'AudioContext',descriptor);else delete (globalThis as any).AudioContext}
});
