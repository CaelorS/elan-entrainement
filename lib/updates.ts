import {useEffect,useRef,useState} from 'react';
// All open windows must save their state and approve before a worker takes over.
export function useAppUpdates(safe:boolean,flush:()=>Promise<void>,enabled=true){
 const safeRef=useRef(safe);safeRef.current=safe;
 const flushRef=useRef(flush);flushRef.current=flush;
 const [waiting,setWaiting]=useState<ServiceWorker|null>(null);
 useEffect(()=>{
  if(!enabled||!('serviceWorker' in navigator)||import.meta.env.DEV)return;
  let live=true,registration:ServiceWorkerRegistration|undefined,reloading=false;
  let hadController=!!navigator.serviceWorker.controller;
  const controller=()=>{if(!hadController){hadController=true;return}if(!reloading){reloading=true;location.reload()}};
  const message=async(event:MessageEvent)=>{if(event.data?.type==='PREPARE_UPDATE'){let ok=safeRef.current;try{if(ok)await flushRef.current()}catch{ok=false}event.source?.postMessage({type:'UPDATE_READY',requestId:event.data.requestId,safe:ok&&safeRef.current});}};
  const check=()=>{if(document.visibilityState==='visible')void registration?.update().catch(()=>{})};
  const discover=()=>{if(live)setWaiting(registration?.waiting??null)};
  navigator.serviceWorker.addEventListener('message',message);
  navigator.serviceWorker.addEventListener('controllerchange',controller);
  void navigator.serviceWorker.register(import.meta.env.BASE_URL+'sw.js',{scope:import.meta.env.BASE_URL,updateViaCache:'none'}).then(r=>{
   if(!live)return;registration=r;discover();r.addEventListener('updatefound',()=>{r.installing?.addEventListener('statechange',discover)});
  }).catch(()=>{});
  const interval=setInterval(check,60000);window.addEventListener('online',check);document.addEventListener('visibilitychange',check);
  return()=>{live=false;clearInterval(interval);window.removeEventListener('online',check);document.removeEventListener('visibilitychange',check);navigator.serviceWorker.removeEventListener('message',message);navigator.serviceWorker.removeEventListener('controllerchange',controller)};
 },[enabled]);
 useEffect(()=>{if(!enabled||!waiting||!safe)return;const id=setTimeout(()=>waiting.postMessage({type:'REQUEST_UPDATE'}),5000);return()=>clearTimeout(id)},[waiting,safe,enabled]);
 return !!waiting;
}
