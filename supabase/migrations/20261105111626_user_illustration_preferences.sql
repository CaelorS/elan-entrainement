-- Personal details remain private to the directly connected account, never MCP.
create table public.elan_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 gender text not null default 'unspecified' check (gender in ('male','female','other','unspecified')),
 illustration_gender text not null default 'mixed' check (illustration_gender in ('male','female','mixed'))
);
alter table public.elan_profiles enable row level security;
revoke all on public.elan_profiles from public, anon, authenticated;
grant select on public.elan_profiles to authenticated;
grant update (gender, illustration_gender) on public.elan_profiles to authenticated;
grant all on public.elan_profiles to service_role;
create policy own_profile on public.elan_profiles for select to authenticated
 using (user_id=auth.uid() and public.elan_direct_access());
create policy update_own_profile on public.elan_profiles for update to authenticated
 using (user_id=auth.uid() and public.elan_direct_access())
 with check (user_id=auth.uid() and public.elan_direct_access());

create schema if not exists private;
create function private.elan_create_profile() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.elan_profiles(user_id,gender)
 values (new.id, case when new.raw_user_meta_data->>'gender' in ('male','female','other')
 then new.raw_user_meta_data->>'gender' else 'unspecified' end);
 return new;
end;
$$;
revoke all on function private.elan_create_profile() from public, anon, authenticated;
create trigger elan_create_profile after insert on auth.users
 for each row execute function private.elan_create_profile();
insert into public.elan_profiles(user_id) select id from auth.users;
