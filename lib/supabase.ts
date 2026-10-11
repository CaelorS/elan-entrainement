import {createClient} from '@supabase/supabase-js';
export const credentialLink=typeof location!=='undefined'&&(['recovery','invite'].includes(new URLSearchParams(location.hash.slice(1)).get('type')??'')||new URLSearchParams(location.search).get('recovery')==='1');
// Public browser key. Database access is restricted by RLS and the user's session.
export const supabase=createClient(
 import.meta.env?.VITE_SUPABASE_URL || 'https://aciowkdgysvbecglwepy.supabase.co',
 import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_6KavHWae34Kqf0dacFP4GA_UYw_5oHv',
 {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}
);
