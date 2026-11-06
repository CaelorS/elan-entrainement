let context:AudioContext|null=null;
let nodes:{node:AudioScheduledSourceNode;at:number;tone:boolean}[]=[];
const buffers=new Map<string,AudioBuffer>();
const loading=new Map<string,Promise<void>>();
let voiceGeneration=0;
let countdowns:{deadlines:number[];audio:string}|null=null;
// Ambient preserves other apps' music and follows the iPhone silent switch.
function playbackSession(type:'playback'|'ambient'|'auto'){
 try{const session=(navigator as Navigator & {audioSession?:{type:string}}).audioSession;if(session)session.type=type}catch{}
}
export async function unlockAudio(mixWithMusic=true):Promise<boolean>{
 try{
  playbackSession(mixWithMusic?'ambient':'playback');
  if(!context||context.state==='closed'){
   context=new AudioContext();
   context.onstatechange=()=>{if(context?.state==='running'&&countdowns){const c=countdowns;scheduleCountdowns(c.deadlines,c.audio)}};
  }
  await context.resume();return context.state==='running';
 }catch{return false}
}
export async function testAudio(mixWithMusic=true){const ready=await unlockAudio(mixWithMusic);if(ready&&context){beep(context.currentTime,750,.12);beep(context.currentTime+.3,1200,.25)}return ready}
async function loadAudio(id:string){
 if(!context||buffers.has(id))return;
 if(loading.has(id))return loading.get(id);
 const audioContext=context;
 const pending=(async()=>{const response=await fetch((import.meta.env?.BASE_URL??'/elan-entrainement/')+'audio/'+id+'.m4a');if(!response.ok)throw Error('Audio unavailable');const buffer=await audioContext.decodeAudioData(await response.arrayBuffer());buffers.set(id,buffer)})();
 loading.set(id,pending);try{await pending}finally{loading.delete(id)}
}
export async function preloadAudio(ids:string[]){await Promise.allSettled([...new Set(ids)].map(loadAudio))}
function stopNodes(tone:boolean,preserveStarted=false){
 const keep=(n:typeof nodes[number])=>n.tone!==tone||preserveStarted&&n.tone&&n.at<=(context?.currentTime??0)+.12;
 for(const n of nodes)if(!keep(n)){try{n.node.stop()}catch{}}
 nodes=nodes.filter(keep);
}
export function cancelCountdowns(preserveStarted=false){countdowns=null;stopNodes(true,preserveStarted)}
export function stopVoice(){voiceGeneration++;stopNodes(false);if(typeof speechSynthesis!=='undefined')speechSynthesis.cancel()}
export function stopSounds(preserveStarted=false){cancelCountdowns(preserveStarted);stopVoice()}
function beep(at:number,hz=800,duration=.14){if(!context)return;const o=context.createOscillator(),g=context.createGain();o.frequency.value=hz;g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(.32,at+.01);g.gain.exponentialRampToValueAtTime(.0001,at+duration);o.connect(g);g.connect(context.destination);o.start(at);o.stop(at+duration+.02);nodes.push({node:o,at,tone:true});o.onended=()=>{o.disconnect();g.disconnect();nodes=nodes.filter(n=>n.node!==o)}}
/** Load before speaking, then append the side after the actual name duration. */
export async function announce(clips:string[],fallbackText?:string,delay=0){
 stopVoice();const generation=voiceGeneration;
 await preloadAudio(clips);
 if(generation!==voiceGeneration)return;
 if(!clips.length||clips.some(id=>!buffers.has(id))){
  if(fallbackText&&typeof speechSynthesis!=='undefined'){const utterance=new SpeechSynthesisUtterance(fallbackText);utterance.lang='fr-FR';utterance.rate=.95;speechSynthesis.speak(utterance)}return;
 }
 if(!context)return;
 if(context.state!=='running'){try{await context.resume()}catch{return}}
 if(generation!==voiceGeneration||context.state!=='running')return;
 let at=context.currentTime+delay;
 for(const id of clips){const s=context.createBufferSource();s.buffer=buffers.get(id)!;s.connect(context.destination);s.start(at);nodes.push({node:s,at,tone:false});at+=s.buffer.duration+.12;s.onended=()=>{s.disconnect();nodes=nodes.filter(n=>n.node!==s)}}
}
export function voice(id:string,delay=0){return announce([id],undefined,delay)}
export function transitionSound(audio:string){if(audio!=='silent'&&context)beep(context.currentTime,1200,.25)}
/** Three cues at 3, 2 and 1 seconds. Nearby deadlines share a cue. */
export function scheduleCountdowns(deadlines:number[],audio:string){
 stopNodes(true,true);countdowns=audio==='silent'?null:{deadlines:[...deadlines],audio};
 if(audio==='silent'||!context)return;
 const now=Date.now(),base=context.currentTime,at:number[]=[];
 for(const deadline of deadlines){if(deadline<=now)continue;for(const seconds of [3,2,1]){const delay=(deadline-now)/1000-seconds;if(delay>=-.12){const time=base+Math.max(0,delay);if(!at.some(existing=>Math.abs(existing-time)<.1))at.push(time)}}}
 for(const time of at.sort((a,b)=>a-b))if(!nodes.some(n=>n.tone&&Math.abs(n.at-time)<.1))beep(time,750);
}
export function scheduleCountdown(deadline:number,_kind:'start'|'finish'|'rest',audio:string){scheduleCountdowns([deadline],audio)}
export function closeAudio(){stopSounds();void context?.suspend().catch(()=>{});playbackSession('auto')}
