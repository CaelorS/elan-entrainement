import type {Entry,Exercise,Measure} from './types.ts';
import {measureFor} from './activity.ts';
export type ExerciseFormat=Measure|'cycle'|'steps';
export const exerciseFormats=[
 {value:'reps',label:'Répétitions',help:'Nombre de séries et répétitions par série.'},
 {value:'duration',label:'Durée',help:'Durée de chaque série, pour chaque côté si l’exercice est unilatéral.'},
 {value:'distance',label:'Distance',help:'Distance en mètres pour chaque passage.'},
 {value:'execution',label:'Exécution libre',help:'Sans cible chiffrée : tu valides quand tu as terminé.'},
 {value:'cycle',label:'Cycles effort / repos',help:'Alternance chronométrée répétée au sein de chaque passage.'},
 {value:'steps',label:'Enchaînement d’étapes',help:'Une séquence de mouvements chronométrés, avec un côté choisi pour chaque étape.'},
] as const;
export function formatFor(ex:Exercise,entry:Entry):ExerciseFormat{return entry.steps?.length?'steps':entry.cycle?'cycle':measureFor(ex,entry)}
export function defaultExerciseEntry(ex:Exercise):Entry{
 return structuredClone(ex.parametres_defaut??{exercice_id:ex.id,ordre:0,series:1,reps_min:ex.categorie==='force'?10:0,reps_max:ex.categorie==='force'?10:0,duree_s:ex.categorie==='force'?0:30,repos_s:0,approche:false,intercalaire_de:[],format:'',note:'',...(ex.id==='marche_escargot'?{mesure:'distance',distance_m:2,duree_s:0}:{})});
}
export function changeExerciseFormat(ex:Exercise,entry:Entry,format:ExerciseFormat):Entry{
 if(format===formatFor(ex,entry))return entry;
 const next:Entry={...entry,mesure:format==='cycle'||format==='steps'?'duration':format,reps_min:0,reps_max:0,duree_s:0,distance_m:undefined,durees_s:undefined,cycle:undefined,steps:undefined,format:'',duree_totale_s:undefined,repos_total_s:undefined,approche:format==='reps'&&entry.approche,approche_repos_s:format==='reps'?entry.approche_repos_s:undefined};
 if(format==='reps'){next.reps_min=entry.reps_min>0?entry.reps_min:10;next.reps_max=Math.max(next.reps_min,entry.reps_max)}
 if(format==='duration')next.duree_s=entry.duree_s>0?entry.duree_s:30;
 if(format==='distance')next.distance_m=entry.distance_m&&entry.distance_m>0?entry.distance_m:2;
 if(format==='cycle'){next.cycle={count:10,work_s:5,rest_s:5};next.duree_s=100}
 if(format==='steps'){next.series=1;next.repos_s=0;next.steps=[{exercice_id:ex.id,duree_s:30,consigne:'',cote:'bilateral'}];next.duree_s=30}
 return next;
}
export function entryParameterError(ex:Exercise,entry:Entry):string|null{
 const positive=(n:number|undefined)=>typeof n==='number'&&Number.isFinite(n)&&n>0;
 if(!Number.isInteger(entry.series)||entry.series<1||entry.series>100)return 'Indique entre 1 et 100 séries.';
 if(!Number.isFinite(entry.repos_s)||entry.repos_s<0)return 'Le repos doit être positif ou nul.';
 const format=formatFor(ex,entry);
 if(format==='reps'&&(!Number.isInteger(entry.reps_min)||!Number.isInteger(entry.reps_max)||entry.reps_min<1||entry.reps_max<entry.reps_min))return 'Indique des répétitions entières, avec un maximum au moins égal au minimum.';
 if(format==='duration'&&(!positive(entry.duree_s)||entry.durees_s?.some(n=>!positive(n))))return 'Indique une durée supérieure à 00:00.';
 if(format==='distance'&&!positive(entry.distance_m))return 'Indique une distance supérieure à zéro.';
 if(format==='cycle'&&(!Number.isInteger(entry.cycle?.count)||!positive(entry.cycle?.count)||!positive(entry.cycle?.work_s)||!Number.isFinite(entry.cycle?.rest_s)||entry.cycle!.rest_s<0))return 'Indique un nombre entier de cycles et une durée d’effort positive.';
 if(format==='steps'&&(entry.intercalaire_de.length||entry.approche||entry.series!==1))return 'Un enchaînement s’exécute une fois, hors des pauses et sans séries d’approche.';
 if(format==='steps'&&entry.steps!.some(s=>!s.exercice_id||!positive(s.duree_s)))return 'Choisis un exercice et une durée positive pour chaque étape.';
 return null;
}
