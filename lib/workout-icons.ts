// Shared by the UI and MCP. Stable identifiers; SVGs live in public/workout-icons.
export const workoutIcons = [
  {
    "id": "full_body",
    "name": "Corps entier",
    "description": "Silhouette entière, pour une séance sollicitant tout le corps."
  },
  {
    "id": "upper_body",
    "name": "Haut du corps",
    "description": "Buste et bras, pour le travail du haut du corps."
  },
  {
    "id": "lower_body",
    "name": "Bas du corps",
    "description": "Bassin et jambes, pour les séances du bas du corps."
  },
  {
    "id": "push",
    "name": "Poussée",
    "description": "Bras en extension et flèche sortante, pour les mouvements de poussée."
  },
  {
    "id": "pull",
    "name": "Tirage",
    "description": "Bras ramenés vers le buste, pour les mouvements de tirage."
  },
  {
    "id": "strength",
    "name": "Force / haltères",
    "description": "Haltère chargé, pour la musculation et la force."
  },
  {
    "id": "hypertrophy",
    "name": "Hypertrophie",
    "description": "Bras fléchi et muscle, pour le développement musculaire."
  },
  {
    "id": "core",
    "name": "Abdos / gainage",
    "description": "Buste et sangle abdominale, pour le gainage et les abdominaux."
  },
  {
    "id": "mobility",
    "name": "Mobilité",
    "description": "Articulation entourée d’une flèche, pour l’amplitude et la mobilité."
  },
  {
    "id": "stretching",
    "name": "Étirements",
    "description": "Silhouette en étirement latéral."
  },
  {
    "id": "morning_routine",
    "name": "Routine matinale",
    "description": "Soleil levant, pour les routines du matin."
  },
  {
    "id": "running",
    "name": "Course à pied",
    "description": "Coureur en mouvement."
  },
  {
    "id": "cycling",
    "name": "Cyclisme",
    "description": "Vélo et cycliste."
  },
  {
    "id": "swimming",
    "name": "Natation",
    "description": "Nageur au-dessus des vagues."
  },
  {
    "id": "triathlon",
    "name": "Triathlon",
    "description": "Trois disciplines : nage, vélo et course."
  },
  {
    "id": "crossfit",
    "name": "Cross-training",
    "description": "Kettlebell, pour les séances de préparation physique variée."
  },
  {
    "id": "hiit",
    "name": "HIIT / fractionné",
    "description": "Chronomètre et éclair, pour les efforts par intervalles."
  },
  {
    "id": "recovery",
    "name": "Récupération",
    "description": "Feuille au creux d’une main, pour les séances de récupération."
  },
  {
    "id": "balance",
    "name": "Équilibre",
    "description": "Silhouette sur un pied, pour la stabilité et la proprioception."
  },
  {
    "id": "cardio",
    "name": "Cardio général",
    "description": "Cœur et pulsation, pour l’endurance cardiovasculaire."
  }
] as const;
export type WorkoutIconId=typeof workoutIcons[number]['id'];
export const isWorkoutIconId=(id:unknown):id is WorkoutIconId=>workoutIcons.some(icon=>icon.id===id);
const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export const iconRules:readonly [WorkoutIconId,string][]=[
 ['triathlon','triathlon'],['morning_routine','matin|morning|reveil'],['full_body','corps entier|full.body'],['upper_body','haut du corps|upper.body'],['lower_body','bas du corps|lower.body|jambes'],['push','poussee|push'],['pull','tirage|pull'],['swimming','natation|nage|swim'],['cycling','cyclisme|velo|cycling'],['running','course|running|jogging'],['crossfit','crossfit|cross.training'],['hiit','hiit|fractionne|intervalles'],['hypertrophy','hypertrophie|hypertrophy'],['balance','equilibre|proprioception'],['recovery','recuperation|recovery'],['stretching','etirement|stretching'],['mobility','mobilite|mobility'],['core','abdos|abdominaux|gainage|core'],['cardio','cardio|endurance'],['strength','force|musculation|renfo|halteres']];
type Source={icon_id?:string;nom?:string;sous_titre?:string;exercices?:{exercice_id:string}[]};
export function inferWorkoutIcon(model:Source,catalogue:readonly {id:string;nom?:string;categorie?:string}[]=[]):WorkoutIconId{
 // Prefer the explicit session title over secondary descriptions or individual exercises.
 for(const text of [model.nom??'',model.sous_titre??''])for(const [id,pattern] of iconRules)if(new RegExp(pattern).test(normalize(text)))return id;
 const exercises=(model.exercices??[]).map(e=>catalogue.find(x=>x.id===e.exercice_id)).filter(Boolean);
 const scores=new Map<WorkoutIconId,number>();
 for(const ex of exercises){for(const [id,pattern] of iconRules){if(new RegExp(pattern).test(normalize((ex?.nom??'')+' '+(ex?.categorie??'')))){scores.set(id,(scores.get(id)??0)+1);break}}}
 const best=[...scores].sort((a,b)=>b[1]-a[1]);
 return best.length&&best[0][1]>exercises.length/2?best[0][0]:'full_body';
}
export function workoutIconId(model:Source,catalogue:readonly {id:string;nom?:string;categorie?:string}[]=[]):WorkoutIconId{return isWorkoutIconId(model.icon_id)?model.icon_id:inferWorkoutIcon(model,catalogue)}
