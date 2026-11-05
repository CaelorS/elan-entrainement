import {useState} from 'react';
import type {Exercise} from '../lib/types';
import {illustrationFor,illustrationSide} from '../lib/exercise-illustrations';
import {useIllustrationGender} from './account-profile';
import {Dialog,DialogContent,DialogTitle,DialogTrigger} from './ui/dialog';

export function ExerciseMedia({ex}:{ex:Exercise}){
 const preference=useIllustrationGender(),art=illustrationFor(ex);
 const [failed,setFailed]=useState('');
 // A user-provided demonstration always has priority over the shared catalogue.
 if(ex.media)return /\.mp4(?:[?#]|$)/i.test(ex.media)?<video src={ex.media} controls playsInline aria-label={ex.nom}/>:<img src={ex.media} alt={ex.nom} loading="lazy"/>;
 if(!art)return null;
 const src=import.meta.env.BASE_URL+'exercise-illustrations-bd/'+art.file;
 if(failed===src)return null;
 const side=illustrationSide(art.id,preference);
 const picture=(large=false)=><span className={'exercise-illustration-crop '+side+(large?' enlarged':'')}><img src={src} alt={ex.nom+' · illustration '+(side==='male'?'masculine':'féminine')} loading="lazy" decoding="async" onError={()=>setFailed(src)}/></span>;
 return <figure className="exercise-illustration"><Dialog><DialogTrigger asChild><button type="button" className="exercise-illustration-open" aria-label={'Agrandir l’illustration : '+ex.nom}>{picture()}</button></DialogTrigger><DialogContent className="elan-dialog exercise-illustration-dialog" aria-describedby={undefined}><DialogTitle>{ex.nom}</DialogTitle>{picture(true)}{art.interpretation&&<p className="subtle">Illustration indicative · variante à préciser.</p>}</DialogContent></Dialog>{art.interpretation&&<figcaption>Illustration indicative · variante à préciser.</figcaption>}</figure>;
}
