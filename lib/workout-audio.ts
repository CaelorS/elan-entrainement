import type {Exercise,Run} from './types';
import {hasLoad,isGuided,measureFor} from './activity.ts';
import {exerciseVoiceCatalogue} from './exercise-voice-catalogue.ts';
export const exerciseVoiceKey=(exercise:Pick<Exercise,'nom'>)=>exerciseVoiceCatalogue[exercise.nom.normalize('NFC').trim().toLowerCase().replace(/\s+/g,' ')];
export function workoutAudioPlan(run:Run){
 const task=run.tasks[run.cursor],deadlines:number[]=[];
 if(run.pausedAt!==null)return {deadlines,announcement:null};
 const timed=(value?:number|null)=>{if(value)deadlines.push(value)};
 const exerciseAnnouncement=(ex:Exercise,side:string,key:string,prefix=false)=>{
  const name=exerciseVoiceKey(ex),clips=name?[...(prefix?['repos']:[]),name,...(side==='bilateral'?[]:['cote_'+side])]:[];
  return {key,clips,text:(prefix?'Repos. ':'')+ex.nom+(side==='bilateral'?'':'. Côté '+(side==='droite'?'droit':'gauche'))};
 };
 if(run.phase==='BILAN')return {deadlines,announcement:{key:run.uuid+':end',clips:['fini'],text:'Séance terminée.'}};
 if(!task)return {deadlines,announcement:null};
 if(run.phase==='EXECUTION'&&measureFor(task.ex,task.entry)==='duration')timed(run.deadline);
 if(run.phase==='COUNTDOWN'&&(!hasLoad(task.ex)||isGuided(task)))timed(run.deadline);
 if(run.phase==='VALIDATION')timed(run.restDeadline);
 if(run.phase==='REST'){
  timed(run.deadline);const filler=task.fillers?.[run.fillerIndex];
  if(filler&&measureFor(filler.ex,filler.entry)==='duration')timed(run.fillerDeadline);
  return {deadlines,announcement:filler?exerciseAnnouncement(filler.ex,filler.side,run.uuid+':rest:'+run.cursor+':'+run.fillerIndex,run.fillerIndex===0):{key:run.uuid+':rest:'+run.cursor,clips:['repos'],text:'Repos.'}};
 }
 // The same key from preparation through execution prevents duplicate names.
 return {deadlines,announcement:['CHARGE','READY','COUNTDOWN','EXECUTION'].includes(run.phase)?exerciseAnnouncement(task.ex,task.side,run.uuid+':task:'+run.cursor):null};
}
