-- Apply after ai-access.sql. History remains read-only, with separate opt-in.
begin;
alter table public.elan_ai_grants add column if not exists can_read_history boolean not null default false;
create or replace function public.elan_ai_access(p_client text default null,p_name text default null,p_write boolean default false,p_revoke boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not public.elan_direct_access() then raise exception 'Direct account required' using errcode='42501'; end if;
 if p_client is not null then
  if length(p_client) not between 1 and 200 then raise exception 'Invalid client'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  if p_revoke then
   update public.elan_ai_grants set revoked_at=now(),can_read_history=false where user_id=auth.uid() and client_id=p_client;
  else
   if coalesce(length(p_name),0) not between 1 and 200 then raise exception 'Invalid name'; end if;
   insert into public.elan_ai_grants(user_id,client_id,client_name,can_write) values(auth.uid(),p_client,p_name,p_write)
   on conflict(user_id,client_id) do update set client_name=excluded.client_name,can_write=excluded.can_write,granted_at=now(),revoked_at=null,can_read_history=false;
  end if;
  insert into public.elan_access_audit(actor,action,target) values(auth.uid(),case when p_revoke then 'revoke_ai' else 'authorize_ai' end,p_client);
 end if;
 return coalesce((select jsonb_agg(to_jsonb(g)-'user_id' order by granted_at desc) from public.elan_ai_grants g where user_id=auth.uid()),'[]'::jsonb);
end $$;
create or replace function public.elan_ai_history_access(p_client text,p_allow boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.elan_direct_access() then raise exception 'Direct account required' using errcode='42501'; end if;
 if p_allow is null then raise exception 'Choose history access'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 update public.elan_ai_grants set can_read_history=p_allow where user_id=auth.uid() and client_id=p_client and revoked_at is null;
 if not found then raise exception 'Active assistant access required' using errcode='42501'; end if;
 insert into public.elan_access_audit(actor,action,target) values(auth.uid(),case when p_allow then 'allow_ai_history' else 'deny_ai_history' end,p_client);
end $$;
create or replace function public.elan_mcp_history(
 p_user uuid,p_client text,p_iat bigint,p_id text default null,
 p_from date default null,p_to date default null,p_session text default null,p_exercise text default null,
 p_status text default null,p_offset integer default 0,p_limit integer default 20
) returns jsonb language plpgsql security definer set search_path='' as $$
declare g public.elan_ai_grants; items jsonb; total bigint; begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 if exists(select 1 from public.elan_account_status where user_id=p_user and suspended) then raise exception 'Account suspended' using errcode='42501'; end if;
 select * into g from public.elan_ai_grants where user_id=p_user and client_id=p_client;
 if not found or g.revoked_at is not null or p_iat is null or p_iat<floor(extract(epoch from g.granted_at)) or not g.can_read_history then
  raise exception 'History access absent or revoked' using errcode='42501';
 end if;
 if p_limit is null or p_limit<1 or p_limit>50 or p_offset is null or p_offset<0 or p_from>p_to or (p_status is not null and p_status not in ('terminee','abandonnee')) then raise exception 'Invalid history filters'; end if;
 if p_id is not null then
  select payload into items from public.elan_sessions where user_id=p_user and id=p_id and payload->>'_deleted' is distinct from 'true';
  return jsonb_build_object('workout',items);
 end if;
 with filtered as (
  select id,payload from public.elan_sessions s where s.user_id=p_user and s.payload->>'_deleted' is distinct from 'true'
  and (p_from is null or s.payload->>'date'>=p_from::text) and (p_to is null or s.payload->>'date'<=p_to::text)
  and (p_session is null or s.payload->>'seance_id'=p_session)
  and (p_status is null or s.payload->>'statut'=p_status)
  and (p_exercise is null or exists(select 1 from jsonb_array_elements(s.payload->'series') r where r->>'exercice_id'=p_exercise))
 ), page as (select * from filtered order by payload->>'date' desc nulls last,payload->>'heure_debut' desc nulls last,id desc offset p_offset limit p_limit)
 select (select count(*) from filtered),coalesce((select jsonb_agg(payload-'series'-'retours' order by payload->>'date' desc nulls last,payload->>'heure_debut' desc nulls last,id desc) from page),'[]'::jsonb) into total,items;
 return jsonb_build_object('workouts',items,'total',total,'next_offset',case when p_offset+p_limit<total then p_offset+p_limit else null end);
end $$;
revoke all on function public.elan_ai_history_access(text,boolean),public.elan_mcp_history(uuid,text,bigint,text,date,date,text,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.elan_ai_history_access(text,boolean) to authenticated;
grant execute on function public.elan_mcp_history(uuid,text,bigint,text,date,date,text,text,text,integer,integer) to service_role;
commit;
