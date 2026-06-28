-- Brique 3 (suite) — RPC get_person : fiche détail d'une personne.
-- Mêmes garanties que find_nearby_people : âge JAMAIS la date, distance GROSSIÈRE
-- (snap ~1 km + arrondi 500 m), JAMAIS de coordonnées. Ajoute la `bio`. security
-- definer + search_path=''. Renvoie 0 ligne si la personne n'est pas visible pour
-- l'appelant (autre ville, non découvrable, ou soi-même) -> l'écran montre « indispo ».
--
-- ⚠️ RLS : security definer COURT-CIRCUITE la RLS ; le WHERE ci-dessous est le seul
-- filtre de visibilité. Toute règle future (bloqués/masqués — brique 4+) va ICI.
create or replace function public.get_person(p_id uuid)
returns table (
  id             uuid,
  display_name   text,
  avatar_path    text,
  gender         public.gender,
  age            int,
  city_id        uuid,
  distance_m     int,
  bio            text,
  activity_ids   uuid[],
  activity_names text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_origin extensions.geography;
  v_city   uuid;
begin
  select p.device_location, p.city_id
    into v_origin, v_city
  from public.profiles p
  where p.id = v_uid;

  if v_origin is null or v_city is null then
    return;
  end if;

  return query
  select
    p.id,
    p.display_name,
    p.avatar_path,
    p.gender,
    extract(year from age(p.birth_date))::int as age,
    p.city_id,
    (round(extensions.ST_Distance(
      v_origin,
      extensions.ST_SnapToGrid(p.device_location::extensions.geometry, 0.01)::extensions.geography
    ) / 500.0) * 500)::int as distance_m,
    p.bio,
    coalesce(acts.ids,   '{}'::uuid[]) as activity_ids,
    coalesce(acts.names, '{}'::text[]) as activity_names
  from public.profiles p
  left join lateral (
    select
      array_agg(a.id   order by a.sort_order) as ids,
      array_agg(a.name order by a.sort_order) as names
    from public.profile_activities pa
    join public.activities a on a.id = pa.activity_id
    where pa.profile_id = p.id
  ) acts on true
  where p.id = p_id
    and p.id <> v_uid                    -- pas soi-même
    and p.onboarding_completed is true   -- découvrable seulement
    and p.device_location is not null
    and p.city_id = v_city;              -- même ville que l'appelant
end;
$$;

revoke all on function public.get_person(uuid) from public;
grant execute on function public.get_person(uuid) to authenticated;
