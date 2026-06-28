-- Brique 3 (ajustement) — filtre d'âge MULTI-tranches.
-- Avant : p_age_min/p_age_max (UNE plage continue). Le filtre UI passe à une
-- multi-sélection de tranches (18–25, 26–35, …, 46+) qui peuvent être DISJOINTES
-- -> on remplace par deux tableaux parallèles p_age_mins[]/p_age_maxs[] et on
-- matche « l'âge tombe dans AU MOINS une des tranches ». (Borne haute ouverte du
-- « 46+ » encodée côté client par une sentinelle, ex. 200 -> pas de NULL en base.)
--
-- La signature change (types des params) -> on DROP l'ancienne version d'abord
-- (sinon Postgres créerait une surcharge en double).
drop function if exists public.find_nearby_people(
  double precision, public.gender[], int, int, uuid[], int, int
);

create or replace function public.find_nearby_people(
  p_radius_km    double precision default null,
  p_genders      public.gender[]  default null,
  p_age_mins     int[]            default null,
  p_age_maxs     int[]            default null,
  p_activity_ids uuid[]           default null,
  p_limit        int              default 50,
  p_offset       int              default 0
)
returns table (
  id             uuid,
  display_name   text,
  avatar_path    text,
  gender         public.gender,
  age            int,
  city_id        uuid,
  distance_m     int,
  activity_ids   uuid[],
  activity_names text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_origin   extensions.geography;
  v_city     uuid;
  v_radius_m double precision := least(coalesce(p_radius_km, 50), 50) * 1000;  -- plafond serveur : 50 km
  v_limit    int := least(coalesce(p_limit, 50), 100);                          -- plafond serveur : 100
  v_offset   int := greatest(coalesce(p_offset, 0), 0);
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
    q.id,
    q.display_name,
    q.avatar_path,
    q.gender,
    q.age,
    q.city_id,
    (round(q.dist_raw / 500.0) * 500)::int as distance_m,
    coalesce(acts.ids,   '{}'::uuid[]) as activity_ids,
    coalesce(acts.names, '{}'::text[]) as activity_names
  from (
    select
      p.id,
      p.display_name,
      p.avatar_path,
      p.gender,
      extract(year from age(p.birth_date))::int as age,
      p.city_id,
      extensions.ST_Distance(
        v_origin,
        extensions.ST_SnapToGrid(p.device_location::extensions.geometry, 0.01)::extensions.geography
      ) as dist_raw
    from public.profiles p
    where p.id <> v_uid
      and p.onboarding_completed is true
      and p.device_location is not null
      and p.city_id = v_city
      and (p_genders is null or p.gender = any(p_genders))
      -- Âge dans AU MOINS une des tranches sélectionnées (NULL = pas de filtre).
      and (
        p_age_mins is null
        or exists (
          select 1
          from unnest(p_age_mins, p_age_maxs) as b(lo, hi)
          where extract(year from age(p.birth_date))::int between b.lo and b.hi
        )
      )
      and (
        p_activity_ids is null
        or exists (
          select 1
          from public.profile_activities pa
          where pa.profile_id = p.id
            and pa.activity_id = any(p_activity_ids)
        )
      )
  ) q
  left join lateral (
    select
      array_agg(a.id   order by a.sort_order) as ids,
      array_agg(a.name order by a.sort_order) as names
    from public.profile_activities pa
    join public.activities a on a.id = pa.activity_id
    where pa.profile_id = q.id
  ) acts on true
  where q.dist_raw <= v_radius_m
  order by q.dist_raw asc
  limit v_limit offset v_offset;
end;
$$;

revoke all on function public.find_nearby_people(
  double precision, public.gender[], int[], int[], uuid[], int, int
) from public;
grant execute on function public.find_nearby_people(
  double precision, public.gender[], int[], int[], uuid[], int, int
) to authenticated;
