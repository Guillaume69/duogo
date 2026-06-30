-- Brique 5 (5/5) — Flags « tour » dans le browse (dette brique 4).
-- En brique 4, find_nearby_people/get_person n'exposaient que `already_invited` (sens
-- SORTANT : j'ai invité). On expose désormais aussi le sens ENTRANT pour ne plus afficher
-- un bouton « Invite » qui échouerait (l'autre m'a déjà invité), mais « it's your turn ».
--
-- Pour chaque personne, on regarde l'invitation ACTIVE entre nous (au plus une, garantie
-- par l'index anti-spam élargi) et qui doit répondre :
--   • already_invited  = active & c'est à L'AUTRE de répondre (j'attends sa réponse).
--   • invited_by_them  = active & c'est à MOI de répondre (mon tour).
-- get_person ajoute en plus `active_invitation_id` pour pouvoir ouvrir la fiche invitation.
--
-- ⚠ Ajout de colonnes au RETURNS TABLE -> DROP puis CREATE (Postgres refuse le changement
-- de type de retour via CREATE OR REPLACE). Signature des ARGUMENTS inchangée ; on
-- réaccorde les EXECUTE après recréation.

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ find_nearby_people (+ invited_by_them)                                      ║
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
  already_invited boolean,
  invited_by_them boolean
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
    coalesce(act.awaiting = q.id,  false) as already_invited,
    coalesce(act.awaiting = v_uid, false) as invited_by_them
  from (
    select
      p.id,
      p.display_name,
      p.avatar_path,
      p.gender,
      extract(year from age(v_today, p.birth_date))::int as age,
      p.city_id,
      public.snapped_distance_m(v_origin, p.device_location) as dist_m
    from public.profiles p
    where p.id <> v_uid
      and p.onboarding_completed is true
      and p.device_location is not null
      and p.city_id = v_city
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
  -- Invitation ACTIVE entre nous (paire non ordonnée = clé de l'index anti-spam) + qui
  -- doit répondre. Au plus une ligne (unicité de la paire active).
  left join lateral (
    select inv.awaiting_response_from as awaiting
    from public.invitations inv
    where inv.status in ('pending', 'changes_requested')
      and least(inv.sender_id, inv.recipient_id)    = least(v_uid, q.id)
      and greatest(inv.sender_id, inv.recipient_id) = greatest(v_uid, q.id)
    limit 1
  ) act on true
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
-- ║ get_person (+ invited_by_them + active_invitation_id)                       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
drop function if exists public.get_person(uuid);

create function public.get_person(p_id uuid)
returns table (
  id                  uuid,
  display_name        text,
  avatar_path         text,
  gender              public.gender,
  age                 int,
  city_id             uuid,
  distance_m          int,
  bio                 text,
  activity_ids        uuid[],
  activity_names      text[],
  already_invited     boolean,
  invited_by_them     boolean,
  active_invitation_id uuid
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
    coalesce(act.awaiting = p.id,  false) as already_invited,
    coalesce(act.awaiting = v_uid, false) as invited_by_them,
    act.inv_id as active_invitation_id
  from public.profiles p
  left join lateral (
    select
      array_agg(a.id   order by a.sort_order) as ids,
      array_agg(a.name order by a.sort_order) as names
    from public.profile_activities pa
    join public.activities a on a.id = pa.activity_id
    where pa.profile_id = p.id
  ) acts on true
  left join lateral (
    select inv.id as inv_id, inv.awaiting_response_from as awaiting
    from public.invitations inv
    where inv.status in ('pending', 'changes_requested')
      and least(inv.sender_id, inv.recipient_id)    = least(v_uid, p.id)
      and greatest(inv.sender_id, inv.recipient_id) = greatest(v_uid, p.id)
    limit 1
  ) act on true
  where p.id = p_id
    and p.id <> v_uid
    and p.onboarding_completed is true
    and p.device_location is not null
    and p.city_id = v_city;
end;
$$;

revoke all on function public.get_person(uuid) from public;
grant execute on function public.get_person(uuid) to authenticated;
