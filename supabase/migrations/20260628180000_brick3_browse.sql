-- Brique 3 — Backend « Browse People ».
--   (0) Simplification position : on SUPPRIME search_location. En V1 la position
--       est « ma dernière position GPS connue » (device_location), rafraîchie
--       automatiquement à l'usage. Le champ search_location (prévu pour un futur
--       « chercher ailleurs » premium) n'existe pas côté produit et créait de la
--       confusion -> YAGNI, on l'enlève ; on le réintroduira si le besoin émerge.
--   (A) RPC find_nearby_people : liste intra-ville, filtrable, triée par distance.
--       JAMAIS de coordonnées en sortie — seulement une distance GROSSIÈRE.
--   (B) Durcissement « DOB exacte » (différé de la brique 2) : on coupe la lecture
--       DIRECTE de birth_date par PostgREST et on la redonne UNIQUEMENT à son
--       propriétaire via une RPC `security definer`.
--   (C) set_my_location : écrit la position unique (device_location), valide lat/lng.

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ (0) Position unique : drop search_location, index GiST sur device_location  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- DROP COLUMN supprime AUSSI automatiquement l'index profiles_search_location_gist
-- qui en dépendait (pas besoin de le dropper à la main). device_location reste
-- masquée au client (jamais dans un GRANT SELECT) ; seule la RPC la lit/l'écrit.
alter table public.profiles drop column search_location;

-- Index spatial pour le filtre rayon (ST_DWithin) du browse, sur la position unique.
create index profiles_device_location_gist on public.profiles using gist (device_location);

