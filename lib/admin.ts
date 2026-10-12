import {supabase} from './supabase.ts';
import {TrainingStore,mergeCatalogue,type CloudResult} from './store.ts';
import type {LocalData} from './types';
export type AdminUser={id:string;email:string};
export async function adminUsers():Promise<AdminUser[]>{
 const {data,error}=await supabase.rpc('elan_admin_users');if(error)throw Error('Accès administrateur indisponible.');return data;
}
export async function adminSnapshot(id:string):Promise<CloudResult>{
 const {data,error}=await supabase.rpc('elan_admin_view',{p_user_id:id});if(error)throw Error('Impossible d’ouvrir cet espace. Vérifie ta connexion et tes droits administrateur.');return data;
}
// An entirely separate, memory-only store: no target credentials, IndexedDB or write RPC.
export class AdminPreviewStore extends TrainingStore {
 private snapshot:LocalData;
 constructor(actor:string,target:string,remote:CloudResult){
  super('admin-preview:'+actor+':'+target);
  this.snapshot={program:mergeCatalogue(remote.program??{catalogue:[],modeles:[]},remote.catalogue??[]),sessions:remote.sessions,runs:remote.runs,running:null,settings:{audio:'silent',barKg:20,reduced:false,sheetsUrl:''},pending:[],lastSync:Date.now(),programRevision:remote.revision};
 }
 async load(){return structuredClone(this.snapshot)}
 async persist(data:LocalData){this.snapshot=structuredClone(data)}
 async flush(){}
 async sync(local:LocalData){return {data:{...local,programRevision:local.programRevision??0,deletedSessions:local.deletedSessions??[],pending:[],lastSync:Date.now()},sheets:false}}
}

export const adminAccess={isAdmin:async()=>{const {data,error}=await supabase.rpc('elan_is_admin');return !error&&data===true},users:adminUsers,snapshot:adminSnapshot};
