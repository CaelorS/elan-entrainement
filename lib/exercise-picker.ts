import type {Exercise,Entry,Model} from './types.ts';
const normalize=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr').replace(/[’']/g,' ').trim();
export function matchesExercise(ex:Exercise,query:string){const text=normalize(ex.nom+' '+ex.categorie+' '+ex.type_charge);return normalize(query).split(/\s+/).every(word=>text.includes(word))}
export function sharedExerciseTemplate(ex:Exercise,current:Model,models:Model[]):Entry{
 const all=[current,...models.filter(m=>m!==current&&!m.actif_au),...models.filter(m=>m.actif_au)];
 const template=all.flatMap(m=>m.exercices).find(e=>e.exercice_id===ex.id&&e.intercalaire_de.length)??all.flatMap(m=>m.exercices).find(e=>e.exercice_id===ex.id);
 if(template)return structuredClone(template);
 return {exercice_id:ex.id,series:1,reps_min:ex.categorie==='force'?10:0,reps_max:ex.categorie==='force'?10:0,duree_s:ex.categorie==='force'?0:30,repos_s:0,approche:false,intercalaire_de:[],format:'',note:'',ordre:0,...(ex.id==='marche_escargot'?{mesure:'distance',distance_m:2,duree_s:0}:{})};
}
export function insertTemplate(ex:Exercise,current:Model,models:Model[],copy?:Entry|null):Entry{
 const template=copy?.exercice_id===ex.id?structuredClone(copy):sharedExerciseTemplate(ex,current,models);
 return {...template,series:copy?.exercice_id===ex.id?copy.series:1,duree_s:copy?.exercice_id===ex.id?template.duree_s:template.durees_s?.[0]??template.duree_s,durees_s:copy?.exercice_id===ex.id?template.durees_s:undefined,repos_s:0,approche:false,approche_repos_s:undefined,jours:undefined,format:'',repos_total_s:undefined,duree_totale_s:undefined};
}
export function exerciseChoices(catalogue:Exercise[],models:Model[],query:string){
 const inserts=new Set(models.flatMap(m=>m.exercices.filter(e=>e.intercalaire_de.length).map(e=>e.exercice_id)));
 return [...new Map(catalogue.map(ex=>[ex.id,ex])).values()].filter(ex=>matchesExercise(ex,query)).sort((a,b)=>Number(!!b.intercalaire||inserts.has(b.id))-Number(!!a.intercalaire||inserts.has(a.id))||a.nom.localeCompare(b.nom,'fr'));
}
