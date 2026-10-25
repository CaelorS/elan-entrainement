import test from 'node:test';
import assert from 'node:assert/strict';
import {coachSummary} from '../lib/coach-summary.ts';
import type {Session,Exercise} from '../lib/types.ts';
test('coach handoff includes actual sets, feedback and unknown duration without inventing loads',()=>{
 const catalogue=[{id:'squat',nom:'Squat',type_charge:'barre'},{id:'stretch',nom:'Étirement',type_charge:'aucune'}] as Exercise[];
 const session={nom:'Bas du corps',date:'2026-10-25',statut:'terminee',duree_inconnue:true,duree_min:0,rpe_global:7,ressenti:'Fatigué',retours:[{exercice_id:'squat',retour:'trop_dur'}],series:[{exercice_id:'squat',index_serie:1,cote:'bilateral',mesure:'reps',charge_applicable:true,charge_kg:45,reps_prevues:5,reps_faites:4,rir_ressenti:0,commentaire:'Dernière difficile'},{exercice_id:'stretch',index_serie:1,cote:'gauche',mesure:'duration',duree_s:45,intercalaire:true,charge_kg:0,rir_ressenti:null}]} as unknown as Session;
 const before=JSON.stringify(session),text=coachSummary(session,catalogue);
 assert.match(text,/4 répétitions \(prévues : 5\)/);assert.match(text,/45 kg/);assert.match(text,/0 répétitions en réserve/);assert.match(text,/00:45/);assert.match(text,/côté gauche/);assert.match(text,/Squat : Difficile/);assert.match(text,/Durée : Non renseignée/);assert.match(text,/Effort global : 7\/10/);assert.match(text,/Dernière difficile/);assert.doesNotMatch(text,/0 kg/);assert.equal(JSON.stringify(session),before);
});
