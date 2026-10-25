import {useState} from 'react';
import {Copy,ExternalLink,Send} from 'lucide-react';
import type {Exercise,Session} from '../lib/types';
import {coachSummary} from '../lib/coach-summary';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from './ui/dialog';
import './coach-share.css';
export function CoachShare({getSession,catalogue}:{getSession:()=>Session;catalogue:Exercise[]}){
 const [text,setText]=useState<string|null>(null);
 const [copied,setCopied]=useState(false);
 const [failed,setFailed]=useState(false);
 const [busy,setBusy]=useState(false);
 async function copy(){if(text===null)return;setBusy(true);try{await navigator.clipboard.writeText(text);setCopied(true);setFailed(false)}catch{setCopied(false);setFailed(true)}finally{setBusy(false)}}
 return <><button type="button" className="secondary copy-session coach-share-trigger" onClick={()=>{setCopied(false);setFailed(false);setText(coachSummary(getSession(),catalogue))}}><Send size={18}/> Envoyer à mon coach IA</button>
 <Dialog open={text!==null} onOpenChange={open=>!open&&setText(null)}><DialogContent viewportCentered className="elan-dialog coach-share-dialog">
 <DialogHeader><DialogTitle>Envoyer à mon coach IA</DialogTitle><DialogDescription>Copie le bilan, puis ouvre ton coach et colle-le dans la conversation de ton choix.</DialogDescription></DialogHeader>
 <textarea className="csv-fallback coach-summary-preview" aria-label="Bilan à envoyer au coach IA" readOnly value={text??''} onFocus={e=>e.currentTarget.select()}/>
 <button type="button" className="primary" disabled={busy} onClick={()=>void copy()}><Copy size={18}/>{copied?'Copier à nouveau':'Copier le bilan'}</button>
 <p className="subtle coach-share-status" role="status" aria-live="polite">{failed?'La copie automatique est bloquée. Sélectionne le bilan ci-dessus et choisis Copier.':copied?'Bilan copié. Ouvre ton coach, colle le texte et envoie ton message.':'Le bilan contient tes séries, tes charges et tes ressentis.'}</p>
 <div className="coach-share-destinations"><a className="secondary" href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer"><ExternalLink size={17}/> Ouvrir ChatGPT</a><a className="secondary" href="https://claude.ai/" target="_blank" rel="noopener noreferrer"><ExternalLink size={17}/> Ouvrir Claude</a></div>
 </DialogContent></Dialog></>;
}
