import {createClient} from '@supabase/supabase-js';
// Public browser key. Database access is restricted by RLS and the user's session.
export const supabase=createClient(
 import.meta.env?.VITE_SUPABASE_URL || 'https://aciowkdgysvbecglwepy.supabase.co',
 import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_6KavHWae34Kqf0dacFP4GA_UYw_5oHv',
 {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}
);
