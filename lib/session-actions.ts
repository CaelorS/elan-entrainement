import type {LocalData} from './types';
export function discardRunning(data:LocalData):LocalData{return {...data,running:null};}
export function removeSession(data:LocalData,id:string):LocalData{
 return {...data,sessions:data.sessions.filter(s=>s.seance_uuid!==id),deletedSessions:[...new Set([...(data.deletedSessions??[]),id])],pending:[...new Set([...data.pending,id])]};
}
