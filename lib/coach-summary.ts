import type {Exercise,Session} from './types';
import {rowMeasure,rowHasWeight,rowDistance,durationLabel} from './activity.ts';
export function coachSummary(session:Session,catalogue:Exercise[]):string{
 const names=new Map(catalogue.map(e=>[e.id,e]));
 const feedback={facile:'Facile',ok:'Bien',trop_dur:'Difficile'};
 const lines=[
  'Voici le bilan de ma séance Élan. Analyse ce que j’ai réellement fait, tiens compte de mes ressentis et propose des ajustements pour la prochaine séance. Distingue les constats des suggestions. Ne modifie pas mon programme sans mon accord.',
  '',`Séance : ${session.nom}`,`Date : ${session.date}`,`Statut : ${session.statut==='terminee'?'Terminée':'Interrompue'}`,
  `Durée : ${session.duree_inconnue?'Non renseignée':durationLabel(session.duree_min*60)}`,
  `Effort global : ${session.rpe_global===null?'Non renseigné':session.rpe_global+'/10'}`,
  `Ressenti : ${session.ressenti||'Non renseigné'}`,'','Séries et activités réalisées :',
 ];
 for(const row of session.series){
  const ex=names.get(row.exercice_id),measure=rowMeasure(row);
  const values=[`${ex?.nom??row.exercice_id} — ${row.intercalaire?'intercalaire':row.echauffement?'échauffement':row.approche?'approche':'travail'}, série ${row.index_serie}`];
  if(row.cote!=='bilateral')values.push(`côté ${row.cote}`);
  if(measure==='reps')values.push(`${row.reps_faites} répétitions (prévues : ${row.reps_prevues})`);
  if(measure==='duration')values.push(durationLabel(row.duree_s));
  if(measure==='distance')values.push(`${rowDistance(row)} m`);
  if(measure==='execution')values.push('Exécution libre');
  if(rowHasWeight(row,ex))values.push(`${row.charge_kg} kg`);
  if(row.charge_libelle)values.push(`résistance : ${row.charge_libelle}`);
  if(row.angle_deg!==undefined)values.push(`${row.angle_deg}°`);
  if(row.rir_ressenti!==null&&row.rir_ressenti!==undefined)values.push(`${row.rir_ressenti} répétitions en réserve`);
  if(row.commentaire)values.push(`note : ${row.commentaire}`);
  lines.push('- '+values.join(' · '));
 }
 if(!session.series.length)lines.push('Aucune série enregistrée.');
 if(session.retours?.length){lines.push('','Ressenti par exercice :');for(const r of session.retours)lines.push(`- ${names.get(r.exercice_id)?.nom??r.exercice_id} : ${feedback[r.retour]}`)}
 return lines.join('\n');
}
