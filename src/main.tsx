import React,{useEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {readOfflineAccount,rememberAccount,type LocalAccount} from '../lib/offline-account';
import {supabase,credentialLink} from '../lib/supabase';
import {TrainingStore} from '../lib/store';
import Home from '../app/page';
import {AdminPanel} from '../components/admin-panel';
import {useAppUpdates} from '../lib/updates';
import '../app/globals.css';
function SignedIn({session,onSignOut}:{session:LocalAccount;onSignOut:()=>Promise<void>}){
 const store=useMemo(()=>new TrainingStore(session.user.id),[session.user.id]);
 const [exclusive,setExclusive]=useState<boolean|null>(null),[preview,setPreview]=useState(false);
 useEffect(()=>{let live=true,release=()=>{};
  if(!navigator.locks){setExclusive(true);return}
  void navigator.locks.request('elan-account-'+session.user.id,{ifAvailable:true},async lock=>{if(!live)return;setExclusive(!!lock);if(lock)await new Promise<void>(resolve=>{release=resolve})});
  return()=>{live=false;release()};
 },[session.user.id]);
 if(!exclusive)return <main className="auth-screen"><div className="auth-card"><h1>Élan est déjà ouvert.</h1><p>{exclusive===null?'Ouverture du stockage…':'Ferme l’autre fenêtre Élan pour continuer ici et préserver ta séance.'}</p>{exclusive===false&&<button className="primary" onClick={()=>location.reload()}>Réessayer</button>}</div></main>;
 return <><AdminPanel actor={session.user.id} onPreview={setPreview}/>{!preview&&<Home store={store} email={session.user.email??''} onSignOut={async()=>{await store.flush();await onSignOut()}}/>}</>;
}
function authMessage(error:unknown){
 const code=(error as {code?:string})?.code;
 if(code==='invalid_credentials')return 'Adresse e-mail ou mot de passe incorrect. Tu peux utiliser « Mot de passe oublié ».';
 if(code==='email_not_confirmed')return 'Confirme ton adresse e-mail avant de te connecter.';
 if(code==='over_email_send_rate_limit'||code==='over_request_rate_limit')return 'Trop de tentatives. Patiente quelques minutes avant de réessayer.';
 if(code==='email_address_not_authorized')return 'L’envoi d’e-mails n’est pas encore configuré pour cette adresse. Contacte l’administrateur de ton application.';
 if(code==='same_password')return 'Choisis un mot de passe différent de l’ancien.';
 if(code==='weak_password')return 'Ce mot de passe ne respecte pas les règles du compte. Choisis un mot de passe plus long et plus varié.';
 return 'Impossible de terminer cette opération. Vérifie ta connexion Internet et réessaie.';
}
function App(){
 const [session,setSession]=useState<LocalAccount|null>(null),[ready,setReady]=useState(false),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [recovery,setRecovery]=useState(()=>credentialLink||sessionStorage.getItem('elan-password-recovery')==='1'),[forgot,setForgot]=useState(false),[notice,setNotice]=useState(''),[confirmation,setConfirmation]=useState('');
 useEffect(()=>{let live=true;if(credentialLink)sessionStorage.setItem('elan-password-recovery','1');
  const accept=(s:LocalAccount|null)=>{if(!live)return;if(s)rememberAccount(localStorage,s);setSession(s??(!navigator.onLine?readOfflineAccount(localStorage):null));setReady(true)};
  if(!navigator.onLine)accept(readOfflineAccount(localStorage));
  const refresh=()=>void supabase.auth.getSession().then(({data,error})=>{accept(data.session);if(error&&navigator.onLine)setError('Reconnecte-toi pour reprendre la synchronisation.');});
  refresh();window.addEventListener('online',refresh);
  const {data:{subscription}}=supabase.auth.onAuthStateChange((event,s)=>{if(event==='PASSWORD_RECOVERY'){sessionStorage.setItem('elan-password-recovery','1');setRecovery(true);setError('')}if(event==='SIGNED_OUT'){rememberAccount(localStorage,null);setSession(null);setReady(true)}else accept(s)});
  return()=>{live=false;subscription.unsubscribe();window.removeEventListener('online',refresh)};
 },[]);
 useAppUpdates(!busy&&!recovery&&!password&&!email&&!forgot,async()=>{},!session||recovery);
 async function signIn(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password});if(error)throw error;setPassword('')}catch(error){setError(authMessage(error))}finally{setBusy(false)}}
 async function requestReset(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setNotice('');try{
  const redirect=new URL(import.meta.env.BASE_URL,location.origin);redirect.searchParams.set('recovery','1');
  const {error}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:redirect.href});if(error)throw error;
  setNotice('Si cette adresse correspond à un compte, tu recevras un lien de réinitialisation. Vérifie aussi tes courriers indésirables.');
 }catch(error){setError(authMessage(error))}finally{setBusy(false)}}
 function leaveRecovery(){sessionStorage.removeItem('elan-password-recovery');const url=new URL(location.href);url.searchParams.delete('recovery');url.hash='';history.replaceState(null,'',url.pathname+url.search);setRecovery(false);setPassword('');setConfirmation('');setError('')}
 async function changePassword(e:React.FormEvent){e.preventDefault();setError('');if(password!==confirmation){setError('Les deux mots de passe ne correspondent pas.');return}setBusy(true);try{
  const {error}=await supabase.auth.updateUser({password});if(error)throw error;leaveRecovery();
 }catch(error){setError(authMessage(error))}finally{setBusy(false)}}
 if(!ready)return <main className="loading-screen"><span className="brand">élan<span className="accent">.</span></span><p>Ouverture de ton espace…</p></main>;
 if(recovery&&session)return <main className="auth-screen"><div className="auth-card"><span className="brand">élan<span className="accent">.</span></span><h1>Nouveau mot de passe.</h1><p>Ton programme et tes séances seront conservés.</p><form onSubmit={changePassword}><label className="field-label">Nouveau mot de passe<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)}/></label><label className="field-label">Confirmer le mot de passe<input type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label>{error&&<p role="alert" className="auth-error">{error}</p>}<button className="primary" disabled={busy}>{busy?'Enregistrement…':'Enregistrer le mot de passe'}</button></form></div></main>;
 if(forgot||recovery)return <main className="auth-screen"><div className="auth-card"><span className="brand">élan<span className="accent">.</span></span><h1>Retrouve ton accès.</h1><p>{recovery?'Ce lien a expiré ou n’est plus valide. Demande un nouveau lien.':'Reçois par e-mail un lien pour choisir un nouveau mot de passe.'}</p><form onSubmit={requestReset}><label className="field-label">Adresse e-mail<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label>{error&&<p role="alert" className="auth-error">{error}</p>}{notice&&<p role="status">{notice}</p>}<button className="primary" disabled={busy}>{busy?'Envoi…':'Recevoir le lien'}</button><button type="button" className="text-button" disabled={busy} onClick={()=>{leaveRecovery();setForgot(false);setNotice('')}}>Retour à la connexion</button></form></div></main>;
 if(session)return <SignedIn key={session.user.id} session={session} onSignOut={async()=>{const {error}=await supabase.auth.signOut({scope:'local'});if(error)throw error}}/>;
 return <main className="auth-screen"><div className="auth-card"><span className="brand">élan<span className="accent">.</span></span><p className="eyebrow">TON ENTRAÎNEMENT, À TON RYTHME</p><h1>Ton espace personnel.</h1><p>Retrouve ton programme et tes séances sur ton téléphone.</p><form onSubmit={signIn}><label className="field-label">Adresse e-mail<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label className="field-label">Mot de passe<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<p role="alert" className="auth-error">{error}</p>}<button className="primary" disabled={busy}>{busy?'Connexion…':'Se connecter'}</button><button type="button" className="text-button" disabled={busy} onClick={()=>{setForgot(true);setError('');setPassword('')}}>Mot de passe oublié</button></form><p className="subtle">Connecte-toi avec ton compte Élan. Après la première connexion, l’application reste disponible hors connexion sur cet appareil.</p><p className="install-note">Sur iPhone : Safari → Partager → Sur l’écran d’accueil.</p></div></main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
