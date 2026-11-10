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
 z.object({type:z.literal('cycle'),series,cycle:z.object({count:z.number().int().min(1).max(100),work:positiveDuration,rest:duration}).strict(),repos}).strict(),
 z.object({type:z.literal('steps'),steps:z.array(z.object({exercice_id:z.string().min(1).max(100).regex(/^[\w.-]+$/),duree:positiveDuration,consigne:z.string().max(5000).default(''),cote:z.enum(['gauche','droite','bilateral']).default('bilateral')}).strict()).min(1).max(100)}).strict(),
]).describe('Format et cibles. Choisir exactement une variante ; les anciens paramètres incompatibles seront supprimés.');
type Json=Record<string,any>;
type Format=z.output<typeof exerciseFormatSchema>;
const fmt=(s:number)=>`${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;
export function formatEntry(exercice_id:string,settings:Format,previous?:Json):Json{
 const out:Json={...previous,exercice_id,ordre:previous?.ordre??1,series:settings.type==='steps'?1:settings.series,reps_min:0,reps_max:0,duree_s:0,repos_s:settings.type==='steps'?0:settings.repos??previous?.repos_s??0,approche:false,intercalaire_de:previous?.intercalaire_de??[],format:'',note:previous?.note??'',mesure:['cycle','steps'].includes(settings.type)?'duration':settings.type,revision:(previous?.revision??0)+1};
 for(const key of ['distance_m','durees_s','cycle','steps','approche_repos_s','duree_totale_s','repos_total_s'])delete out[key];
 switch(settings.type){
 case 'reps':out.reps_min=settings.reps_min;out.reps_max=settings.reps_max;out.approche=settings.approche??previous?.approche??false;if(settings.repos_approche!==null&&(settings.repos_approche??previous?.approche_repos_s)!==undefined)out.approche_repos_s=settings.repos_approche??previous?.approche_repos_s;break;
 case 'duration':out.duree_s=settings.duree;if(settings.durees)out.durees_s=settings.durees;break;
 case 'distance':out.distance_m=settings.distance_m;break;
 case 'cycle':out.cycle={count:settings.cycle.count,work_s:settings.cycle.work,rest_s:settings.cycle.rest};out.duree_s=settings.cycle.count*(settings.cycle.work+settings.cycle.rest);break;
 case 'steps':out.steps=settings.steps.map(s=>({exercice_id:s.exercice_id,duree_s:s.duree,consigne:s.consigne,cote:s.cote}));out.duree_s=out.steps.reduce((n:number,s:Json)=>n+s.duree_s,0);break;
 }
 if(out.intercalaire_de.length)out.repos_s=0;
 return out;
}
export function editableFormat(e:Json):Json{
 if(e.steps?.length)return {type:'steps',steps:e.steps.map((s:Json)=>({exercice_id:s.exercice_id,duree:fmt(s.duree_s),consigne:s.consigne,cote:s.cote??'bilateral'}))};
 const common={series:e.series,repos:fmt(e.repos_s??0)};
 if(e.cycle)return {...common,type:'cycle',cycle:{count:e.cycle.count,work:fmt(e.cycle.work_s),rest:fmt(e.cycle.rest_s)}};
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
 {type:'cycle',label:'Cycles effort / repos',description:'Alternance chronométrée au sein de chaque passage. Durée = count × (work + rest), par côté. Le repos entre passages est séparé.',example:{type:'cycle',series:1,cycle:{count:10,work:'00:05',rest:'00:05'},repos:'00:00'}},
 {type:'steps',label:'Enchaînement d’étapes',description:'Séquence unique de mouvements chronométrés. Chaque étape précise son côté ; aucune duplication gauche/droite automatique. Hors des pauses, sans séries d’approche. Durée totale calculée.',example:{type:'steps',steps:[{exercice_id:'knee_to_wall',duree:'00:30',cote:'gauche',consigne:'Talon au sol.'},{exercice_id:'knee_to_wall',duree:'00:30',cote:'droite',consigne:'Talon au sol.'}]}},
];
