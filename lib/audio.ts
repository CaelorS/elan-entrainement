let context:AudioContext|null=null;
let nodes:{node:AudioScheduledSourceNode;at:number;tone:boolean}[]=[];
const buffers=new Map<string,AudioBuffer>();
// Mix cues with music from other apps; never claim exclusive playback.
function playbackSession(type:'ambient'|'auto'){
 try{const session=(navigator as Navigator & {audioSession?:{type:string}}).audioSession;if(session)session.type=type}catch{}
}
let countdown:{deadline:number;kind:'start'|'finish'|'rest';audio:string}|null=null;
export async function unlockAudio():Promise<boolean>{
 try{
  playbackSession('ambient');
  if(!context||context.state==='closed'){
   context=new AudioContext();
   context.onstatechange=()=>{if(context?.state==='running'&&countdown){const c=countdown;scheduleCountdown(c.deadline,c.kind,c.audio)}};
  }
  await context.resume();
  if(context.state!=='running')return false;
  return true;
 }catch{return false}
}
export async function testAudio(){const ready=await unlockAudio();if(ready&&context){beep(context.currentTime,750,.12);beep(context.currentTime+.3,1200,.25)}return ready}
export async function preloadAudio(ids:string[]){if(!context)return;await Promise.allSettled(ids.map(async id=>{if(buffers.has(id))return;const r=await fetch(import.meta.env.BASE_URL+'audio/'+id+'.m4a');if(r.ok)buffers.set(id,await context!.decodeAudioData(await r.arrayBuffer()))}))}
export function stopSounds(preserveStarted=false){countdown=null;for(const n of nodes){if(preserveStarted&&n.tone&&n.at<=(context?.currentTime??0))continue;try{n.node.stop()}catch{}}nodes=[]}
function beep(at:number,hz=800,duration=.08){if(!context)return;const o=context.createOscillator(),g=context.createGain();o.frequency.value=hz;g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(.12,at+.005);g.gain.exponentialRampToValueAtTime(.0001,at+duration);o.connect(g);g.connect(context.destination);o.start(at);o.stop(at+duration+.02);nodes.push({node:o,at,tone:true});o.onended=()=>{o.disconnect();g.disconnect();nodes=nodes.filter(n=>n.node!==o)}}
export function voice(id:string,delay=0){if(!context||!buffers.has(id))return;const s=context.createBufferSource(),at=context.currentTime+delay;s.buffer=buffers.get(id)!;s.connect(context.destination);s.start(at);nodes.push({node:s,at,tone:false});s.onended=()=>{s.disconnect();nodes=nodes.filter(n=>n.node!==s)}}
export function transitionSound(audio:string){if(audio!=='silent'&&context)beep(context.currentTime,1200,.25)}
export function scheduleCountdown(deadline:number,kind:'start'|'finish'|'rest',audio:string){stopSounds(true);if(audio==='silent'||!context)return;countdown={deadline,kind,audio};const remaining=Math.max(0,(deadline-Date.now())/1000),base=context.currentTime;for(let s=Math.min(3,Math.floor(remaining));s>0;s--)beep(base+remaining-s,750);if(remaining>0)beep(base+remaining,1200,.25)}
export function closeAudio(){stopSounds();void context?.suspend().catch(()=>{});playbackSession('ambient')}
