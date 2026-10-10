import type {LocalData} from './types';
export function mergeSyncedData(current:LocalData,snapshot:LocalData,remote:LocalData):LocalData{
 const newer=current.pending.filter(id=>!snapshot.pending.includes(id)||
  (id==='program'&&JSON.stringify(current.program)!==JSON.stringify(snapshot.program))||
  JSON.stringify(current.sessions.find(s=>s.seance_uuid===id))!==JSON.stringify(snapshot.sessions.find(s=>s.seance_uuid===id))||
  JSON.stringify(current.runs.find(r=>r.uuid===id))!==JSON.stringify(snapshot.runs.find(r=>r.uuid===id)));
 const sessions=new Map(remote.sessions.map(s=>[s.seance_uuid,s]));
 current.sessions.filter(s=>newer.includes(s.seance_uuid)).forEach(s=>sessions.set(s.seance_uuid,s));
 const runs=new Map(remote.runs.map(r=>[r.uuid,r]));
 current.runs.filter(r=>newer.includes(r.uuid)).forEach(r=>runs.set(r.uuid,r));
 return {...current,sessions:[...sessions.values()].sort((a,b)=>b.heure_debut.localeCompare(a.heure_debut)),runs:[...runs.values()],
  program:newer.includes('program')?current.program:remote.program,programRevision:remote.programRevision,pending:newer,lastSync:remote.lastSync};
}
