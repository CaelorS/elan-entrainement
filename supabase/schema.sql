-- Run once in the SQL Editor of your Supabase project. No personal data here.
begin;
create table if not exists public.elan_programs (
 user_id uuid primary key references auth.users(id) on delete cascade,
 payload jsonb not null,
 revision bigint not null default 1,
 updated_at timestamptz not null default now()
);
create table if not exists public.elan_sessions (
 user_id uuid not null references auth.users(id) on delete cascade,
 id text not null,
 payload jsonb not null,
 primary key(user_id,id)
);
create table if not exists public.elan_runs (
 user_id uuid not null references auth.users(id) on delete cascade,
 id text not null,
 payload jsonb not null,
 primary key(user_id,id)
);
alter table public.elan_programs enable row level security;
alter table public.elan_sessions enable row level security;
alter table public.elan_runs enable row level security;
drop policy if exists owner_access on public.elan_programs;
create policy owner_access on public.elan_programs for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists owner_access on public.elan_sessions;
create policy owner_access on public.elan_sessions for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists owner_access on public.elan_runs;
create policy owner_access on public.elan_runs for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
revoke all on public.elan_programs,public.elan_sessions,public.elan_runs from anon,authenticated;
grant select,insert,update on public.elan_programs,public.elan_sessions,public.elan_runs to authenticated;

create or replace function public.elan_program_revision() returns trigger language plpgsql set search_path='' as $$
begin new.revision:=old.revision+1;new.updated_at:=now();return new;end;
$$;
drop trigger if exists elan_program_revision on public.elan_programs;
create trigger elan_program_revision before update on public.elan_programs for each row execute function public.elan_program_revision();

create or replace function public.elan_sync(
 p_program jsonb default null,
 p_revision bigint default 0,
 p_sessions jsonb default '[]'::jsonb,
 p_runs jsonb default '[]'::jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
 owner_id uuid := auth.uid();
 current_revision bigint;
 current_program jsonb;
 conflict boolean := false;
 item jsonb;
begin
 if owner_id is null then raise exception 'Authentication required'; end if;
 -- Serialize writes from this account, including the first insert.
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text,0));
 select revision,payload into current_revision,current_program from public.elan_programs where user_id=owner_id;
 current_revision := coalesce(current_revision,0);
 if p_program is not null then
  if jsonb_typeof(p_program->'catalogue') is distinct from 'array' or jsonb_typeof(p_program->'modeles') is distinct from 'array' then raise exception 'Invalid programme'; end if;
  if p_revision <> current_revision then
   -- Retrying the same accepted write after a lost network response is harmless.
   conflict := p_program is distinct from current_program;
  else
   insert into public.elan_programs(user_id,payload,revision) values(owner_id,p_program,current_revision+1)
    on conflict(user_id) do update set payload=excluded.payload,revision=excluded.revision,updated_at=now();
   current_revision := current_revision+1;
   current_program := p_program;
  end if;
 end if;
 if jsonb_typeof(p_sessions) <> 'array' or jsonb_typeof(p_runs) <> 'array' then raise exception 'Invalid history'; end if;
 for item in select value from jsonb_array_elements(p_sessions) loop
  if coalesce(item->>'seance_uuid','')='' or jsonb_typeof(item->'series') is distinct from 'array' then raise exception 'Invalid session'; end if;
  insert into public.elan_sessions(user_id,id,payload) values(owner_id,item->>'seance_uuid',item)
   on conflict(user_id,id) do update set payload=excluded.payload;
 end loop;
 for item in select value from jsonb_array_elements(p_runs) loop
  if coalesce(item->>'uuid','')='' then raise exception 'Invalid run'; end if;
  insert into public.elan_runs(user_id,id,payload) values(owner_id,item->>'uuid',item)
   on conflict(user_id,id) do update set payload=excluded.payload;
 end loop;
 return jsonb_build_object('program',current_program,'revision',current_revision,'conflict',conflict,
  'sessions',coalesce((select jsonb_agg(payload order by payload->>'heure_debut' desc) from public.elan_sessions where user_id=owner_id),'[]'::jsonb),
  'runs',coalesce((select jsonb_agg(payload) from public.elan_runs where user_id=owner_id),'[]'::jsonb));
end;
$$;
revoke all on function public.elan_sync(jsonb,bigint,jsonb,jsonb) from public,anon;
grant execute on function public.elan_sync(jsonb,bigint,jsonb,jsonb) to authenticated;
commit;
