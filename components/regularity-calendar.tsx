import {Check,Flame,Moon,Dumbbell} from 'lucide-react';
import {regularity} from '../lib/regularity';
import type {Model,Session} from '../lib/types';
export function RegularityCalendar({models,sessions}:{models:Model[];sessions:Session[]}){
 const {days,streak}=regularity(models,sessions);
 const cells=(from:number,to:number)=>days.slice(from,to).map(d=><div key={d.date} className={`calendar-day ${d.rest?'rest':'active'} ${d.valid?'done':''} ${d.future?'planned':''}`} title={`${new Date(d.date+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})} · ${d.scheduled.join(', ')||(d.rest?'Repos prévu':'Aucune séance planifiée')} · ${d.valid?'Validé':d.future?'À venir':'Non validé'}`}><span>{Number(d.date.slice(-2))}</span>{d.valid?<Check size={13}/>:d.rest?<Moon size={13}/>:d.scheduled.length?<Dumbbell size={13}/>:<span className="day-dot"/>}</div>);
 return <section className="compliance"><h3>Régularité sur 4 semaines</h3><p className="streak"><Flame size={18}/><strong>{streak} jour{streak===1?'':'s'} consécutif{streak===1?'':'s'}</strong></p><div className="week-cells">{cells(0,28)}</div><h4>Les 2 prochaines semaines</h4><div className="week-cells">{cells(28,42)}</div><div className="calendar-legend"><span><Dumbbell size={14}/> Entraînement</span><span><Moon size={14}/> Repos</span><span><Check size={14}/> Validé</span></div><p className="subtle">Les repos planifiés sont validés en fin de journée et préservent ta série. Les jours à venir ne comptent pas encore.</p></section>;
}
