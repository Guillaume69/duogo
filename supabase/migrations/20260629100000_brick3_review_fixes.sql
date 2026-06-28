-- Brique 3 (revue) — corrections issues de la code-review :
--   (#5)  age() calculé en UTC alors que les villes sont locales (Khon Kaen = UTC+7)
--         -> âge faux ~7 h/nuit. On ajoute cities.timezone et on calcule l'âge dans
--         le fuseau de la ville (affichage ET filtre).
--   (#6)  le filtre rayon portait sur la distance SNAPPÉE (anti-trilatération) calculée
--         par ligne -> aucun index spatial utilisable -> scan complet de la ville. On
--         GARDE le filtre snappé (sinon binary-search sur le rayon = oracle de position)
--         et on AJOUTE un pré-filtre ST_DWithin élargi qui, lui, utilise l'index GiST.
--   (#11) la formule anti-trilatération (snap 0.01° + arrondi 500 m) était COPIÉE dans
--         find_nearby_people et get_person -> on l'extrait dans un helper unique.

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ (#5) Fuseau horaire par ville                                              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- IANA tz (ex. 'Asia/Bangkok'). Défaut = la ville seedée du MVP. Multi-ville : chaque
-- nouvelle ville pose le sien. La colonne est couverte par le GRANT SELECT de table.
alter table public.cities
  add column timezone text not null default 'Asia/Bangkok';

comment on column public.cities.timezone is
  'Fuseau IANA de la ville ; sert à calculer l''âge en date LOCALE (pas UTC).';

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ (#11) Helper unique : distance anti-trilatération                          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- SOURCE UNIQUE de la formule sensible : on snappe la cible sur une grille ~1 km
-- (0.01° ≈ 1.1 km) AVANT de mesurer, puis on arrondit à 500 m. Garantit qu'un appelant
-- ne reconstitue jamais la position d'autrui plus fin que la cellule. `immutable` :
-- pur calcul sur les arguments (aucune lecture de table). search_path='' -> qualifié.
create or replace function public.snapped_distance_m(
  p_origin extensions.geography,
  p_target extensions.geography
)
returns int
language sql
immutable
set search_path = ''
as $$
  select (round(extensions.ST_Distance(
    p_origin,
    extensions.ST_SnapToGrid(p_target::extensions.geometry, 0.01)::extensions.geography
  ) / 500.0) * 500)::int;
$$;

-- Helper interne : appelé uniquement DEPUIS les RPC security definer (qui s'exécutent
-- en tant que propriétaire) -> pas besoin de l'exposer aux clients.
revoke all on function public.snapped_distance_m(
  extensions.geography, extensions.geography
) from public;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ (#5 + #6 + #11) find_nearby_people                                         ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- CREATE OR REPLACE (même signature array-âge qu'en 20260628181000) : conserve les
-- GRANT existants. Changements : âge en date locale (v_today), distance via le helper,
-- et pré-filtre ST_DWithin élargi (index GiST) en plus du filtre snappé (sécurité).
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
    coalesce(acts.names, '{}'::text[]) as activity_names
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
      -- Pré-filtre INDEXÉ (GiST) : superset sûr. La distance snappée s'écarte de la
      -- réelle d'au plus ~0,8 km (demi-diagonale de cellule) + 250 m d'arrondi ->
      -- marge 1,5 km : ne peut JAMAIS exclure une ligne que le filtre snappé garderait.
      and extensions.ST_DWithin(p.device_location, v_origin, v_radius_m + 1500)
      and (p_genders is null or p.gender = any(p_genders))
      -- Âge (date LOCALE) dans AU MOINS une des tranches (NULL = pas de filtre).
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
  -- Filtre AUTORITATIF sur la distance snappée (frontière grossière = anti-oracle).
  -- Tri secondaire par id : pagination stable malgré les ex æquo de bucket 500 m.
  where q.dist_m <= v_radius_m
  order by q.dist_m asc, q.id asc
  limit v_limit offset v_offset;
end;
$$;

-- Réaffirme les droits (no-op si déjà en place ; explicite pour la traçabilité).
revoke all on function public.find_nearby_people(
  double precision, public.gender[], int[], int[], uuid[], int, int
) from public;
grant execute on function public.find_nearby_people(
  double precision, public.gender[], int[], int[], uuid[], int, int
) to authenticated;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ (#5 + #11) get_person                                                      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Même garanties ; âge en date locale + distance via le helper partagé. Le WHERE de
-- visibilité reste le SEUL filtre par ligne (security definer court-circuite la RLS) ;
-- toute règle future (bloqués/masqués — brique 4+) DOIT être ajoutée ici ET dans
-- find_nearby_people (la frontière de confiance n'est pas encore factorisée).
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
