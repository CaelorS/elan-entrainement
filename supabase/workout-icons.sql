-- Add missing illustrations only. Existing custom choices and all workout data survive.
-- Rules generated from lib/workout-icons.ts; run in one transaction.
begin;
create or replace function pg_temp.elan_infer_icon(model jsonb, catalogue jsonb) returns text language plpgsql as $$
declare rule jsonb; value text; ex jsonb; winner text; hits integer; total integer;
begin
 foreach value in array array[coalesce(model->>'nom',''),coalesce(model->>'sous_titre','')] loop
  value:=translate(lower(value),'àâäéèêëîïôöùûüç','aaaeeeeiioouuuc');
  for rule in select * from jsonb_array_elements('[["triathlon","triathlon"],["morning_routine","matin|morning|reveil"],["full_body","corps entier|full.body"],["upper_body","haut du corps|upper.body"],["lower_body","bas du corps|lower.body|jambes"],["push","poussee|push"],["pull","tirage|pull"],["swimming","natation|nage|swim"],["cycling","cyclisme|velo|cycling"],["running","course|running|jogging"],["crossfit","crossfit|cross.training"],["hiit","hiit|fractionne|intervalles"],["hypertrophy","hypertrophie|hypertrophy"],["balance","equilibre|proprioception"],["recovery","recuperation|recovery"],["stretching","etirement|stretching"],["mobility","mobilite|mobility"],["core","abdos|abdominaux|gainage|core"],["cardio","cardio|endurance"],["strength","force|musculation|renfo|halteres"]]'::jsonb) loop
   if value ~ (rule->>1) then return rule->>0; end if;
  end loop;
 end loop;
 select count(*) into total from jsonb_array_elements(coalesce(model->'exercices','[]')) e join jsonb_array_elements(catalogue) c on c->>'id'=e->>'exercice_id';
 -- Only infer from exercises when a strict majority supports the same category.
 select category,count(*) into winner,hits from (
 select (select r.match_rule->>0 from jsonb_array_elements('[["triathlon","triathlon"],["morning_routine","matin|morning|reveil"],["full_body","corps entier|full.body"],["upper_body","haut du corps|upper.body"],["lower_body","bas du corps|lower.body|jambes"],["push","poussee|push"],["pull","tirage|pull"],["swimming","natation|nage|swim"],["cycling","cyclisme|velo|cycling"],["running","course|running|jogging"],["crossfit","crossfit|cross.training"],["hiit","hiit|fractionne|intervalles"],["hypertrophy","hypertrophie|hypertrophy"],["balance","equilibre|proprioception"],["recovery","recuperation|recovery"],["stretching","etirement|stretching"],["mobility","mobilite|mobility"],["core","abdos|abdominaux|gainage|core"],["cardio","cardio|endurance"],["strength","force|musculation|renfo|halteres"]]'::jsonb) with ordinality r(match_rule,ord)
 where translate(lower(coalesce(c->>'nom','')||' '||coalesce(c->>'categorie','')),'àâäéèêëîïôöùûüç','aaaeeeeiioouuuc') ~ (r.match_rule->>1) order by ord limit 1) category
 from jsonb_array_elements(coalesce(model->'exercices','[]')) e join jsonb_array_elements(catalogue) c on c->>'id'=e->>'exercice_id'
 ) matches where category is not null group by category order by count(*) desc limit 1;
 if hits>total/2.0 then return winner; end if;
 return 'full_body';
end; $$;
do $$
declare account record; before_data jsonb; after_data jsonb; shared jsonb; catalogue jsonb;
begin
 select coalesce(jsonb_agg(payload),'[]') into shared from public.elan_exercises;
 for account in select user_id from public.elan_programs order by user_id loop
  perform pg_advisory_xact_lock(hashtextextended(account.user_id::text,0));
  select payload into before_data from public.elan_programs where user_id=account.user_id for update;
  select coalesce(jsonb_agg(e),'[]') into catalogue from (
    select distinct on (e->>'id') e from (
     select e,0 priority from jsonb_array_elements(coalesce(before_data->'catalogue','[]')) e
     union all select e,1 priority from jsonb_array_elements(shared) e
    ) all_exercises order by e->>'id',priority
  ) definitions;
  select jsonb_set(before_data,'{modeles}',coalesce(jsonb_agg(
   case when coalesce(m->>'icon_id','')<>'' then m else m||jsonb_build_object('icon_id',pg_temp.elan_infer_icon(m,catalogue)) end order by ord),'[]')) into after_data
   from jsonb_array_elements(before_data->'modeles') with ordinality models(m,ord);
  -- Remove only the new field to verify byte-equivalent JSON for all other data.
  if (select jsonb_agg(m-'icon_id' order by ord) from jsonb_array_elements(before_data->'modeles') with ordinality x(m,ord)) is distinct from
     (select jsonb_agg(m-'icon_id' order by ord) from jsonb_array_elements(after_data->'modeles') with ordinality x(m,ord)) then raise exception 'Unexpected session change'; end if;
  if after_data is distinct from before_data then update public.elan_programs set payload=after_data where user_id=account.user_id; end if;
 end loop;
end; $$;
drop function pg_temp.elan_infer_icon(jsonb,jsonb);
commit;
