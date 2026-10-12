import test from 'node:test';
import assert from 'node:assert/strict';
import {unlockAudio,scheduleCountdown,stopSounds,transitionSound,testAudio,closeAudio} from '../lib/audio.ts';

test('rest audio schedules 3, 2, 1 and a distinct start tone; pause cancels pending tones',async()=>{
 const tones:{frequency:{value:number};starts:number[];stops:number[];connect:()=>void;disconnect:()=>void;start:(at:number)=>void;stop:(at?:number)=>void;onended:unknown}[]=[];
 let instance:Context;
 class Context {
  constructor(){instance=this} onstatechange:()=>void=()=>{};
  state='suspended';currentTime=10;sampleRate=100;destination={};resume(){this.state='running';this.onstatechange();return Promise.resolve()}
  suspend(){this.state='suspended';return Promise.resolve()} createBuffer(){return {}} createBufferSource(){return {connect(){},start(){},stop(){}}}
  createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}}}
  createOscillator(){const tone={frequency:{value:0},starts:[] as number[],stops:[] as number[],connect(){},disconnect(){},start(at:number){this.starts.push(at)},stop(at?:number){this.stops.push(at??-1)},onended:null as unknown};tones.push(tone);return tone}
 }
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'AudioContext'),oldNow=Date.now;
 const navDescriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator'),session={type:'auto'};Object.defineProperty(globalThis,'navigator',{value:{audioSession:session},configurable:true});
 Object.defineProperty(globalThis,'AudioContext',{value:Context,configurable:true});Date.now=()=>1000;
 try{
  assert.equal(await unlockAudio(),true);assert.equal(session.type,'ambient');scheduleCountdown(11000,'rest','beeps');
  assert.deepEqual(tones.map(t=>t.starts[0]),[17,18,19,20]);
  assert.deepEqual(tones.map(t=>t.frequency.value),[750,750,750,1200]);
  stopSounds();assert.ok(tones.every(t=>t.stops.includes(-1)));
  scheduleCountdown(11000,'rest','beeps');instance!.state='interrupted';await unlockAudio();assert.deepEqual(tones.slice(-4).map(t=>t.starts[0]),[17,18,19,20]);
  const count=tones.length;scheduleCountdown(11000,'rest','silent');assert.equal(tones.length,count);
  transitionSound('beeps');assert.equal(tones.at(-1)!.starts[0],10);
  stopSounds(true);assert.ok(!tones.at(-1)!.stops.includes(-1),'phase transition must not cut off the finish tone');
 assert.equal(await testAudio(),true);assert.deepEqual(tones.slice(-2).map(t=>t.frequency.value),[750,1200]);
 }finally{closeAudio();assert.equal(session.type,'ambient');if(navDescriptor)Object.defineProperty(globalThis,'navigator',navDescriptor);else delete (globalThis as any).navigator;Date.now=oldNow;if(descriptor)Object.defineProperty(globalThis,'AudioContext',descriptor);else delete (globalThis as any).AudioContext}
});
