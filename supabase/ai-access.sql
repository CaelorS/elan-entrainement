-- Apply after schema.sql and admin.sql, BEFORE enabling OAuth.
begin;
create table if not exists public.elan_account_status(user_id uuid primary key references auth.users(id) on delete cascade, suspended boolean not null default false);
create table if not exists public.elan_ai_grants(
 user_id uuid references auth.users(id) on delete cascade, client_id text not null,
 client_name text not null, can_write boolean not null default false,
 granted_at timestamptz not null default now(), revoked_at timestamptz,
 primary key(user_id,client_id)
);
create table if not exists public.elan_access_audit(
 id bigint generated always as identity primary key, actor uuid not null,
 action text not null, target text not null, at timestamptz not null default now()
);
alter table public.elan_account_status enable row level security;
alter table public.elan_ai_grants enable row level security;
alter table public.elan_access_audit enable row level security;
revoke all on public.elan_account_status,public.elan_ai_grants,public.elan_access_audit from public,anon,authenticated;
create or replace function public.elan_direct_access() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and nullif(auth.jwt()->>'client_id','') is null and not exists(select 1 from public.elan_account_status where user_id=auth.uid() and suspended);
$$;
create or replace function public.elan_is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select public.elan_direct_access() and exists(select 1 from public.elan_admins where user_id=auth.uid());
$$;
-- Restrictive policies also cover future permissive policies. OAuth tokens cannot
-- bypass the MCP validation layer through PostgREST or the legacy sync RPC.
do $$ declare t text; begin
 foreach t in array array['elan_programs','elan_sessions','elan_runs','elan_exercises'] loop
 execute format('drop policy if exists direct_account_only on public.%I',t);
 execute format('create policy direct_account_only on public.%I as restrictive for all to authenticated using (public.elan_direct_access()) with check (public.elan_direct_access())',t);
 end loop;
end $$;
create or replace function public.elan_ai_access(p_client text default null,p_name text default null,p_write boolean default false,p_revoke boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not public.elan_direct_access() then raise exception 'Direct account required' using errcode='42501'; end if;
 if p_client is not null then
  if length(p_client) not between 1 and 200 then raise exception 'Invalid client'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  if p_revoke then
   update public.elan_ai_grants set revoked_at=now() where user_id=auth.uid() and client_id=p_client;
  else
   if coalesce(length(p_name),0) not between 1 and 200 then raise exception 'Invalid name'; end if;
   insert into public.elan_ai_grants(user_id,client_id,client_name,can_write) values(auth.uid(),p_client,p_name,p_write)
   on conflict(user_id,client_id) do update set client_name=excluded.client_name,can_write=excluded.can_write,granted_at=now(),revoked_at=null;
  end if;
  insert into public.elan_access_audit(actor,action,target) values(auth.uid(),case when p_revoke then 'revoke_ai' else 'authorize_ai' end,p_client);
 end if;
 return coalesce((select jsonb_agg(to_jsonb(g)-'user_id' order by granted_at desc) from public.elan_ai_grants g where user_id=auth.uid()),'[]'::jsonb);
end $$;
-- The service key stays exclusively in Edge Functions. Both reads and writes
-- recheck consent under the same per-account lock as browser synchronization.
create or replace function public.elan_mcp_program(p_user uuid,p_client text,p_iat bigint,p_program jsonb default null,p_revision bigint default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare g public.elan_ai_grants; rev bigint; payload jsonb; begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 if exists(select 1 from public.elan_account_status where user_id=p_user and suspended) then raise exception 'Account suspended' using errcode='42501'; end if;
 select * into g from public.elan_ai_grants where user_id=p_user and client_id=p_client;
 if not found or g.revoked_at is not null or p_iat is null or p_iat<floor(extract(epoch from g.granted_at)) then raise exception 'Access revoked or not authorized' using errcode='42501'; end if;
 select p.revision,p.payload into rev,payload from public.elan_programs p where user_id=p_user;
 rev:=coalesce(rev,0);payload:=coalesce(payload,'{"catalogue":[],"modeles":[]}'::jsonb);
 if p_program is not null then
  if not g.can_write then raise exception 'Read-only access' using errcode='42501'; end if;
  if p_revision is distinct from rev then raise exception 'Programme changed. Read it again before editing.' using errcode='40001'; end if;
  if jsonb_typeof(p_program->'catalogue') is distinct from 'array' or jsonb_typeof(p_program->'modeles') is distinct from 'array' or octet_length(p_program::text)>1000000 then raise exception 'Invalid programme'; end if;
  insert into public.elan_programs(user_id,payload,revision) values(p_user,p_program,1) on conflict(user_id) do update set payload=excluded.payload;
  select p.revision,p.payload into rev,payload from public.elan_programs p where user_id=p_user;
  insert into public.elan_access_audit(actor,action,target) values(p_user,'mcp_write',p_client);
 end if;
 return jsonb_build_object('program',payload,'revision',rev,'can_write',g.can_write,'catalogue',coalesce((select jsonb_agg(e.payload) from public.elan_exercises e),'[]'::jsonb));
end $$;
create or replace function public.elan_manage_user(p_target uuid,p_action text) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('elan-admin-roles',0));
 if not public.elan_is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 if p_target=auth.uid() then raise exception 'Cannot change your own access'; end if;
 if not exists(select 1 from auth.users where id=p_target) then raise exception 'Unknown user'; end if;
 if p_action='suspend' or p_action='restore' then
  perform pg_advisory_xact_lock(hashtextextended(p_target::text,0));
  insert into public.elan_account_status values(p_target,p_action='suspend') on conflict(user_id) do update set suspended=excluded.suspended;
  if p_action='suspend' then update public.elan_ai_grants set revoked_at=now() where user_id=p_target; end if;
 elsif p_action='grant_admin' then insert into public.elan_admins values(p_target) on conflict do nothing;
 elsif p_action='remove_admin' then delete from public.elan_admins where user_id=p_target;
 else raise exception 'Invalid action'; end if;
 insert into public.elan_access_audit(actor,action,target) values(auth.uid(),p_action,p_target::text);
end $$;
create or replace function public.elan_admin_users() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.elan_is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'email',u.email,'admin',a.user_id is not null,'suspended',coalesce(s.suspended,false)) order by u.email) from auth.users u left join public.elan_admins a on a.user_id=u.id left join public.elan_account_status s on s.user_id=u.id),'[]'::jsonb);
end $$;
revoke all on function public.elan_direct_access(),public.elan_ai_access(text,text,boolean,boolean),public.elan_mcp_program(uuid,text,bigint,jsonb,bigint),public.elan_manage_user(uuid,text) from public,anon,authenticated;
grant execute on function public.elan_direct_access(),public.elan_ai_access(text,text,boolean,boolean),public.elan_manage_user(uuid,text) to authenticated;
grant execute on function public.elan_mcp_program(uuid,text,bigint,jsonb,bigint) to service_role;
commit;
