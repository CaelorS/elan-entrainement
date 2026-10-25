import './auth-options.css';
import {OAuthConsent} from '../components/ai-access';
import {AppHeader} from '../components/app-header';
import {EditableInput,EditableTextarea} from '../components/editable-field';
import React,{useEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {readOfflineAccount,rememberAccount,type LocalAccount} from '../lib/offline-account';
import {supabase,credentialLink,authStorage} from '../lib/supabase';
import {TrainingStore} from '../lib/store';
import Home from '../app/page';
import {AdminPanel} from '../components/admin-panel';
import {useAppUpdates} from '../lib/updates';
import '../app/globals.css';
class StartupBoundary extends React.Component<{children:React.ReactNode},{error:string|null}>{
 state:{error:string|null}={error:null};
 static getDerivedStateFromError(error:Error){return {error:error?.name||'Erreur de démarrage'}}
 render(){if(!this.state.error)return this.props.children;return <main className="auth-screen"><div className="auth-card"><AppHeader/><h1 className="section-title">Ouverture de l’application</h1><p>Une erreur a interrompu l’affichage. Tes données enregistrées n’ont pas été effacées.</p><p>Ferme les autres fenêtres Élan, puis recharge les fichiers de l’application.</p><button className="primary" onClick={()=>void (window as Window & {elanRepair?:()=>Promise<void>}).elanRepair?.()}>Réparer le chargement</button><p id="elan-repair-status" role="status"/><small>Diagnostic : {this.state.error}</small></div></main>}
}
function SignedIn({session,onSignOut}:{session:LocalAccount;onSignOut:()=>Promise<void>}){
 const store=useMemo(()=>new TrainingStore(session.user.id),[session.user.id]);
 const [exclusive,setExclusive]=useState<boolean|null>(null),[preview,setPreview]=useState(false);
 useEffect(()=>{let live=true,release=()=>{};
  if(!navigator.locks){setExclusive(true);return}
  void navigator.locks.request('elan-account-'+session.user.id,{ifAvailable:true},async lock=>{if(!live)return;setExclusive(!!lock);if(lock)await new Promise<void>(resolve=>{release=resolve})});
  return()=>{live=false;release()};
 },[session.user.id]);
 if(!exclusive)return <main className="auth-screen"><div className="auth-card"><AppHeader/><h1 className="section-title">Élan est déjà ouvert</h1><p>{exclusive===null?'Ouverture du stockage…':'Ferme l’autre fenêtre Élan pour continuer ici et préserver ta séance.'}</p>{exclusive===false&&<button className="primary" onClick={()=>location.reload()}>Réessayer</button>}</div></main>;
 return <><AdminPanel actor={session.user.id} onPreview={setPreview}/>{!preview&&<Home store={store} email={session.user.email??''} onSignOut={async()=>{await store.flush();await onSignOut()}}/>}</>;
}
function authMessage(error:unknown){
 const code=(error as {code?:string})?.code;
 if(code==='signup_disabled')return 'La création de compte est désactivée pour le moment. Contacte l’administrateur.';
 if(code==='user_already_exists')return 'Si tu possèdes déjà un compte, connecte-toi ou utilise « Mot de passe oublié ».';
 if(code==='invalid_credentials')return 'Adresse e-mail ou mot de passe incorrect. Tu peux utiliser « Mot de passe oublié ».';
 if(code==='email_not_confirmed')return 'Confirme ton adresse e-mail avant de te connecter.';
 if(code==='over_email_send_rate_limit'||code==='over_request_rate_limit')return 'Trop de tentatives. Patiente quelques minutes avant de réessayer.';
 if(code==='email_address_not_authorized')return 'L’envoi d’e-mails n’est pas encore configuré pour cette adresse. Contacte l’administrateur de ton application.';
 if(code==='same_password')return 'Choisis un mot de passe différent de l’ancien.';
 if(code==='weak_password')return 'Ce mot de passe ne respecte pas les règles du compte. Choisis un mot de passe plus long et plus varié.';
 return 'Impossible de terminer cette opération. Vérifie ta connexion Internet et réessaie.';
}
function App(){
 const [stayConnected,setStayConnected]=useState(true);
 const [session,setSession]=useState<LocalAccount|null>(null),[ready,setReady]=useState(false),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [recovery,setRecovery]=useState(()=>credentialLink||sessionStorage.getItem('elan-password-recovery')==='1'),[forgot,setForgot]=useState(false),[register,setRegister]=useState(false),[notice,setNotice]=useState(''),[confirmation,setConfirmation]=useState('');
 useEffect(()=>{let live=true;if(credentialLink)sessionStorage.setItem('elan-password-recovery','1');
  const accept=(s:LocalAccount|null)=>{if(!live)return;if(s)rememberAccount(authStorage.identityStorage(),s);setSession(s??(!navigator.onLine?readOfflineAccount(authStorage.identityStorage()):null));setReady(true)};
  if(!navigator.onLine)accept(readOfflineAccount(authStorage.identityStorage()));
  const refresh=()=>void supabase.auth.getSession().then(({data,error})=>{accept(data.session);if(error&&navigator.onLine)setError('Reconnecte-toi pour reprendre la synchronisation.');});
  refresh();window.addEventListener('online',refresh);
  const {data:{subscription}}=supabase.auth.onAuthStateChange((event,s)=>{if(event==='PASSWORD_RECOVERY'){sessionStorage.setItem('elan-password-recovery','1');setRecovery(true);setError('')}if(event==='SIGNED_OUT'){authStorage.clearIdentity();setSession(null);setReady(true)}else accept(s)});
  return()=>{live=false;subscription.unsubscribe();window.removeEventListener('online',refresh)};
 },[]);
 // Discover updates at sign-in, but never reload while a password manager is open.
 useAppUpdates(false,async()=>{},!session||recovery);
 async function signIn(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{authStorage.configure(stayConnected);const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password});if(error)throw error;setPassword('')}catch(error){setError(authMessage(error))}finally{setBusy(false)}}
 async function signUp(e:React.FormEvent){e.preventDefault();setError('');setNotice('');if(password!==confirmation){setError('Les deux mots de passe ne correspondent pas.');return}setBusy(true);try{
  authStorage.configure(true);const {data,error}=await supabase.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:new URL(import.meta.env.BASE_URL,location.origin).href}});if(error)throw error;
  setPassword('');setConfirmation('');if(!data.session)setNotice('Vérifie tes e-mails pour confirmer ton inscription. Si tu possèdes déjà un compte, utilise la connexion ou « Mot de passe oublié ».');
 }catch(error){setError(authMessage(error))}finally{setBusy(false)}}
 async function requestReset(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setNotice('');try{
  const redirect=new URL(import.meta.env.BASE_URL,location.origin);redirect.searchParams.set('recovery','1');
  const {error}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:redirect.href});if(error)throw error;
  setNotice('Si cette adresse correspond à un compte, tu recevras un lien de réinitialisation. Vérifie aussi tes courriers indésirables.');
 }catch(error){setError(authMessage(error))}finally{setBusy(false)}}
 function leaveRecovery(){sessionStorage.removeItem('elan-password-recovery');const url=new URL(location.href);url.searchParams.delete('recovery');url.hash='';history.replaceState(null,'',url.pathname+url.search);setRecovery(false);setPassword('');setConfirmation('');setError('')}
 async function changePassword(e:React.FormEvent){e.preventDefault();setError('');if(password!==confirmation){setError('Les deux mots de passe ne correspondent pas.');return}setBusy(true);try{
  const {error}=await supabase.auth.updateUser({password});if(error)throw error;leaveRecovery();
 }catch(error){setError(authMessage(error))}finally{setBusy(false)}}
 if(!ready)return <main className="loading-screen"><AppHeader tagline="TON ENTRAÎNEMENT, À TON RYTHME"/><p>Ouverture de ton espace…</p></main>;
 if(recovery&&session)return <main className="auth-screen"><div className="auth-card"><AppHeader tagline="TON ENTRAÎNEMENT, À TON RYTHME"/><h1 className="section-title">Nouveau mot de passe</h1><p>Ton programme et tes séances seront conservés.</p><form onSubmit={changePassword}><label className="field-label">Nouveau mot de passe<EditableInput type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)}/></label><label className="field-label">Confirmer le mot de passe<EditableInput type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label>{error&&<p role="alert" className="auth-error">{error}</p>}<button className="primary" disabled={busy}>{busy?'Enregistrement…':'Enregistrer le mot de passe'}</button></form></div></main>;
 if(forgot||recovery)return <main className="auth-screen"><div className="auth-card"><AppHeader tagline="TON ENTRAÎNEMENT, À TON RYTHME"/><h1 className="section-title">Retrouver ton accès</h1><p>{recovery?'Ce lien a expiré ou n’est plus valide. Demande un nouveau lien.':'Reçois par e-mail un lien pour choisir un nouveau mot de passe.'}</p><form onSubmit={requestReset}><label className="field-label">Adresse e-mail<EditableInput type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label>{error&&<p role="alert" className="auth-error">{error}</p>}{notice&&<p role="status">{notice}</p>}<button className="primary" disabled={busy}>{busy?'Envoi…':'Recevoir le lien'}</button><button type="button" className="text-button" disabled={busy} onClick={()=>{leaveRecovery();setForgot(false);setNotice('')}}>Retour à la connexion</button></form></div></main>;
 if(session&&new URLSearchParams(location.search).has('authorization_id'))return <OAuthConsent authorizationId={new URLSearchParams(location.search).get('authorization_id')!}/>;
 if(session)return <SignedIn key={session.user.id} session={session} onSignOut={async()=>{const {error}=await supabase.auth.signOut({scope:'local'});if(error)throw error}}/>;
 return <main className="auth-screen"><div className="auth-card"><AppHeader tagline="TON ENTRAÎNEMENT, À TON RYTHME"/><h1 className="section-title">{register?'Créer un compte':'Connexion'}</h1><p>{register?'Crée ton espace personnel pour préparer et retrouver tes séances.':'Retrouve ton programme et tes séances sur ton téléphone.'}</p><form onSubmit={register?signUp:signIn}><label className="field-label">Adresse e-mail<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label className="field-label">Mot de passe<input type="password" autoComplete={register?'new-password':'current-password'} minLength={register?8:undefined} required value={password} onChange={e=>setPassword(e.target.value)}/></label>{!register&&<label className="stay-connected"><input type="checkbox" checked={stayConnected} disabled={busy} onChange={e=>setStayConnected(e.target.checked)}/><span>Rester connecté</span></label>}{register&&<label className="field-label">Confirmer le mot de passe<input type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label>}{register&&<p className="subtle">Au moins 8 caractères. Ton programme et ton historique appartiennent à ton compte.</p>}{error&&<p role="alert" className="auth-error">{error}</p>}{notice&&<p role="status">{notice}</p>}<button className="primary" disabled={busy}>{busy?(register?'Création…':'Connexion…'):(register?'Créer mon compte':'Se connecter')}</button>{!register&&<button type="button" className="text-button" disabled={busy} onClick={()=>{setForgot(true);setError('');setNotice('');setPassword('')}}>Mot de passe oublié</button>}<button type="button" className="text-button" disabled={busy} onClick={()=>{setRegister(!register);setError('');setNotice('');setPassword('');setConfirmation('')}}>{register?'Déjà un compte ? Se connecter':'Créer un compte'}</button></form><p className="subtle">{register||stayConnected?'Ta connexion est conservée sur cet appareil, y compris pour accéder à tes séances hors connexion.':'Ta connexion est conservée uniquement pour cette session du navigateur.'}</p><p className="install-note">Sur iPhone : Safari → Partager → Sur l’écran d’accueil.</p></div></main>;
}
createRoot(document.getElementById('root')!).render(<StartupBoundary><App/></StartupBoundary>);
