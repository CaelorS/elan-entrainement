import {z} from 'zod';
import type {LocalData,Program,Session,RunLog} from './types';
const number=z.number().finite().nonnegative();
const text=z.string();
const exercise=z.object({id:text.min(1),nom:text,categorie:text,type_charge:text,unilateral:z.boolean(),increment_kg:number,consigne:text,vigilance:text,objectif:text,media:text,audio_nom:text,statut:text}).passthrough();
const entry=z.object({exercice_id:text,series:number.int(),reps_min:number,reps_max:number,duree_s:number,repos_s:number,approche:z.boolean(),intercalaire_de:z.array(number),format:text,note:text,ordre:number,mesure:z.enum(['reps','duration','distance','execution']).optional(),distance_m:number.optional(),jours:z.array(number.int().max(6)).optional(),steps:z.array(z.object({exercice_id:text,duree_s:number,consigne:text})).optional(),cycle:z.object({count:number.int().positive(),work_s:number.positive(),rest_s:number}).optional()}).passthrough();
const model=z.object({id:text,nom:text,sous_titre:text,duree_min:number,jours:z.array(number.int().max(6)),version:number.int(),actif_du:text,actif_au:text,archive:z.boolean(),exercices:z.array(entry)}).passthrough();
export const programSchema=z.object({catalogue:z.array(exercise),modeles:z.array(model)}).passthrough().superRefine((p,ctx)=>{const ids=new Set(p.catalogue.map(e=>e.id));for(const m of p.modeles)for(const e of m.exercices)if(!ids.has(e.exercice_id)||e.steps?.some(step=>!ids.has(step.exercice_id)))ctx.addIssue({code:'custom',message:'Exercice absent du catalogue'});});
const session=z.object({seance_uuid:text.min(1),date:text,seance_id:text,seance_version:number,nom:text,heure_debut:text,heure_fin:text,duree_min:number,exercices_prevus:number,exercices_faits:number,volume_kg:number,rpe_global:number.nullable(),ressenti:text,records:z.array(text),statut:z.enum(['terminee','abandonnee']),series:z.array(z.object({uuid:text,seance_uuid:text,exercice_id:text,charge_kg:number,reps_faites:number,reps_prevues:number,duree_s:number}).passthrough()),retours:z.array(z.object({exercice_id:text,retour:z.enum(['trop_dur','ok','facile'])}).passthrough())}).passthrough();
const run=z.object({uuid:text.min(1),date:text,km:number}).passthrough();
const backupSchema=z.object({program:programSchema,sessions:z.array(session),runs:z.array(run),settings:z.object({audio:z.enum(['voice','beeps','silent']),barKg:number.max(30),reduced:z.boolean(),sheetsUrl:text.optional()}).optional()});
export function restoreBackup(local:LocalData,input:unknown):LocalData{
 const b=backupSchema.parse(input);
 const sessions=new Map(local.sessions.map(s=>[s.seance_uuid,s]));
 for(const s of b.sessions)sessions.set(s.seance_uuid,s as Session);
 const runs=new Map(local.runs.map(r=>[r.uuid,r]));for(const r of b.runs)runs.set(r.uuid,r as RunLog);
 return {...local,program:b.program as Program,sessions:[...sessions.values()],runs:[...runs.values()],settings:b.settings?{...b.settings,sheetsUrl:''}:local.settings,
  pending:[...new Set([...local.pending,'program',...b.sessions.map(s=>s.seance_uuid),...b.runs.map(r=>r.uuid)])]};
}
