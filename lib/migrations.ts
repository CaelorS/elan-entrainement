import type {LocalData,Program} from './types';

// Apply only explicitly revised default entries; preserve user models, history and active runs.
export function migrateProgram(current:Program,defaults:Program):Program {
 let updated=(current.revision??0)<(defaults.revision??0);
 const catalogue=current.catalogue.map(ex=>{const update=defaults.catalogue.find(x=>x.id===ex.id);if(update&&(update.revision??0)>(ex.revision??0)){updated=true;return {...ex,...update}}return ex});
 const modeles=current.modeles.map(model=>{
  if(model.actif_au||model.archive)return model;
  const template=defaults.modeles.find(m=>m.id===model.id);if(!template)return model;
  let changed=false;
  const exercices=model.exercices.map(entry=>{
   const update=template.exercices.find(e=>e.exercice_id===entry.exercice_id);
   if(!update||(update.revision??0)<=(entry.revision??0))return entry;
   changed=true;updated=true;
   return {...entry,revision:update.revision,steps:update.steps,cycle:update.cycle,series:update.series,reps_min:update.reps_min,reps_max:update.reps_max,duree_s:update.duree_s,mesure:update.mesure,format:update.format,note:update.note};
  });
  return changed?{...model,exercices,version:model.version+1}:model;
 });
 return updated?{...current,revision:Math.max(current.revision??0,defaults.revision??0),catalogue,modeles}:current;
}
export function migrateData(data:LocalData,defaults:Program):LocalData {
 const program=migrateProgram(data.program,defaults);
 return program===data.program?data:{...data,program,pending:[...new Set([...data.pending,'program'])]};
}
