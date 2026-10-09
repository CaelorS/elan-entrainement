import test from 'node:test';
import assert from 'node:assert/strict';
import {unlockAudio,scheduleCountdown,stopSounds,transitionSound,closeAudio} from '../lib/audio.ts';

test('rest audio schedules 3, 2, 1 and a distinct start tone; pause cancels pending tones',async()=>{
 const tones:{frequency:{value:number};starts:number[];stops:number[];connect:()=>void;disconnect:()=>void;start:(at:number)=>void;stop:(at?:number)=>void;onended:unknown}[]=[];
 class Context {
  currentTime=10;sampleRate=100;destination={};resume(){return Promise.resolve()}
  createBuffer(){return {}} createBufferSource(){return {connect(){},start(){},stop(){}}}
  createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}}}
  createOscillator(){const tone={frequency:{value:0},starts:[] as number[],stops:[] as number[],connect(){},disconnect(){},start(at:number){this.starts.push(at)},stop(at?:number){this.stops.push(at??-1)},onended:null as unknown};tones.push(tone);return tone}
 }
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'AudioContext'),oldNow=Date.now;
 Object.defineProperty(globalThis,'AudioContext',{value:Context,configurable:true});Date.now=()=>1000;
 try{
  await unlockAudio();scheduleCountdown(11000,'rest','beeps');
  assert.deepEqual(tones.map(t=>t.starts[0]),[17,18,19,20]);
  assert.deepEqual(tones.map(t=>t.frequency.value),[750,750,750,1200]);
  stopSounds();assert.ok(tones.every(t=>t.stops.includes(-1)));
  const count=tones.length;scheduleCountdown(11000,'rest','silent');assert.equal(tones.length,count);
  transitionSound('beeps');assert.equal(tones.at(-1)!.starts[0],10);
  stopSounds(true);assert.ok(!tones.at(-1)!.stops.includes(-1),'phase transition must not cut off the finish tone');
 }finally{closeAudio();Date.now=oldNow;if(descriptor)Object.defineProperty(globalThis,'AudioContext',descriptor);else delete (globalThis as any).AudioContext}
});
