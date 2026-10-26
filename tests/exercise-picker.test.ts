import test from 'node:test';import assert from 'node:assert/strict';
import {exerciseChoices,insertTemplate,matchesExercise} from '../lib/exercise-picker.ts';
import type {Model,Exercise,Entry} from '../lib/types.ts';
test('one catalogue across sessions, accent-insensitive search and shared insert settings',()=>{
 const ex={id:'marche_escargot',nom:"Marche de l’escargot",categorie:'mobilite'} as Exercise;
 const other={id:'ankle',nom:'Étirement de cheville',categorie:'mobilite',intercalaire:true} as Exercise;
 const entry={exercice_id:ex.id,series:2,distance_m:3,mesure:'distance',duree_s:0,repos_s:10,approche:true,jours:[1],intercalaire_de:[1],ordre:2} as Entry;
 const lower={id:'lower90',exercices:[]} as unknown as Model,upper={id:'upper',exercices:[entry]} as unknown as Model;
 const before=JSON.stringify([lower,upper]);assert.equal(exerciseChoices([ex,other],[lower,upper],'escargot')[0].id,ex.id);assert.equal(exerciseChoices([ex,other],[lower],'')[0].id,other.id);assert.equal(exerciseChoices([ex,other],[lower],'').length,2);
 assert.equal(matchesExercise(other,'etirement cheville'),true);assert.equal(matchesExercise(ex,"l'escargot"),true);assert.equal(exerciseChoices([ex],[lower],'squat').length,0);
 const added=insertTemplate(ex,lower,[upper]);assert.equal(added.distance_m,3);assert.equal(added.mesure,'distance');assert.equal(added.series,1);assert.equal(added.repos_s,0);assert.equal(added.approche,false);assert.equal(added.jours,undefined);assert.equal(JSON.stringify([lower,upper]),before);
 const fallback=insertTemplate(ex,lower,[]);assert.equal(fallback.distance_m,2);assert.equal(fallback.mesure,'distance');
});
