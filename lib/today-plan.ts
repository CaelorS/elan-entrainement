import type {Model,Session} from './types';
import {localDate} from './engine.ts';

/** Derive the suggestion from saved history, so it survives reloads and sync. */
export function todayPlan(models:Model[],sessions:Session[],date=new Date()){
 const day=localDate(date),weekday=date.getDay();
 const active=models.filter(m=>!m.archive&&!m.actif_au);
 const completed=new Set(sessions.filter(s=>s.date===day&&s.statut==='terminee').map(s=>s.seance_id));
 const scheduled=active.filter(m=>m.jours.includes(weekday));
 // Keep the morning routine first, then the programme's existing order.
 const candidates=[...(scheduled.length?scheduled:active)].sort((a,b)=>Number(b.id==='bloc_matin')-Number(a.id==='bloc_matin'));
 const remaining=candidates.filter(m=>!completed.has(m.id));
 return {scheduled,candidates,remaining,completed,next:remaining[0]};
}
