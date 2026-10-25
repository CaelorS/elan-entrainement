import {boundedBody} from '../../../server/security.ts';
import {createClient} from '@supabase/supabase-js';
const url=Deno.env.get('SUPABASE_URL')!;
const appUrl=Deno.env.get('ELAN_APP_URL')||'https://caelors.github.io/elan-entrainement/';
const cors={'Access-Control-Allow-Origin':new URL(appUrl).origin,'Access-Control-Allow-Headers':'authorization,apikey,x-client-info,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:cors});
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 const token=req.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];if(!token)return json({error:'Connexion requise'},401);
 const service=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
  const {data,error}=await service.auth.getClaims(token);if(error||!data?.claims||data.claims.client_id||data.claims.role!=='authenticated')return json({error:'Connexion directe requise'},403);
  const {data:user,error:ue}=await service.auth.getUser(token);if(ue||!user.user)return json({error:'Connexion requise'},401);
  const caller=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:'Bearer '+token}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:admin,error:ae}=await caller.rpc('elan_is_admin');if(ae||!admin)return json({error:'Administrateur requis'},403);
  if(Number(req.headers.get('content-length')||0)>4096)return json({error:'Requête trop longue'},413);
  let raw:string;try{raw=new TextDecoder().decode(await boundedBody(req,4096))}catch{return json({error:'Requête trop longue'},413)}
  const body=JSON.parse(raw);if(body.action!=='invite'||typeof body.email!=='string'||body.email.length>254||!/^\S+@\S+\.\S+$/.test(body.email))return json({error:'Adresse e-mail invalide'},400);
  const {error:inviteError}=await service.auth.admin.inviteUserByEmail(body.email.trim(),{redirectTo:appUrl});
  if(inviteError)return json({error:'Invitation impossible. Vérifie l’adresse, les invitations existantes et le service e-mail.'},400);
  await service.from('elan_access_audit').insert({actor:user.user.id,action:'invite',target:body.email.trim()});
  return json({message:'Invitation envoyée.'});
 }catch{return json({error:'Opération impossible. Réessaie.'},400)}
});
