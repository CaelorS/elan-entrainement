import {validMcpClaims,boundedBody} from '../../../server/security.ts';
import {createClient} from '@supabase/supabase-js';
import {createElanHandler} from '../../../server/core.ts';
const url=Deno.env.get('SUPABASE_URL')!;
const resource=url+'/functions/v1/elan-mcp';
const service=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,content-type,mcp-protocol-version,mcp-session-id','Access-Control-Expose-Headers':'WWW-Authenticate','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
const json=(data:unknown,status=200,extra={})=>Response.json(data,{status,headers:{...cors,...extra}});
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 const path=new URL(req.url).pathname;
 if(req.method==='GET'&&path.endsWith('/oauth-protected-resource'))return json({resource,authorization_servers:[url+'/auth/v1'],bearer_methods_supported:['header']});
 const denied=()=>json({error:'invalid_token'},401,{'WWW-Authenticate':`Bearer resource_metadata="${resource}/oauth-protected-resource"`});
 const token=req.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];if(!token)return denied();
 try{
  const {data,error}=await service.auth.getClaims(token);const c=data?.claims;
  if(error||!c||!validMcpClaims(c,url+'/auth/v1'))return denied();
  const {data:user,error:userError}=await service.auth.getUser(token);if(userError||!user.user||user.user.id!==c.sub)return denied();
  const call=async(program?:unknown,revision?:number)=>{const {data,error}=await service.rpc('elan_mcp_program',{p_user:c.sub,p_client:c.client_id,p_iat:c.iat,p_program:program??null,p_revision:revision??null});if(error)throw Error(error.code==='40001'?'Le programme a changé. Relis-le avant de modifier.':error.code==='42501'?'Accès absent, suspendu ou révoqué. Reconnecte Élan.':'Impossible de sauvegarder le programme.');return data};
  await call(); // Consent is checked on every request, including tools/list.
  if(req.method==='POST'){
   // Bound the actual streamed body, not just the untrusted Content-Length.
   let bytes:Uint8Array;try{bytes=await boundedBody(req,1000000)}catch{return json({error:'request_too_large'},413)}
   req=new Request(req.url,{method:req.method,headers:req.headers,body:new TextDecoder().decode(bytes)});
  }
  const handler=createElanHandler({read:()=>call(),write:(p,r)=>call(p,r),history:async(q)=>{
   const {data,error}=await service.rpc('elan_mcp_history',{p_user:c.sub,p_client:c.client_id,p_iat:c.iat,p_id:q.id??null,p_from:q.date_from??null,p_to:q.date_to??null,p_session:q.session_id??null,p_exercise:q.exercise_id??null,p_status:q.status??null,p_offset:q.offset,p_limit:q.limit});
   if(error)throw Error(error.code==='42501'?'Lecture de l’historique non autorisée ou révoquée. Active-la dans Élan → Profil et réglages → Assistants IA.':'Impossible de lire l’historique. Vérifie les filtres puis réessaie.');return data;
  }});
  const response=await handler.fetch(req);const headers=new Headers(response.headers);for(const [k,v] of Object.entries(cors))headers.set(k,v);return new Response(response.body,{status:response.status,headers});
 }catch{return json({error:'access_denied',message:'Reconnecte Élan ou vérifie les autorisations.'},403)}
});
