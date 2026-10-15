import type {Model,Session} from './types';
const key=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const dateOf=(s:string)=>new Date(s+'T12:00:00');
const shift=(s:string,n:number)=>{const d=dateOf(s);d.setDate(d.getDate()+n);return key(d)};
export function regularity(models:Model[],sessions:Session[],today=key(new Date())){
 const starts=[...models.map(m=>m.actif_du).filter(Boolean),...sessions.map(s=>s.date)].filter(d=>d<=today).sort();
 const start=starts[0]??today;
 function day(date:string){
  const weekday=dateOf(date).getDay();
  // An archived version with an end date still describes its historical schedule.
  const candidates=models.filter(m=>(!m.archive||!!m.actif_au)&&(!m.actif_du||m.actif_du<=date)&&(!m.actif_au||m.actif_au>=date));
  const applicable=candidates.filter(m=>!candidates.some(other=>other.id===m.id&&other.version>m.version));
  const scheduled=applicable.filter(m=>m.jours.includes(weekday));
  const completed=sessions.filter(s=>s.date===date&&s.statut==='terminee');
  const rest=date>=start&&applicable.some(m=>m.jours.length>0)&&scheduled.length===0;
  const future=date>today,valid=!future&&(completed.length>0||(rest&&date<today));
  return {date,scheduled:scheduled.map(m=>m.nom),completed:completed.length,rest,future,valid};
 }
 let streak=0,cursor=day(today).valid?today:shift(today,-1);
 while(cursor>=start&&day(cursor).valid){streak++;cursor=shift(cursor,-1)}
 return {streak,days:Array.from({length:42},(_,i)=>day(shift(today,i-27)))};
}
