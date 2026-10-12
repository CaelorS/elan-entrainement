-- Administrative consultation only. No user is granted admin by this migration.
begin;
create table if not exists public.elan_admins (
 user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.elan_admins enable row level security;
revoke all on public.elan_admins from public,anon,authenticated;
create table if not exists public.elan_admin_views (
 id bigint generated always as identity primary key,
 actor uuid not null,
 target uuid not null,
 viewed_at timestamptz not null default now()
);
alter table public.elan_admin_views enable row level security;
revoke all on public.elan_admin_views from public,anon,authenticated;
create or replace function public.elan_is_admin() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.elan_admins where user_id=auth.uid());
$$;
create or replace function public.elan_admin_users() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not public.elan_is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'email',email) order by email) from auth.users),'[]'::jsonb);
end;
$$;
create or replace function public.elan_admin_view(p_user_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not public.elan_is_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'Unknown user'; end if;
 insert into public.elan_admin_views(actor,target) values(auth.uid(),p_user_id);
 return jsonb_build_object(
  'program',(select payload from public.elan_programs where user_id=p_user_id),
  'revision',coalesce((select revision from public.elan_programs where user_id=p_user_id),0),
  'conflict',false,
  'catalogue',coalesce((select jsonb_agg(payload order by id) from public.elan_exercises),'[]'::jsonb),
  'sessions',coalesce((select jsonb_agg(payload order by payload->>'heure_debut' desc) from public.elan_sessions where user_id=p_user_id and payload->>'_deleted' is distinct from 'true'),'[]'::jsonb),
  'runs',coalesce((select jsonb_agg(payload) from public.elan_runs where user_id=p_user_id),'[]'::jsonb));
end;
$$;
revoke all on function public.elan_is_admin(),public.elan_admin_users(),public.elan_admin_view(uuid) from public,anon,authenticated;
grant execute on function public.elan_is_admin(),public.elan_admin_users(),public.elan_admin_view(uuid) to authenticated;
commit;
