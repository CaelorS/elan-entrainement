import {useLayoutEffect,useRef,useState} from 'react';
import type {Exercise} from '../lib/types';
import {illustrationFor,illustrationSide} from '../lib/exercise-illustrations';
import {useIllustrationGender} from './account-profile';
import {Dialog,DialogContent,DialogTitle,DialogTrigger} from './ui/dialog';

export function ExerciseMedia({ex}:{ex:Exercise}){
 const preference=useIllustrationGender(),art=illustrationFor(ex);
 const figure=useRef<HTMLElement>(null);
 const [failed,setFailed]=useState('');
 useLayoutEffect(()=>{
  const element=figure.current,tunnel=element?.closest('.tunnel');if(!element||!tunnel)return;
  let frame=0;
  const fit=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
   const action=tunnel.querySelector('.workout-action');if(!action)return;
   // Measure against the top of the page, so scrolling never changes the image size.
   const available=action.getBoundingClientRect().top-(element.getBoundingClientRect().top+window.scrollY)-12;
   element.style.setProperty('--workout-art-size',Math.max(96,Math.min(300,available))+'px');
  })};
  const observer=new ResizeObserver(fit);observer.observe(tunnel);observer.observe(document.querySelector('.topbar')!);
  window.addEventListener('resize',fit);window.visualViewport?.addEventListener('resize',fit);fit();
  return()=>{cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('resize',fit);window.visualViewport?.removeEventListener('resize',fit)};
 },[ex.id,ex.media,preference]);
 // A user-provided demonstration always has priority over the shared catalogue.
 if(ex.media)return /\.mp4(?:[?#]|$)/i.test(ex.media)?<video src={ex.media} controls playsInline aria-label={ex.nom}/>:<img src={ex.media} alt={ex.nom} loading="lazy"/>;
 if(!art)return null;
 const src=import.meta.env.BASE_URL+'exercise-illustrations-bd/'+art.file;
 if(failed===src)return null;
 const side=illustrationSide(art.id,preference);
 const picture=(large=false)=><span className={'exercise-illustration-crop '+side+(large?' enlarged':'')}><img src={src} alt={ex.nom+' · illustration '+(side==='male'?'masculine':'féminine')} loading="lazy" decoding="async" onError={()=>setFailed(src)}/></span>;
 return <figure ref={figure} className="exercise-illustration"><Dialog><DialogTrigger asChild><button type="button" className="exercise-illustration-open" aria-label={'Agrandir l’illustration : '+ex.nom}>{picture()}</button></DialogTrigger><DialogContent className="elan-dialog exercise-illustration-dialog" aria-describedby={undefined}><DialogTitle>{ex.nom}</DialogTitle>{picture(true)}{art.interpretation&&<p className="subtle">Illustration indicative · variante à préciser.</p>}</DialogContent></Dialog>{art.interpretation&&<figcaption>Illustration indicative · variante à préciser.</figcaption>}</figure>;
}
