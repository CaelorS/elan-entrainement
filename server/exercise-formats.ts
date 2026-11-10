import {z} from 'zod';
export const duration=z.string().regex(/^\d{1,5}:[0-5]\d$/).describe('Minutes:secondes, ex. 03:30 (jamais un nombre de secondes).').transform(v=>{const [m,s]=v.split(':').map(Number);return m*60+s});
const positiveDuration=duration.refine(v=>v>0,'La durée doit être positive');
const series=z.number().int().min(1).max(100).describe('Séries ou passages, pour chaque côté si unilatéral.');
const repos=duration.optional().describe('Repos entre séries ; omis = conserver le repos existant, sinon 00:00.');
export const exerciseFormatSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('reps'),series,reps_min:z.number().int().min(1).max(10000),reps_max:z.number().int().min(1).max(10000),repos,approche:z.boolean().optional(),repos_approche:duration.nullable().optional()}).strict(),
 z.object({type:z.literal('duration'),series,duree:positiveDuration,repos,durees:z.array(positiveDuration).min(1).max(100).optional().describe('Optionnel : une durée par série ; nombre égal à series.')}).strict(),
 z.object({type:z.literal('distance'),series,distance_m:z.number().positive().max(100000),repos}).strict(),
 z.object({type:z.literal('execution'),series,repos}).strict(),
]).describe('Format et cibles. Choisir exactement une variante ; les anciens paramètres incompatibles seront supprimés.');
type Json=Record<string,any>;
type Format=z.output<typeof exerciseFormatSchema>;
const fmt=(s:number)=>`${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;
export function formatEntry(exercice_id:string,settings:Format,previous?:Json):Json{
 const out:Json={...previous,exercice_id,ordre:previous?.ordre??1,series:settings.series,reps_min:0,reps_max:0,duree_s:0,repos_s:settings.repos??previous?.repos_s??0,approche:false,intercalaire_de:previous?.intercalaire_de??[],format:'',note:previous?.note??'',mesure:settings.type,revision:(previous?.revision??0)+1};
 for(const key of ['distance_m','durees_s','cycle','steps','approche_repos_s','duree_totale_s','repos_total_s'])delete out[key];
 switch(settings.type){
 case 'reps':out.reps_min=settings.reps_min;out.reps_max=settings.reps_max;out.approche=settings.approche??previous?.approche??false;if(settings.repos_approche!==null&&(settings.repos_approche??previous?.approche_repos_s)!==undefined)out.approche_repos_s=settings.repos_approche??previous?.approche_repos_s;break;
 case 'duration':out.duree_s=settings.duree;if(settings.durees)out.durees_s=settings.durees;break;
 case 'distance':out.distance_m=settings.distance_m;break;
 }
 if(out.intercalaire_de.length)out.repos_s=0;
 return out;
}
export function editableFormat(e:Json):Json{
 const common={series:e.series,repos:fmt(e.repos_s??0)};
 const type=e.mesure??(e.exercice_id==='marche_escargot'?'distance':e.duree_s>0?'duration':e.reps_max>0?'reps':'execution');
 if(type==='duration')return {...common,type,duree:fmt(e.duree_s),...(e.durees_s?{durees:e.durees_s.map(fmt)}:{})};
 if(type==='distance')return {...common,type,distance_m:e.distance_m??(e.exercice_id==='marche_escargot'?2:0)};
 if(type==='reps')return {...common,type,reps_min:e.reps_min,reps_max:e.reps_max,approche:e.approche,...(e.approche_repos_s!==undefined?{repos_approche:fmt(e.approche_repos_s)}:{})};
 return {...common,type:'execution'};
}
export const exerciseFormatsReference=[
 {type:'reps',label:'Répétitions',description:'Séries et répétitions ; les charges restent dans reference_kg, indépendamment du format.',example:{type:'reps',series:3,reps_min:8,reps_max:12,repos:'02:00'}},
 {type:'duration',label:'Durée',description:'Durée par passage et par côté. durees permet des durées différentes selon les séries.',example:{type:'duration',series:1,duree:'00:30',repos:'00:00'}},
 {type:'distance',label:'Distance',description:'Distance en mètres par passage et par côté.',example:{type:'distance',series:2,distance_m:2,repos:'00:30'}},
 {type:'execution',label:'Exécution libre',description:'Aucune cible chiffrée. L’utilisateur valide manuellement.',example:{type:'execution',series:1,repos:'00:00'}},
];
