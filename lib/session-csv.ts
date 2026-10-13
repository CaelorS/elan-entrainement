import type {Exercise,Session} from './types';
import {rowMeasure,rowHasWeight,rowDistance} from './activity.ts';
// One row per performed set/activity, with explicit units and readable exercise names.
export function sessionCSV(session:Session,catalogue:Exercise[]):string {
 const columns=['date','seance','statut','duree_seance_min','exercice','exercice_id','type','serie','cote','mesure','charge_kg','resistance','repetitions','duree_s','distance_m','angle_genou_deg','repetitions_en_reserve','effort_seance_sur_10','note_seance','commentaire_serie'];
 const quote=(value:unknown)=>'"'+String(value??'').replaceAll('"','""')+'"';
 const rows=session.series.map(row=>{const ex=catalogue.find(x=>x.id===row.exercice_id),measure=rowMeasure(row);
  return [session.date,session.nom,session.statut,session.duree_inconnue?'':session.duree_min,ex?.nom??row.exercice_id,row.exercice_id,row.intercalaire?'intercalaire':row.echauffement?'echauffement':row.approche?'approche':'travail',row.index_serie,row.cote,measure,rowHasWeight(row,ex)?row.charge_kg:'',row.charge_libelle??'',measure==='reps'?row.reps_faites:'',measure==='duration'?row.duree_s:'',measure==='distance'?rowDistance(row):'',row.angle_deg??'',row.rir_ressenti??'',session.rpe_global??'',session.ressenti,row.commentaire??''];
 });
 return [columns,...rows].map(row=>row.map(quote).join(';')).join('\r\n');
}
