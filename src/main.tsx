import React,{useEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {readOfflineAccount,rememberAccount,type LocalAccount} from '../lib/offline-account';
import {supabase} from '../lib/supabase';
import {TrainingStore} from '../lib/store';
import Home from '../app/page';
import {useAppUpdates} from '../lib/updates';
import '../app/globals.css';
function SignedIn({session,onSignOut}:{session:LocalAccount;onSignOut:()=>Promise<void>}){
 const store=useMemo(()=>new TrainingStore(session.user.id),[session.user.id]);
 const [exclusive,setExclusive]=useState<boolean|null>(null);
 useEffect(()=>{let live=true,release=()=>{};
  if(!navigator.locks){setExclusive(true);return}
  void navigator.locks.request('elan-account-'+session.user.id,{ifAvailable:true},async lock=>{if(!live)return;setExclusive(!!lock);if(lock)await new Promise<void>(resolve=>{release=resolve})});
  return()=>{live=false;release()};
 },[session.user.id]);
 if(!exclusive)return <main className="auth-screen"><div className="auth-card"><h1>Élan est déjà ouvert.</h1><p>{exclusive===null?'Ouverture du stockage…':'Ferme l’autre fenêtre Élan pour continuer ici et préserver ta séance.'}</p>{exclusive===false&&<button className="primary" onClick={()=>location.reload()}>Réessayer</button>}</div></main>;
 return <Home store={store} email={session.user.email??''} onSignOut={async()=>{await store.flush();await onSignOut()}}/>;
}
function App(){
 const [session,setSession]=useState<LocalAccount|null>(null),[ready,setReady]=useState(false),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let live=true;
  const accept=(s:LocalAccount|null)=>{if(!live)return;if(s)rememberAccount(localStorage,s);setSession(s??(!navigator.onLine?readOfflineAccount(localStorage):null));setReady(true)};
  if(!navigator.onLine)accept(readOfflineAccount(localStorage));
  const refresh=()=>void supabase.auth.getSession().then(({data,error})=>{accept(data.session);if(error&&navigator.onLine)setError('Reconnecte-toi pour reprendre la synchronisation.');});
  refresh();window.addEventListener('online',refresh);
  const {data:{subscription}}=supabase.auth.onAuthStateChange((event,s)=>{if(event==='SIGNED_OUT'){rememberAccount(localStorage,null);setSession(null);setReady(true)}else accept(s)});
  return()=>{live=false;subscription.unsubscribe();window.removeEventListener('online',refresh)};
 },[]);
 useAppUpdates(!busy,async()=>{},!session);
 async function signIn(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password});if(error)throw error;setPassword('')}catch{setError('Connexion impossible. Vérifie ton adresse et ton mot de passe, ainsi que ta connexion Internet.')}finally{setBusy(false)}}
 if(!ready)return <main className="loading-screen"><span className="brand">élan<span className="accent">.</span></span><p>Ouverture de ton espace…</p></main>;
 if(session)return <SignedIn key={session.user.id} session={session} onSignOut={async()=>{const {error}=await supabase.auth.signOut({scope:'local'});if(error)throw error}}/>;
 return <main className="auth-screen"><div className="auth-card"><span className="brand">élan<span className="accent">.</span></span><p className="eyebrow">TON ENTRAÎNEMENT, À TON RYTHME</p><h1>Ton espace personnel.</h1><p>Retrouve ton programme et tes séances sur ton téléphone.</p><form onSubmit={signIn}><label className="field-label">Adresse e-mail<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label className="field-label">Mot de passe<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<p role="alert" className="auth-error">{error}</p>}<button className="primary" disabled={busy}>{busy?'Connexion…':'Se connecter'}</button></form><p className="subtle">Connecte-toi avec ton compte Élan. Après la première connexion, l’application reste disponible hors connexion sur cet appareil.</p><p className="install-note">Sur iPhone : Safari → Partager → Sur l’écran d’accueil.</p></div></main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