-- Index B-tree sur le filtre d'égalité principal (city_id), systématique au browse.
create index profiles_city_id_idx on public.profiles (city_id);


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ (A) RPC public.find_nearby_people                                          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- `security definer` : la fonction lit device_location / city_id (que l'appelant
-- n'a PAS le droit de lire en direct) pour CALCULER une distance, et ne renvoie
-- que cette distance — jamais les coordonnées. `search_path = ''` -> tout est
-- schéma-qualifié (public.*, extensions.ST_*). Les built-ins (age, extract, round,
-- coalesce, array_agg, any, least…) viennent de pg_catalog (toujours dans le path).
--
-- ⚠️ ANTI-TRILATÉRATION. Renvoyer une distance au mètre près transformerait la
-- fonction en oracle de position : l'appelant CONTRÔLE sa propre origine
-- (set_my_location accepte des coordonnées arbitraires), donc 3 mesures depuis 3
-- points connus suffiraient à résoudre la position exacte d'une cible. Parade :
-- on SNAPPE d'abord la position de la cible sur une grille ~1 km (0.01° ≈ 1.1 km
-- à cette latitude) -> la distance pointe vers le CENTRE de cellule. Peu importe
-- le nombre de mesures, un attaquant ne reconstitue jamais plus fin que la cellule
-- (~1 km). La sortie est en plus arrondie à 500 m. La position de l'appelant
-- (v_origin) reste exacte : on ne protège que la position d'AUTRUI.
--
-- ⚠️ RLS. `security definer` COURT-CIRCUITE la RLS de public.profiles : le WHERE
-- ci-dessous est le SEUL filtre de visibilité par ligne. Toute règle future
-- (users bloqués, profils masqués — brique 4+) DOIT être ajoutée ICI, pas en RLS
-- (qui serait silencieusement ignorée par cette fonction).
--
-- NOTE BRIQUE 4 : la table public.invitations n'existe pas encore -> on N'AJOUTE
-- PAS de flag already_invited ici (référencer une table absente casserait la
-- migration). En brique 4 -> CREATE OR REPLACE pour le brancher via un LEFT JOIN.
create or replace function public.find_nearby_people(
  p_radius_km    double precision default null,
  p_genders      public.gender[]  default null,
  p_age_min      int              default null,
  p_age_max      int              default null,
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
  -- Position + ville de l'appelant. (Le GPS est lisible ICI car `security
  -- definer` ; il ne ressort JAMAIS de la fonction.)
  select p.device_location, p.city_id
    into v_origin, v_city
  from public.profiles p
  where p.id = v_uid;

  -- Appelant non géolocalisé ou hors zone seedée -> rien à comparer : 0 résultat.
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
    -- Arrondi 500 m (sur une distance déjà snappée à la cellule ~1 km).
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
      -- Distance vers la position de la cible SNAPPÉE sur la grille ~1 km.
      -- Calculée UNE seule fois ici (réutilisée pour le filtre rayon et le tri).
      extensions.ST_Distance(
        v_origin,
        extensions.ST_SnapToGrid(p.device_location::extensions.geometry, 0.01)::extensions.geography
      ) as dist_raw
    from public.profiles p
    where p.id <> v_uid                    -- exclut l'appelant
      and p.onboarding_completed is true   -- profils découvrables uniquement
      -- REQUIS (et NON redondant : device_location ne fait PAS partie de
      -- onboarding_completed) — sinon distance vers NULL -> lignes fantômes.
      and p.device_location is not null
      and p.city_id = v_city               -- même ville (matching intra-ville)
      -- Filtres optionnels : NULL = pas de filtre.
      and (p_genders is null or p.gender = any(p_genders))
      and (p_age_min is null or extract(year from age(p.birth_date))::int >= p_age_min)
      and (p_age_max is null or extract(year from age(p.birth_date))::int <= p_age_max)
      and (
        p_activity_ids is null
        or exists (                        -- « au moins une » des activités demandées
          select 1
          from public.profile_activities pa
          where pa.profile_id = p.id
            and pa.activity_id = any(p_activity_ids)
        )
      )
  ) q
  -- Activités de la cible (ids + names ordonnés par sort_order) pour les chips,
  -- agrégées en une passe (pas de N+1, pas de doublons de lignes).
  left join lateral (
    select
      array_agg(a.id   order by a.sort_order) as ids,
      array_agg(a.name order by a.sort_order) as names
    from public.profile_activities pa
    join public.activities a on a.id = pa.activity_id
    where pa.profile_id = q.id
  ) acts on true
  where q.dist_raw <= v_radius_m           -- borne de rayon (plafonnée à 50 km)
  order by q.dist_raw asc                   -- tri par distance (calculée une seule fois)
  limit v_limit offset v_offset;
end;
$$;

revoke all on function public.find_nearby_people(
  double precision, public.gender[], int, int, uuid[], int, int
) from public;
grant execute on function public.find_nearby_people(
  double precision, public.gender[], int, int, uuid[], int, int
) to authenticated;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ (B) Durcissement « DOB exacte »                                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Problème : la brique 2 a accordé `select (… birth_date …)` au rôle authenticated
-- et la RLS de SELECT est `using (true)` -> N'IMPORTE QUEL user lit la date de
-- naissance EXACTE de tous les autres. La RLS filtre des LIGNES, pas des colonnes ;
-- un GRANT colonne est tout-ou-rien sur les lignes -> impossible de « lire MA
-- birth_date mais pas celle des autres » avec un seul GRANT.
--
-- Solution : COUPER la lecture directe de la colonne pour tout le monde, et la
-- redonner UNIQUEMENT à son propriétaire via une RPC `security definer`. (Le browse
-- n'expose que l'ÂGE en années, jamais la date — cf. (A).) L'écriture de birth_date
-- (grants insert/update colonne, contrainte ≥ 18 ans) reste inchangée : l'utilisateur
-- édite toujours sa propre date.
revoke select (birth_date) on public.profiles from authenticated;

-- Profil COMPLET de l'appelant (birth_date incluse), SANS le GPS. On NE renvoie
-- PAS `setof public.profiles` (qui ré-exposerait device_location) : on liste
-- explicitement les colonnes visibles du client + birth_date.
create or replace function public.get_my_profile()
returns table (
  id                   uuid,
  display_name         text,
  bio                  text,
  gender               public.gender,
  birth_date           date,
  avatar_path          text,
  city_id              uuid,
  onboarding_completed boolean,
  created_at           timestamptz,
  updated_at           timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id, p.display_name, p.bio, p.gender, p.birth_date, p.avatar_path,
    p.city_id, p.onboarding_completed, p.created_at, p.updated_at
  from public.profiles p
  where p.id = (select auth.uid());
$$;

revoke all on function public.get_my_profile() from public;
grant execute on function public.get_my_profile() to authenticated;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ (C) set_my_location : position unique + validation des bornes lat/lng       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- V1 : la position « me suit » -> on écrase device_location à chaque capture (plus
-- de search_location, plus de coalesce). Validation des bornes en amont (coords
-- client = non fiables). Signature inchangée (CREATE OR REPLACE conserve les GRANTs).
create or replace function public.set_my_location(
  p_lat double precision,
  p_lng double precision
)
returns table (matched_city_id uuid, matched_city_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_point extensions.geography;
  v_city  public.cities;
begin
  if p_lat is null or p_lng is null
     or p_lat < -90  or p_lat > 90
     or p_lng < -180 or p_lng > 180 then
    raise exception 'invalid coordinates: lat=%, lng=%', p_lat, p_lng
      using errcode = '22023';  -- invalid_parameter_value
  end if;

  v_point := extensions.ST_SetSRID(extensions.ST_MakePoint(p_lng, p_lat), 4326)::extensions.geography;

  -- Ville seedée la plus proche dans un rayon de 50 km (sinon hors zone -> NULL).
  select c.* into v_city
  from public.cities c
  where extensions.ST_DWithin(c.center, v_point, 50000)
  order by extensions.ST_Distance(c.center, v_point)
  limit 1;

  update public.profiles p
     set device_location = v_point,    -- position unique, toujours rafraîchie
         city_id = v_city.id           -- NULL si hors zone seedée
   where p.id = (select auth.uid());

  matched_city_id := v_city.id;
  matched_city_name := v_city.name;
  return next;
end;
$$;
