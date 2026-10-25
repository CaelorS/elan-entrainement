import {createClient} from '@supabase/supabase-js';
import {createAuthStorage} from './auth-storage.ts';
const serviceUrl=import.meta.env?.VITE_SUPABASE_URL || 'https://aciowkdgysvbecglwepy.supabase.co';
const authKey=`sb-${new URL(serviceUrl).hostname.split('.')[0]}-auth-token`;
const unavailableStorage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
export const authStorage=createAuthStorage(typeof localStorage==='undefined'?unavailableStorage:localStorage,typeof sessionStorage==='undefined'?unavailableStorage:sessionStorage,authKey);
export const credentialLink=typeof location!=='undefined'&&(['recovery','invite'].includes(new URLSearchParams(location.hash.slice(1)).get('type')??'')||new URLSearchParams(location.search).get('recovery')==='1');
// Public browser key. Database access is restricted by RLS and the user's session.
export const supabase=createClient(
 serviceUrl,
 import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_6KavHWae34Kqf0dacFP4GA_UYw_5oHv',
 {auth:{storage:authStorage,storageKey:authKey,persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}
);
