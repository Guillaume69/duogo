-- Brique 4 (3/3) — Flag `already_invited` dans le browse.
-- find_nearby_people & get_person renvoient désormais `already_invited` : VRAI quand
-- l'appelant a une invitation PENDING qu'il a ENVOYÉE à cette personne. Sert au badge
-- « Invited » des listes / de la fiche, et à désactiver le bouton « Invite ».
--
-- Sémantique volontairement bornée au sens SORTANT (j'ai invité) — le sens entrant
-- (on m'a invité) relève de l'Inbox (brique 5). Cas limite : si la personne m'a invité,
-- send_invitation est de toute façon bloquée par l'anti-spam (unique_violation), avec un
-- message propre côté client.
--
-- ⚠ On ne peut pas AJOUTER une colonne à un RETURNS TABLE via CREATE OR REPLACE
-- (Postgres refuse le changement de type de retour) -> DROP puis CREATE. La signature
-- des ARGUMENTS ne change pas ; on réaccorde les EXECUTE après recréation.

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ find_nearby_people (+ already_invited)                                     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
drop function if exists public.find_nearby_people(
  double precision, public.gender[], int[], int[], uuid[], int, int
);

create function public.find_nearby_people(
  p_radius_km    double precision default null,
  p_genders      public.gender[]  default null,
  p_age_mins     int[]            default null,
  p_age_maxs     int[]            default null,
  p_activity_ids uuid[]           default null,
  p_limit        int              default 50,
  p_offset       int              default 0
)
returns table (
  id              uuid,
  display_name    text,
  avatar_path     text,
  gender          public.gender,
  age             int,
  city_id         uuid,
  distance_m      int,
  activity_ids    uuid[],
  activity_names  text[],
  already_invited boolean
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
  v_today    date;
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

  -- Date du jour dans le fuseau de MA ville (toutes les lignes renvoyées y sont).
  select (now() at time zone c.timezone)::date
    into v_today
  from public.cities c
  where c.id = v_city;

  return query
  select
    q.id,
    q.display_name,
    q.avatar_path,
    q.gender,
    q.age,
    q.city_id,
    q.dist_m,
    coalesce(acts.ids,   '{}'::uuid[]) as activity_ids,
    coalesce(acts.names, '{}'::text[]) as activity_names,
    q.already_invited
  from (
    select
      p.id,
      p.display_name,
      p.avatar_path,
      p.gender,
      extract(year from age(v_today, p.birth_date))::int as age,
      p.city_id,
      public.snapped_distance_m(v_origin, p.device_location) as dist_m,
      -- Invitation PENDING que J'AI envoyée à cette personne (sens sortant).
      exists (
        select 1
        from public.invitations inv
        where inv.sender_id = v_uid
          and inv.recipient_id = p.id
          and inv.status = 'pending'
      ) as already_invited
    from public.profiles p
    where p.id <> v_uid
      and p.onboarding_completed is true
      and p.device_location is not null
      and p.city_id = v_city
      -- Pré-filtre INDEXÉ (GiST) : superset sûr (marge 1,5 km > écart max du snap).
      and extensions.ST_DWithin(p.device_location, v_origin, v_radius_m + 1500)
      and (p_genders is null or p.gender = any(p_genders))
      and (
        p_age_mins is null
        or exists (
          select 1
          from unnest(p_age_mins, p_age_maxs) as b(lo, hi)
          where extract(year from age(v_today, p.birth_date))::int between b.lo and b.hi
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
  where q.dist_m <= v_radius_m
  order by q.dist_m asc, q.id asc
  limit v_limit offset v_offset;
end;
$$;

revoke all on function public.find_nearby_people(
  double precision, public.gender[], int[], int[], uuid[], int, int
) from public;
grant execute on function public.find_nearby_people(
  double precision, public.gender[], int[], int[], uuid[], int, int
) to authenticated;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ get_person (+ already_invited)                                             ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
drop function if exists public.get_person(uuid);

create function public.get_person(p_id uuid)
returns table (
  id              uuid,
  display_name    text,
  avatar_path     text,
  gender          public.gender,
  age             int,
  city_id         uuid,
  distance_m      int,
  bio             text,
  activity_ids    uuid[],
  activity_names  text[],
  already_invited boolean
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
  v_today  date;
begin
  select p.device_location, p.city_id
    into v_origin, v_city
  from public.profiles p
  where p.id = v_uid;

  if v_origin is null or v_city is null then
    return;
  end if;

  select (now() at time zone c.timezone)::date
    into v_today
  from public.cities c
  where c.id = v_city;

  return query
  select
    p.id,
    p.display_name,
    p.avatar_path,
    p.gender,
    extract(year from age(v_today, p.birth_date))::int as age,
    p.city_id,
    public.snapped_distance_m(v_origin, p.device_location) as distance_m,
    p.bio,
    coalesce(acts.ids,   '{}'::uuid[]) as activity_ids,
    coalesce(acts.names, '{}'::text[]) as activity_names,
    exists (
      select 1
      from public.invitations inv
      where inv.sender_id = v_uid
        and inv.recipient_id = p.id
        and inv.status = 'pending'
    ) as already_invited
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
