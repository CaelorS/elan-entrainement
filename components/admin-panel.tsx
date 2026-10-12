import {EditableInput,EditableTextarea} from './editable-field';
import {useEffect,useState} from 'react';
import {adminAccess,AdminPreviewStore,type AdminUser} from '../lib/admin';
import Home from '../app/page';
export function AdminPanel({actor,onPreview,access=adminAccess}:{actor:string;onPreview:(active:boolean)=>void;access?:typeof adminAccess}){
 const [admin,setAdmin]=useState(false),[open,setOpen]=useState(false),[users,setUsers]=useState<AdminUser[]>([]),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [preview,setPreview]=useState<{user:AdminUser;store:AdminPreviewStore}|null>(null);
 useEffect(()=>{let live=true;void access.isAdmin().then(value=>{if(live)setAdmin(value)}).catch(()=>{if(live)setAdmin(false)});return()=>{live=false}},[actor,access]);
 async function list(){setOpen(true);setBusy(true);setError('');try{setUsers(await access.users())}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function view(user:AdminUser){setBusy(true);setError('');try{const snapshot=await access.snapshot(user.id);setPreview({user,store:new AdminPreviewStore(actor,user.id,snapshot)});setOpen(false);onPreview(true)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 function leave(){setPreview(null);onPreview(false)}
 if(!admin)return null;
 if(preview)return <div className="admin-preview"><aside className="admin-banner"><div><strong>Vue de {preview.user.email}</strong><p>Consultation · tes essais ne sont pas enregistrés dans son compte. Réglages locaux et séance en cours sur son téléphone non inclus.</p></div><button className="secondary" onClick={leave}>Revenir à mon compte</button></aside><Home key={preview.user.id} store={preview.store} email={preview.user.email} onSignOut={async()=>leave()} preview/></div>;
 return <section className="admin-panel" aria-label="Administration"><button className="secondary" onClick={()=>open?setOpen(false):void list()}>{open?'Fermer l’administration':'Administration · Voir un utilisateur'}</button>{open&&<div><h2>Voir comme un utilisateur</h2><p>Consulte son programme et ses séances synchronisées. Les essais dans cet aperçu restent temporaires.</p><label>Rechercher par adresse e-mail<EditableInput type="search" value={query} onChange={e=>setQuery(e.target.value)}/></label>{busy&&<p role="status">Chargement…</p>}{error&&<p role="alert">{error}</p>}<ul>{users.filter(u=>u.id!==actor&&u.email.toLowerCase().includes(query.toLowerCase())).map(u=><li key={u.id}><span>{u.email}</span><button className="secondary" disabled={busy} onClick={()=>void view(u)}>Voir cet espace</button></li>)}</ul>{!busy&&users.length<=1&&<p>Aucun autre utilisateur.</p>}</div>}</section>;
}
