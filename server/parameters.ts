import {z} from 'zod';
export const id=z.string().min(1).max(100).regex(/^[\w.-]+$/).describe('Identifiant stable ; réutiliser pour modifier, nouveau pour créer.');
const text=z.string().max(5000);
export const duration=z.string().regex(/^\d{1,5}:[0-5]\d$/).describe('Minutes:secondes, ex. 03:30 (jamais un nombre de secondes).').transform(v=>{const [m,s]=v.split(':').map(Number);return m*60+s});
const positiveDuration=duration.refine(v=>v>0,'La durée doit être positive');
const days=z.array(z.number().int().min(0).max(6)).max(7).refine(v=>new Set(v).size===v.length,'Jours dupliqués');
const date=z.union([z.literal(''),z.iso.date()]);
export const exerciseSchema=z.object({
 id,nom:z.string().trim().min(1).max(200).describe('Nom affiché.'),
 categorie:z.string().max(100).default('force').describe('Catégorie libre ; force et echauffement pilotent le moteur.'),
 type_charge:z.enum(['aucune','barre','halteres','machine','poulie','elastique','poids_corps','poids_du_corps']).default('aucune').describe('Matériel ; poids_du_corps est un alias de poids_corps.').transform(v=>v==='poids_du_corps'?'poids_corps':v),
 unilateral:z.boolean().default(false).describe('Un côté puis l’autre.'),
 increment_kg:z.number().min(0).max(100).default(1).describe('Incrément de progression en kg.'),
 consigne:text.default('').describe('Description technique du mouvement.'),
 vigilance:text.default('').describe('Point à surveiller.'),objectif:text.default('').describe('Objectif de cet exercice.'),
 media:z.union([z.literal(''),z.url().refine(v=>v.startsWith('https://'))]).default('').describe('URL HTTPS de l’image/vidéo, ou vide.'),
 reference_kg:z.number().min(0).max(2000).nullable().optional().describe('Charge de référence en kg ; null efface la référence. Date mise à jour automatiquement.'),
 intercalaire:z.boolean().default(false).describe('Exercice proposé pendant les repos.'),
 audio_nom:z.string().max(500).optional().describe('Nom du fichier audio hérité (ex. squat.m4a), conservé même si le lecteur utilise la synthèse vocale.'),
 statut:z.string().max(100).optional().describe('Statut de catalogue, généralement actif. Aucun effet de suspension de compte.')
}).strict();
export const entrySchema=z.object({
 exercice_id:id,ordre:z.number().int().min(1).max(10000).optional().describe('Ordre stable et unique ; omis = position dans la liste, à partir de 1. Les liens intercalaires utilisent cet ordre.'),
 series:z.number().int().min(1).max(100).describe('Séries ou passages.'),
 reps_min:z.number().int().min(0).max(10000).default(0).describe('Minimum de répétitions par série et par côté.'),
 reps_max:z.number().int().min(0).max(10000).default(0).describe('Maximum de répétitions ; égal au minimum pour une cible fixe.'),
 mesure:z.enum(['reps','duration','distance','execution']).describe('Répétitions, chronométré, mètres ou exécution libre.'),
 duree:duration.prefault('00:00').describe('Durée par série/côté ; recalculée si cycle ou étapes.'),
 repos:duration.prefault('00:00').describe('Repos des séries ; forcé à 00:00 pour un intercalaire.'),
 repos_approche:duration.nullable().optional().describe('Repos d’approche ; null = moitié du repos standard.'),
 distance_m:z.number().min(0).max(100000).nullable().optional().describe('Distance par passage en mètres ; null efface.'),
 approche:z.boolean().default(false).describe('Active les trois séries d’approche calculées par le moteur.'),
 intercalaire_de:z.array(z.number().int().min(1).max(10000)).max(100).default([]).describe('Ordres des exercices principaux dont les repos accueillent cette entrée.'),
 note:text.default('').describe('Note propre à cette séance.'),format:text.optional().describe('Texte de format libre hérité ; ne remplace pas les paramètres chiffrés.'),
 jours:days.nullable().optional().describe('0 dimanche à 6 samedi ; null = tous les jours, [] = aucun jour. Filtre propre à cette entrée.'),
 angle_deg:z.number().min(0).max(180).nullable().optional().describe('Angle en degrés ; affichage actuellement réservé au squat isométrique.'),
 durees:z.array(positiveDuration).min(1).max(100).nullable().optional().describe('Une durée MM:SS par série ; null efface. Exclusif avec cycle et steps.'),
 steps:z.array(z.object({exercice_id:id,duree:positiveDuration,consigne:text.describe('Consigne de cette étape.')}).strict()).min(1).max(100).nullable().optional().describe('Étapes chronométrées d’échauffement ; null efface. Une seule séquence, sans séries d’approche ni intercalaire.'),
 cycle:z.object({count:z.number().int().min(1).max(100).describe('Nombre de cycles.'),work:positiveDuration.describe('Contraction MM:SS.'),rest:duration.describe('Relâchement MM:SS.')}).strict().nullable().optional().describe('Cycles contraction/relâchement ; null efface. Durée par série calculée.'),
 pause:z.object({approche:z.boolean().describe('Pause après une série d’approche si true, de travail sinon.'),index:z.number().int().min(1).max(100).describe('Numéro de série à partir de 1.')}).strict().nullable().optional().describe('Placement précis dans la pause d’un seul parent, avec pauses_explicites=true ; null efface.')
}).strict();
export const sessionSchema=z.object({
 id,nom:z.string().trim().min(1).max(200).describe('Titre de la séance.'),sous_titre:z.string().max(300).default('').describe('Sous-titre.'),
 jours:days.default([]).describe('0 dimanche, 1 lundi … 6 samedi ; [] = à la carte.'),
 duree_estimee:duration.prefault('00:00').describe('Durée indicative MM:SS.'),
 pauses_explicites:z.boolean().optional().describe('Placement précis des intercalaires via pause ; sinon placement automatique.'),
 archive:z.boolean().optional().describe('Archivée si true ; conservée si omis lors d’une modification.'),
 actif_du:date.optional().describe('Début de validité YYYY-MM-DD, vide = sans borne ; création : date du jour.'),
 actif_au:date.optional().describe('Fin de validité YYYY-MM-DD, vide = sans borne.'),
 exercices:z.array(entrySchema).min(1).max(100).describe('Liste complète des entrées ; remplace la liste précédente.')
}).strict();
type Json=Record<string,any>;
export const fieldMap={
 exercise:{id:'id',nom:'nom',categorie:'categorie',type_charge:'type_charge',unilateral:'unilateral',increment_kg:'increment_kg',consigne:'consigne',vigilance:'vigilance',objectif:'objectif',media:'media',reference_kg:'reference_kg',intercalaire:'intercalaire',audio_nom:'audio_nom',statut:'statut'},
 session:{id:'id',nom:'nom',sous_titre:'sous_titre',jours:'jours',duree_estimee:'duree_min',pauses_explicites:'pauses_explicites',archive:'archive',actif_du:'actif_du',actif_au:'actif_au',exercices:'exercices'},
 entry:{exercice_id:'exercice_id',ordre:'ordre',series:'series',reps_min:'reps_min',reps_max:'reps_max',mesure:'mesure',duree:'duree_s',repos:'repos_s',repos_approche:'approche_repos_s',distance_m:'distance_m',approche:'approche',intercalaire_de:'intercalaire_de',note:'note',format:'format',jours:'jours',angle_deg:'angle_deg',durees:'durees_s',steps:'steps',cycle:'cycle',pause:'pause'},
 step:{exercice_id:'exercice_id',duree:'duree_s',consigne:'consigne'},cycle:{count:'count',work:'work_s',rest:'rest_s'},pause:{approche:'approche',index:'index'}
};
export const managedFields={exercise:{reference_at:'Date technique de la charge de référence, millisecondes Unix ; automatique.',revision:'Révision technique automatique.'},session:{version:'Version interne automatique, non présentée à l’utilisateur.'},entry:{revision:'Révision technique automatique.',duree_totale_s:'Total calculé pour la présentation, jamais une consigne de durée.',repos_total_s:'Total calculé des repos pour la présentation.'}};
export function parameterReference(){return {version:'1.1.0',duration_format:'MM:SS',exercise:z.toJSONSchema(exerciseSchema,{io:'input'}),session:z.toJSONSchema(sessionSchema,{io:'input'}),storage_mapping:fieldMap,read_only:managedFields,semantics:['Lire editable_session/ editable_exercises avant une modification complète. Les champs facultatifs omis sont conservés pour une entrée identifiée par ordre et exercice_id. Utiliser null pour effacer les paramètres facultatifs qui l’acceptent.','Les paramètres standard avec valeur par défaut sont remplacés ; la liste exercices est complète, les entrées absentes sont retirées.','Les champs techniques sont consultables dans les résultats bruts ; ils ne sont pas acceptés en écriture. Les entraînements réalisés et leurs mesures ne font pas partie de la programmation.']}}
export function fmt(seconds:number){const n=Math.max(0,Math.round(seconds));return `${Math.floor(n/60).toString().padStart(2,'0')}:${(n%60).toString().padStart(2,'0')}`}
export function editableExercise(e:Json){return Object.fromEntries(Object.keys(fieldMap.exercise).filter(k=>e[k]!==undefined).map(k=>[k,e[k]]))}
export function editableSession(m:Json){
 const out:Json={};for(const [key,stored] of Object.entries(fieldMap.session)){if(m[stored]!==undefined)out[key]=m[stored]}
 out.duree_estimee=fmt((m.duree_min??0)*60);
 out.exercices=m.exercices.map((e:Json)=>{const x:Json={};for(const [key,stored] of Object.entries(fieldMap.entry)){if(e[stored]!==undefined)x[key]=e[stored]}
 x.mesure=e.mesure??(e.exercice_id==='marche_escargot'?'distance':e.duree_s>0?'duration':e.reps_max>0?'reps':'execution');
 x.duree=fmt(e.duree_s??0);x.repos=fmt(e.repos_s??0);
 if(e.approche_repos_s!==undefined)x.repos_approche=fmt(e.approche_repos_s);
 if(e.durees_s)x.durees=e.durees_s.map(fmt);
 if(e.steps)x.steps=e.steps.map((s:Json)=>({exercice_id:s.exercice_id,duree:fmt(s.duree_s),consigne:s.consigne}));
 if(e.cycle)x.cycle={count:e.cycle.count,work:fmt(e.cycle.work_s),rest:fmt(e.cycle.rest_s)};
 if(x.mesure==='distance'&&x.distance_m===undefined)x.distance_m=e.exercice_id==='marche_escargot'?2:0;
 return x});return out;
}
export function sessionModel(input:z.output<typeof sessionSchema>,previous?:Json){
 const m:Json={...previous,...input,duree_min:input.duree_estimee/60,version:(previous?.version??0)+1,actif_du:input.actif_du??previous?.actif_du??new Date().toISOString().slice(0,10),actif_au:input.actif_au??previous?.actif_au??'',archive:input.archive??previous?.archive??false};delete m.duree_estimee;
 m.exercices=input.exercices.map((e,i)=>{const order=e.ordre??i+1;const old=previous?.exercices.find((x:Json)=>x.ordre===order&&x.exercice_id===e.exercice_id);const out:Json={...old};
 for(const [key,stored] of Object.entries(fieldMap.entry)){const v=(e as Json)[key];if(v!==undefined){if(v===null)delete out[stored];else out[stored]=v}}
 out.ordre=order;out.format??='';out.revision=(old?.revision??0)+1;delete out.duree_totale_s;delete out.repos_total_s;
 if(e.steps)out.steps=e.steps.map(s=>({exercice_id:s.exercice_id,duree_s:s.duree,consigne:s.consigne}));
 if(e.cycle)out.cycle={count:e.cycle.count,work_s:e.cycle.work,rest_s:e.cycle.rest};
 if(out.steps?.length)out.duree_s=out.steps.reduce((n:number,s:Json)=>n+s.duree_s,0);
 if(out.cycle)out.duree_s=out.cycle.count*(out.cycle.work_s+out.cycle.rest_s);
 if(out.intercalaire_de.length)out.repos_s=0;
 return out});return m;
}
export function validateModel(m:Json,catalogue:Json[]){
 const ids=new Set(catalogue.map(e=>e.id));const orders=new Map<number,Json>();
 if(m.actif_du&&m.actif_au&&m.actif_du>m.actif_au)throw Error('actif_au doit suivre actif_du.');
 for(const e of m.exercices){if(orders.has(e.ordre))throw Error('Chaque ordre doit être unique.');orders.set(e.ordre,e)}
 const occupied=new Set<string>();
 for(const e of m.exercices){
 if(!ids.has(e.exercice_id))throw Error('Exercice inconnu : '+e.exercice_id);
 if(e.reps_max<e.reps_min||e.mesure==='reps'&&e.reps_min<=0)throw Error('Répétitions invalides : 0 < reps_min <= reps_max.');
 if(e.mesure==='duration'&&e.duree_s<=0&&!e.durees_s?.length)throw Error('Indique une durée positive.');
 if(e.mesure==='distance'&&!(e.distance_m>0))throw Error('Indique une distance positive.');
 if([!!e.steps?.length,!!e.cycle,!!e.durees_s?.length].filter(Boolean).length>1)throw Error('steps, cycle et durees sont exclusifs. Efface les anciens réglages avec null.');
 if((e.steps?.length||e.cycle||e.durees_s?.length)&&e.mesure!=='duration')throw Error('Les étapes, cycles et durées par série nécessitent mesure=duration.');
 if(e.durees_s&&e.durees_s.length!==e.series)throw Error('durees doit contenir une durée par série.');
 if(e.steps?.length&&(e.series!==1||e.approche||e.intercalaire_de.length))throw Error('steps nécessite une entrée principale, une série et approche=false.');
 for(const s of e.steps??[])if(!ids.has(s.exercice_id))throw Error('Exercice d’étape inconnu : '+s.exercice_id);
 for(const p of e.intercalaire_de){const parent=orders.get(p);if(!parent||parent===e||parent.intercalaire_de.length)throw Error('Intercalaire invalide : utiliser l’ordre d’un exercice principal.');}
 if(e.pause){if(!m.pauses_explicites||e.intercalaire_de.length!==1)throw Error('pause nécessite pauses_explicites=true et un seul parent.');const p=orders.get(e.intercalaire_de[0])!;
 if(p.steps?.length||e.pause.approche&&(!p.approche||e.pause.index>3)||!e.pause.approche&&e.pause.index>p.series)throw Error('Cette pause n’existe pas dans les séries du parent.');
 if((e.pause.approche?(p.approche_repos_s??Math.round(p.repos_s/2)):p.repos_s)<=0)throw Error('La pause choisie a une durée nulle.');
 const key=`${p.ordre}:${e.pause.approche}:${e.pause.index}`;if(occupied.has(key))throw Error('Cette pause contient déjà un intercalaire.');occupied.add(key);
 }else if(m.pauses_explicites&&e.intercalaire_de.length)throw Error('Indique pause pour placer cet intercalaire dans les pauses explicites.');
 }
}
