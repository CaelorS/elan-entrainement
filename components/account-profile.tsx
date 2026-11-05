import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {supabase} from '../lib/supabase';
import {defaultProfile,genderOptions,illustrationOptions,parseProfile,type AccountProfile,type Gender} from '../lib/profile';

type ProfileContext={profile:AccountProfile;ready:boolean;busy:boolean;error:string;save:(patch:Partial<AccountProfile>)=>Promise<void>;reload:()=>void};
const Context=createContext<ProfileContext|null>(null);
export function useIllustrationGender(){return useContext(Context)?.profile.illustration_gender??'mixed'}
export function GenderField({value,onChange,disabled=false}:{value:Gender;onChange:(v:Gender)=>void;disabled?:boolean}){
 return <label className="field-label">Genre (facultatif)<select value={value} disabled={disabled} onChange={e=>onChange(e.target.value as Gender)}>{genderOptions.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>;
}
export function AccountProfileProvider({userId,children}:{userId:string;children:ReactNode}){
 const cacheKey='elan-profile:'+userId;
 const [profile,setProfile]=useState<AccountProfile>(()=>{try{return parseProfile(JSON.parse(localStorage.getItem(cacheKey)??'null'))??defaultProfile}catch{return defaultProfile}});
 const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 const live=useRef(true),saving=useRef(false),revision=useRef(0);
 const remember=(value:AccountProfile)=>{setProfile(value);try{localStorage.setItem(cacheKey,JSON.stringify(value))}catch{}};
 useEffect(()=>{live.current=true;return()=>{live.current=false}},[]);
 useEffect(()=>{let cancelled=false;
  const reload=async()=>{
   if(saving.current)return;
   const request=++revision.current;
   try{const {data,error}=await supabase.from('elan_profiles').select('gender,illustration_gender').eq('user_id',userId).single();
    if(cancelled||request!==revision.current)return;
    const result=parseProfile(data);if(error||!result)throw Error();remember(result);setReady(true);setError('');
   }catch{if(!cancelled&&request===revision.current)setError('Tes préférences de compte ne sont pas accessibles. Vérifie ta connexion, puis réessaie.')}
  };
  void reload();window.addEventListener('online',reload);return()=>{cancelled=true;window.removeEventListener('online',reload)};
 },[userId,attempt]);
 async function save(patch:Partial<AccountProfile>){
  if(saving.current||!ready)return;saving.current=true;++revision.current;setBusy(true);setError('');
  try{const {data,error}=await supabase.from('elan_profiles').update(patch).eq('user_id',userId).select('gender,illustration_gender').single();
   const result=parseProfile(data);if(error||!result)throw Error();if(live.current)remember(result);
  }catch{if(live.current)setError('Modification non enregistrée. Vérifie ta connexion, puis réessaie.')}
  finally{saving.current=false;if(live.current)setBusy(false)}
 }
 return <Context.Provider value={{profile,ready,busy,error,save,reload:()=>setAttempt(n=>n+1)}}>{children}</Context.Provider>;
}
export function AccountPreferences(){
 const account=useContext(Context);if(!account)return null;
 const {profile,ready,busy,error,save,reload}=account;
 return <section className="account-preferences"><h3>Profil · Illustrations</h3><GenderField value={profile.gender} disabled={!ready||busy} onChange={gender=>void save({gender})}/><label className="field-label">Genre des illustrations<select value={profile.illustration_gender} disabled={!ready||busy} onChange={e=>void save({illustration_gender:e.target.value as AccountProfile['illustration_gender']})}>{illustrationOptions.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><p className="subtle">Indépendant de ton genre. Mixte alterne les illustrations masculines et féminines.</p><a className="secondary illustration-catalogue-link" href={import.meta.env.BASE_URL+'exercise-illustrations-bd/index.html'} target="_blank" rel="noreferrer">Voir les illustrations</a>{busy&&<p role="status">Enregistrement…</p>}{error&&<><p role="alert">{error}</p><button type="button" className="secondary" disabled={busy} onClick={reload}>Réessayer</button></>}</section>;
}
