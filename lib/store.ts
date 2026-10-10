import {supabase} from './supabase.ts';
import type {LocalData,Program,Session,RunLog} from './types';
const EMPTY:Program={catalogue:[],modeles:[]};
export type CloudResult={program:Program|null;revision:number;conflict:boolean;sessions:Session[];runs:RunLog[]};
export class ProgramConflict extends Error { remote:CloudResult;constructor(remote:CloudResult){super('Ton programme a aussi été modifié sur un autre appareil. Choisis la version à conserver dans les réglages.');this.remote=remote} }
let dbPromise:Promise<IDBDatabase>|null=null;
function db(){if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{const r=indexedDB.open('elan-training-cloud',1);r.onupgradeneeded=()=>r.result.createObjectStore('data');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});return dbPromise}
export class TrainingStore {
 private writes=Promise.resolve();
 readonly userId:string;
 constructor(userId:string,privateClient=supabase){this.userId=userId;this.client=privateClient}
 private client:typeof supabase;
 async load():Promise<LocalData>{const d=await db();const saved=await new Promise<LocalData|undefined>((res,rej)=>{const r=d.transaction('data').objectStore('data').get(this.userId);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});return saved??{program:EMPTY,sessions:[],running:null,runs:[],settings:{audio:'beeps',barKg:20,reduced:false,sheetsUrl:''},pending:[],lastSync:null,programRevision:0};}
 persist(data:LocalData){const snapshot=structuredClone(data);this.writes=this.writes.catch(()=>{}).then(async()=>{const d=await db();await new Promise<void>((res,rej)=>{const tx=d.transaction('data','readwrite');tx.objectStore('data').put(snapshot,this.userId);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error??new Error('Sauvegarde interrompue'))})});return this.writes}
 async flush(){await this.writes}
 async sync(local:LocalData){
  const {data:{session}}=await this.client.auth.getSession();if(session?.user.id!==this.userId)throw Error('Reconnecte-toi pour synchroniser.');
  const ids=[...local.pending];
  const {data,error}=await this.client.rpc('elan_sync',{p_program:ids.includes('program')?local.program:null,p_revision:local.programRevision??0,p_sessions:local.sessions.filter(s=>ids.includes(s.seance_uuid)),p_runs:local.runs.filter(r=>ids.includes(r.uuid))}).abortSignal(AbortSignal.timeout(20000));
  if(error)throw Error(error.code==='PGRST202'?'La base Supabase doit encore être initialisée avec le fichier schema.sql.':error.message);
  const remote=data as CloudResult;
  if(remote.conflict)throw new ProgramConflict(remote);
  return {data:{...local,program:remote.program??local.program,programRevision:remote.revision,sessions:remote.sessions,runs:remote.runs,pending:local.pending.filter(id=>!ids.includes(id)),lastSync:Date.now()},sheets:false};
 }
}
import {rowMeasure,rowDistance} from './activity.ts';
export function download(name:string,content:string,type='application/json'){const u=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
export function exportCSV(sessions:Session[]){const rows=sessions.flatMap(s=>s.series);const columns=['uuid','seance_uuid','date','heure_debut','seance_id','exercice_id','index_serie','cote','charge_kg','charge_libelle','reps_prevues','reps_faites','duree_s','rir_ressenti','approche','valide_auto','mesure','distance_m','charge_applicable','intercalaire','echauffement'];const quote=(x:unknown)=>'"'+String(x??'').replaceAll('"','""')+'"';download('elan-series.csv','\uFEFF'+[columns.join(';'),...rows.map(r=>columns.map(k=>quote(k==='mesure'?rowMeasure(r):k==='distance_m'?(rowMeasure(r)==='distance'?rowDistance(r):''):['reps_prevues','reps_faites'].includes(k)&&rowMeasure(r)!=='reps'?'':k==='charge_kg'&&(r.charge_applicable===false||r.charge_applicable===undefined&&r.charge_kg===0)?'':r[k as keyof typeof r])).join(';'))].join('\n'),'text/csv;charset=utf-8')}
