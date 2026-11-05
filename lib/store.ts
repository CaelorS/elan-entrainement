import {supabase} from './supabase.ts';
import type {LocalData,Program,Session,RunLog,Exercise} from './types';
// JSONB can reorder object keys; compare values, not their serialized key order.
function canonical(value:unknown):string{return JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)}
const EMPTY:Program={catalogue:[],modeles:[]};
export type CloudResult={deleted_sessions?:string[];catalogue?:Exercise[];program:Program|null;revision:number;conflict:boolean;sessions:Session[];runs:RunLog[]};
// Keep account-specific definitions; add missing shared exercises without replacing the programme.
export function mergeCatalogue(program:Program,catalogue:Exercise[]):Program {
 const own=new Set(program.catalogue.map(e=>e.id));
 return {...program,catalogue:[...program.catalogue,...catalogue.filter(e=>!own.has(e.id))]};
}
export class ProgramConflict extends Error { remote:CloudResult;constructor(remote:CloudResult){super('Ton programme a aussi été modifié sur un autre appareil. Choisis la version à conserver dans les réglages.');this.remote=remote} }
let dbPromise:Promise<IDBDatabase>|null=null;
function db(){if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{const r=indexedDB.open('elan-training-cloud',1);r.onupgradeneeded=()=>r.result.createObjectStore('data');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});return dbPromise}
export class TrainingStore {
 private writes=Promise.resolve();
 readonly userId:string;
 constructor(userId:string,privateClient=supabase){this.userId=userId;this.client=privateClient}
 private client:typeof supabase;
 private journalKey(){return 'elan-completed:'+this.userId}
 private journal():Session[]{try{return JSON.parse(localStorage.getItem(this.journalKey())??'[]')}catch{return []}}
 private recover(data:LocalData):LocalData{
  const sessions=new Map(data.sessions.map(s=>[s.seance_uuid,s]));
  const entries=this.journal().filter(s=>!data.deletedSessions?.includes(s.seance_uuid));
  for(const s of entries)if(!sessions.has(s.seance_uuid))sessions.set(s.seance_uuid,s);
  let running=data.running&&sessions.has(data.running.uuid)?null:data.running;
  try{const checkpoint=JSON.parse(localStorage.getItem('elan-bilan:'+this.userId)??'null');if(checkpoint?.phase==='BILAN'&&running?.uuid===checkpoint.uuid)running=checkpoint}catch{}
  return {...data,running,sessions:[...sessions.values()],pending:[...new Set([...data.pending,...entries.map(s=>s.seance_uuid)])]};
 }
 persistCompleted(data:LocalData,session:Session){
  let journalSaved=false;
  try{localStorage.setItem(this.journalKey(),JSON.stringify([...this.journal().filter(s=>s.seance_uuid!==session.seance_uuid),session]));journalSaved=true}catch{}
  return this.persist(data).catch(error=>{if(!journalSaved)throw error});
 }
 async load():Promise<LocalData>{const d=await db();const saved=await new Promise<LocalData|undefined>((res,rej)=>{const r=d.transaction('data').objectStore('data').get(this.userId);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});return this.recover(saved??{program:EMPTY,sessions:[],running:null,runs:[],settings:{audio:'beeps',barKg:20,reduced:false,sheetsUrl:''},pending:[],lastSync:null,programRevision:0});}
 persist(data:LocalData){try{const entries=this.journal().filter(s=>!data.deletedSessions?.includes(s.seance_uuid)).map(s=>data.sessions.find(current=>current.seance_uuid===s.seance_uuid)??s);if(entries.length||this.journal().length)localStorage.setItem(this.journalKey(),JSON.stringify(entries))}catch{}try{if(data.running?.phase==='BILAN')localStorage.setItem('elan-bilan:'+this.userId,JSON.stringify(data.running));else if(!data.running)localStorage.removeItem('elan-bilan:'+this.userId)}catch{}const snapshot=structuredClone(this.recover(data));this.writes=this.writes.catch(()=>{}).then(async()=>{const d=await db();await new Promise<void>((res,rej)=>{const tx=d.transaction('data','readwrite');const timer=setTimeout(()=>{try{tx.abort()}catch{}rej(new Error('Délai de sauvegarde dépassé'))},8000);tx.objectStore('data').put(snapshot,this.userId);tx.oncomplete=()=>{clearTimeout(timer);res()};tx.onerror=()=>{clearTimeout(timer);rej(tx.error)};tx.onabort=()=>{clearTimeout(timer);rej(tx.error??new Error('Sauvegarde interrompue'))}})});return this.writes}
 async flush(){await this.writes}
 async sync(local:LocalData){
  const {data:{session}}=await this.client.auth.getSession();if(session?.user.id!==this.userId)throw Error('Reconnecte-toi pour synchroniser.');
  const ids=[...local.pending];
  const {data,error}=await this.client.rpc('elan_sync',{p_program:ids.includes('program')?local.program:null,p_revision:local.programRevision??0,p_sessions:[...local.sessions.filter(s=>ids.includes(s.seance_uuid)&&!local.deletedSessions?.includes(s.seance_uuid)),...(local.deletedSessions??[]).filter(id=>ids.includes(id)).map(id=>({seance_uuid:id,series:[],_deleted:true}))],p_runs:local.runs.filter(r=>ids.includes(r.uuid))}).abortSignal(AbortSignal.timeout(20000));
  if(error)throw Error(error.code==='PGRST202'?'La base Supabase doit encore être initialisée avec le fichier schema.sql.':error.message);
  const remote=data as CloudResult;
  if(remote.conflict)throw new ProgramConflict(remote);
  try{const acknowledged=new Map(remote.sessions.filter(s=>canonical(s)===canonical(local.sessions.find(x=>x.seance_uuid===s.seance_uuid))).map(s=>[s.seance_uuid,s]));localStorage.setItem(this.journalKey(),JSON.stringify(this.journal().filter(s=>!ids.includes(s.seance_uuid)||canonical(s)!==canonical(acknowledged.get(s.seance_uuid)))))}catch{}
  return {data:{...local,program:mergeCatalogue(remote.program??local.program,remote.catalogue??[]),programRevision:remote.revision,deletedSessions:[...new Set([...(local.deletedSessions??[]),...(remote.deleted_sessions??[])])],sessions:remote.sessions.filter(s=>!local.deletedSessions?.includes(s.seance_uuid)),runs:remote.runs,pending:local.pending.filter(id=>!ids.includes(id)),lastSync:Date.now()},sheets:false};
 }
}
import {rowMeasure,rowDistance} from './activity.ts';
export function download(name:string,content:string,type='application/json'){const u=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
export function exportCSV(sessions:Session[]){const rows=sessions.flatMap(s=>s.series);const columns=['uuid','seance_uuid','date','heure_debut','seance_id','exercice_id','index_serie','cote','charge_kg','charge_libelle','reps_prevues','reps_faites','duree_s','rir_ressenti','angle_deg','approche','valide_auto','mesure','distance_m','charge_applicable','intercalaire','echauffement','commentaire'];const quote=(x:unknown)=>'"'+String(x??'').replaceAll('"','""')+'"';download('elan-series.csv','\uFEFF'+[columns.join(';'),...rows.map(r=>columns.map(k=>quote(k==='mesure'?rowMeasure(r):k==='distance_m'?(rowMeasure(r)==='distance'?rowDistance(r):''):['reps_prevues','reps_faites'].includes(k)&&rowMeasure(r)!=='reps'?'':k==='charge_kg'&&(r.charge_applicable===false||r.charge_applicable===undefined&&r.charge_kg===0)?'':r[k as keyof typeof r])).join(';'))].join('\n'),'text/csv;charset=utf-8')}
