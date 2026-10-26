import {useState} from 'react';
import {workoutIcons,workoutIconId,type WorkoutIconId} from '../lib/workout-icons';
import type {Model} from '../lib/types';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from './ui/dialog';
import './workout-icon.css';
export function WorkoutIcon({model,id,size=28}:{model?:Pick<Model,'nom'|'sous_titre'|'icon_id'|'exercices'>;id?:WorkoutIconId;size?:number}){
 const chosen=id??workoutIconId(model??{});
 return <img className="workout-icon" src={`${import.meta.env.BASE_URL}workout-icons/${chosen}.svg`} width={size} height={size} alt="" aria-hidden="true"/>;
}
export function WorkoutIconPicker({model,onSave}:{model:Model;onSave:(m:Model)=>void}){
 const [open,setOpen]=useState(false);const selected=workoutIconId(model);
 return <><button type="button" className="workout-icon-trigger" aria-label="Modifier l’illustration de la séance" aria-haspopup="dialog" onClick={()=>setOpen(true)}><WorkoutIcon model={model} size={30}/></button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="elan-dialog icon-dialog"><DialogHeader><DialogTitle>Illustration de la séance</DialogTitle><DialogDescription>Choisis l’illustration qui représente ta séance.</DialogDescription></DialogHeader><div className="workout-icon-grid">{workoutIcons.map(icon=><button type="button" key={icon.id} aria-pressed={selected===icon.id} title={icon.description} onClick={()=>{if(model.icon_id!==icon.id)onSave({...model,icon_id:icon.id});setOpen(false)}}><WorkoutIcon id={icon.id} size={42}/><span>{icon.name}</span></button>)}</div><button className="secondary" onClick={()=>setOpen(false)}>Annuler</button></DialogContent></Dialog></>;
}
