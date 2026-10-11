import {useMemo,useState} from 'react';
import type {Program,Row,Session,Task} from '../lib/types';
import {compile,localDate,uid} from '../lib/engine';
import {hasWeight,measureFor} from '../lib/activity';

export function ManualSessionForm({program,onSave,onCancel}:{program:Program;onSave:(s:Session)=>Promise<void>;onCancel:()=>void}){
 const models=program.modeles.filter(m=>!m.actif_au&&!m.archive);
 const [modelId,setModelId]=useState(models[0]?.id??''),[date,setDate]=useState(localDate()),[minutes,setMinutes]=useState(''),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [values,setValues]=useState<Record<string,{done:boolean;reps:string;load:string;duration:string;distance:string}>>({});
 const model=models.find(m=>m.id===modelId);
 const tasks=useMemo(()=>model?compile(model,program,false,new Date(date+'T12:00:00').getDay()).flatMap(t=>t.kind==='set'&&!t.approach?[t]:t.kind==='rest'?t.fillers??[]:[]):[],[model,program,date]);
 const key=(t:Task)=>`${t.entry.ordre}-${t.ex.id}-${t.index}-${t.side}-${t.step??0}`;
 const value=(t:Task)=>values[key(t)]??{done:false,reps:'',load:'',duration:'',distance:''};
 const patch=(t:Task,changes:Partial<ReturnType<typeof value>>)=>setValues(v=>({...v,[key(t)]:{...value(t),...changes}}));
 async function submit(e:React.FormEvent){e.preventDefault();if(!model||busy)return;setError('');const selected=tasks.filter(t=>value(t).done);if(!selected.length){setError('Sélectionne au moins une série réalisée.');return}
  if(!date||date>localDate()){setError('Choisis une date passée ou aujourd’hui.');return}
  const id=uid(),start=new Date(date+'T12:00:00'),duration=minutes===''?0:Number(minutes),rows:Row[]=[];
  if(!Number.isFinite(duration)||duration<0||duration>1440){setError('Vérifie la durée de la séance.');return}
  for(const t of selected){const v=value(t),measure=measureFor(t.ex,t.entry);const required=[...(hasWeight(t.ex)?[v.load]:[]),...(measure==='reps'?[v.reps]:measure==='duration'?[v.duration]:measure==='distance'?[v.distance]:[])];
   if(required.some(x=>x===''||!Number.isFinite(Number(x))||Number(x)<0)){setError('Renseigne les valeurs de chaque série cochée.');return}
   rows.push({uuid:uid(),seance_uuid:id,date,heure_debut:start.toISOString(),seance_id:model.id,exercice_id:t.ex.id,index_serie:t.index,cote:t.side,charge_kg:hasWeight(t.ex)?Number(v.load):0,charge_libelle:'',reps_prevues:t.reps,reps_faites:measure==='reps'?Number(v.reps):0,duree_s:measure==='duration'?Number(v.duration):0,distance_m:measure==='distance'?Number(v.distance):undefined,rir_ressenti:null,approche:false,valide_auto:false,mesure:measure,charge_applicable:hasWeight(t.ex),echauffement:!!t.warmup,intercalaire:!!t.entry.intercalaire_de.length});
  }
  const main=rows.filter(r=>!r.intercalaire&&!r.echauffement);
  const session:Session={seance_uuid:id,date,seance_id:model.id,seance_version:model.version,nom:model.nom,heure_debut:start.toISOString(),heure_fin:new Date(start.getTime()+duration*60000).toISOString(),duree_min:duration,duree_inconnue:minutes==='',exercices_prevus:new Set(tasks.filter(t=>!t.warmup&&!t.entry.intercalaire_de.length).map(t=>t.ex.id)).size,exercices_faits:new Set(main.map(r=>r.exercice_id)).size,volume_kg:main.reduce((n,r)=>n+r.charge_kg*r.reps_faites,0),rpe_global:null,ressenti:['Saisie après séance · heure non renseignée.',minutes===''?'Durée non renseignée.':'',note].filter(Boolean).join(' '),records:[],statut:'terminee',series:rows,retours:[]};
  setBusy(true);try{await onSave(session)}catch{setError('Enregistrement impossible. Tes saisies restent ici.')}finally{setBusy(false)}
 }
 return <form className="manual-session" onSubmit={submit}><label>Programme<select value={modelId} onChange={e=>{setModelId(e.target.value);setValues({})}}>{models.map(m=><option key={m.id} value={m.id}>{m.nom}</option>)}</select></label><div className="edit-grid"><label>Date<input type="date" required max={localDate()} value={date} onChange={e=>setDate(e.target.value)}/></label><label>Durée totale (minutes, facultatif)<input type="number" min="0" max="1440" value={minutes} onChange={e=>setMinutes(e.target.value)}/></label></div><p className="subtle">Coche les séries effectuées, puis indique tes répétitions, charges ou durées réelles.</p>
 {tasks.map(t=>{const v=value(t),measure=measureFor(t.ex,t.entry);return <div className="manual-row" key={key(t)}><label><span><input type="checkbox" checked={v.done} onChange={e=>patch(t,{done:e.target.checked})}/> {t.ex.nom} · {t.index}{t.side!=='bilateral'?' · '+t.side:''}{t.entry.intercalaire_de.length?' · intercalaire':''}</span></label>{v.done&&<div className="edit-grid">{hasWeight(t.ex)&&<label>Charge (kg{t.ex.type_charge==='halteres'?' par haltère':''})<input required type="number" min="0" max="2000" step="0.1" value={v.load} onChange={e=>patch(t,{load:e.target.value})}/></label>}{measure==='reps'&&<label>Répétitions<input required type="number" min="0" max="1000" step="0.5" value={v.reps} onChange={e=>patch(t,{reps:e.target.value})}/></label>}{measure==='duration'&&<label>Durée (secondes)<input required type="number" min="0" max="86400" value={v.duration} onChange={e=>patch(t,{duration:e.target.value})}/></label>}{measure==='distance'&&<label>Distance (m)<input required type="number" min="0" max="50000" step="0.1" value={v.distance} onChange={e=>patch(t,{distance:e.target.value})}/></label>}</div>}</div>})}
 <label>Notes (facultatif)<textarea value={note} maxLength={1000} onChange={e=>setNote(e.target.value)}/></label>{error&&<p role="alert" className="auth-error">{error}</p>}<button className="primary" disabled={busy||!model}>{busy?'Enregistrement…':'Enregistrer la séance'}</button><button className="text-button" type="button" disabled={busy} onClick={onCancel}>Annuler</button></form>;
}
