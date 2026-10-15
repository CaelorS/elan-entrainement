import {useRef,useState} from 'react';
import {ChevronUp,ChevronDown} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogTrigger} from './ui/dialog';
import {durationLabel} from '../lib/activity';

export function DurationPicker({value,onConfirm,onCancel,title,min=0,max=86400}:{value:number;onConfirm:(v:number)=>void;onCancel:()=>void;title:string;min?:number;max?:number}){
 const [minutes,setMinutes]=useState(String(Math.floor(Math.round(value)/60))),[seconds,setSeconds]=useState(String(Math.round(value)%60));
 const beforeEdit=useRef(['','']);
 const total=Number(minutes)*60+Number(seconds),valid=minutes!==''&&seconds!==''&&Number.isInteger(total)&&Number(seconds)<60&&total>=min&&total<=max;
 const bump=(delta:number)=>{const next=Math.max(min,Math.min(max,total+delta));setMinutes(String(Math.floor(next/60)));setSeconds(String(next%60))};
 return <DialogContent className="elan-dialog duration-dialog" aria-describedby={undefined} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();if(valid)onConfirm(total)}}}><DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader><div className="duration-wheels">{(['minutes','secondes'] as const).map((unit,i)=><div className="duration-column" key={unit}><button type="button" aria-label={'Augmenter de '+(i? '10 secondes':'1 minute')} onClick={()=>bump(i?10:60)} disabled={total>=max}><ChevronUp/></button><label><input aria-label={unit} inputMode="numeric" value={i?seconds:minutes} onFocus={()=>{beforeEdit.current[i]=i?seconds:minutes;(i?setSeconds:setMinutes)('')}} onBlur={()=>{if((i?seconds:minutes)==='')(i?setSeconds:setMinutes)(beforeEdit.current[i])}} onChange={e=>{const raw=e.target.value;if(/^\d{0,4}$/.test(raw)&&(i===0||Number(raw)<60))(i?setSeconds:setMinutes)(raw.replace(/^0+(?=\d)/,''))}}/><span>{unit}</span></label><button type="button" aria-label={'Diminuer de '+(i?'10 secondes':'1 minute')} onClick={()=>bump(i?-10:-60)} disabled={total<=min}><ChevronDown/></button></div>)}</div><div className="duration-actions"><button type="button" className="primary" disabled={!valid} onClick={()=>onConfirm(total)}>Valider · {durationLabel(total)}</button><button type="button" className="secondary" onClick={onCancel}>Annuler</button></div></DialogContent>;
}
export function DurationField({value,onChange,label='Durée',min=0,max=86400,disabled=false}:{value:number|string;onChange:(v:number)=>void;label?:string;min?:number|string;max?:number|string;disabled?:boolean}){
 const [open,setOpen]=useState(false);
 return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><button type="button" className="duration-field" disabled={disabled} aria-label={label+' : '+(value===''?'non renseignée':durationLabel(Number(value)))}>{value===''?'—:—':durationLabel(Number(value))}</button></DialogTrigger>{open&&<DurationPicker value={Number(value)||0} min={Number(min)} max={Number(max)} title={label} onCancel={()=>setOpen(false)} onConfirm={v=>{onChange(v);setOpen(false)}}/>}</Dialog>;
}
