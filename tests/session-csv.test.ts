import test from 'node:test';import assert from 'node:assert/strict';
import {sessionCSV} from '../lib/session-csv.ts';import type {Session,Exercise,Row} from '../lib/types.ts';
const ex={id:'squat',nom:'Squat; "libre"',type_charge:'barre'} as Exercise;
const row={exercice_id:'squat',index_serie:1,cote:'bilateral',mesure:'reps',charge_applicable:true,charge_kg:42.5,reps_faites:8,rir_ressenti:0} as Row;
const session={date:'2026-10-13',nom:'Bas du corps',statut:'terminee',duree_min:40,rpe_global:7,ressenti:'Bonne séance\nÀ refaire',series:[row]} as Session;
test('session CSV quotes names and multiline notes, includes units, and preserves zero RIR',()=>{const csv=sessionCSV(session,[ex]);assert.ok(csv.startsWith('"date";"seance";"statut";'));assert.ok(csv.includes('"Squat; ""libre"""'));assert.ok(csv.includes('"42.5";"";"8";"";"";"";"0";"7";"Bonne séance\nÀ refaire"'));});
test('timed inserts export duration and angle without fictitious weights or repetitions',()=>{const timed={...row,exercice_id:'chaise',mesure:'duration',intercalaire:true,charge_applicable:false,duree_s:45,angle_deg:90,rir_ressenti:null} as Row;const csv=sessionCSV({...session,duree_inconnue:true,series:[timed]},[]);assert.ok(csv.includes('"terminee";"";"chaise"'));assert.ok(csv.includes('"intercalaire";"1";"bilateral";"duration";"";"";"";"45";"";"90";"";'));});
