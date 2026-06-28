-- Brique 2 — Enrichissement du profil + géoloc (avec masquage GPS strict).

-- 1. Colonnes riches -------------------------------------------------------
alter table public.profiles
  add column bio text
    check (bio is null or char_length(bio) <= 500),
  add column gender public.gender,
  -- ≥ 18 ans à la saisie. `current_date` n'est pas immuable mais le seuil ne fait
  -- qu'avancer dans le temps (date de naissance fixe) -> une ligne valide le reste.
  add column birth_date date
    check (birth_date is null or birth_date <= (current_date - interval '18 years')),
  add column avatar_path text,
  add column city_id uuid references public.cities (id),
  -- Position GPS réelle (vérité du device) et position de recherche (= device par
  -- défaut ; un premium pourra la déplacer). geography(point,4326) -> mètres.
  -- ⚠ JAMAIS renvoyées au client : masquées par GRANT colonne (cf. §4).
  add column device_location extensions.geography(point, 4326),
  add column search_location extensions.geography(point, 4326);

-- 2. Drapeau « profil découvrable » (colonne générée) ----------------------
-- Dérivé : vrai quand l'identité minimale pour le matching est complète. Sert de
-- filtre au browse (brique 3). L'ENTRÉE dans l'app reste gardée sur display_name seul.
alter table public.profiles
  add column onboarding_completed boolean
    generated always as (
      display_name is not null
      and gender is not null
      and birth_date is not null
      and city_id is not null
    ) stored;

-- 3. Index spatial : matching « gens proches » sur la position de recherche.
create index profiles_search_location_gist on public.profiles using gist (search_location);

-- 4. Masquage GPS : GRANT colonne -----------------------------------------
-- La brique 1 avait accordé select/insert/update au niveau TABLE (toutes colonnes).
-- On le retire et on re-grant colonne par colonne en EXCLUANT le GPS : la RLS filtre
-- des LIGNES, pas des colonnes — c'est le GRANT colonne qui interdit de LIRE le GPS.
-- Conséquence côté client : ne plus jamais faire `select *` sur profiles.
revoke select, insert, update on public.profiles from authenticated;

-- Lecture : tout SAUF device_location / search_location.
grant select (
  id, display_name, bio, gender, birth_date, avatar_path,
  city_id, onboarding_completed, created_at, updated_at
) on public.profiles to authenticated;

-- Écriture directe : seulement les champs éditables par l'utilisateur.
-- city_id est DÉRIVÉ et le GPS s'écrit via la RPC -> non accordés ici.
grant insert (id, display_name, bio, gender, birth_date, avatar_path)
  on public.profiles to authenticated;
grant update (display_name, bio, gender, birth_date, avatar_path)
  on public.profiles to authenticated;

-- 5. RPC set_my_location ---------------------------------------------------
-- Écrit la position (device + search par défaut) et DÉRIVE city_id par jointure
-- spatiale, le tout côté serveur. `security definer` : écrit les colonnes GPS que
-- l'appelant n'a pas le droit d'écrire, et ne RENVOIE QUE { city_id, city_name } —
-- jamais les coordonnées. `search_path = ''` -> tout est schéma-qualifié.
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
  v_point extensions.geography :=
    extensions.ST_SetSRID(extensions.ST_MakePoint(p_lng, p_lat), 4326)::extensions.geography;
  v_city public.cities;
begin
  -- Ville seedée la plus proche dans un rayon de 50 km (sinon hors zone -> NULL).
  select c.* into v_city
  from public.cities c
  where extensions.ST_DWithin(c.center, v_point, 50000)
  order by extensions.ST_Distance(c.center, v_point)
  limit 1;

  update public.profiles p
     set device_location = v_point,
         -- ne réécrase pas une éventuelle position de recherche déjà posée.
         search_location = coalesce(p.search_location, v_point),
         city_id = v_city.id        -- NULL si hors zone seedée
   where p.id = (select auth.uid());

  matched_city_id := v_city.id;
  matched_city_name := v_city.name;
  return next;
end;
$$;

-- Exécution réservée aux authentifiés (la fonction se borne via auth.uid()).
revoke all on function public.set_my_location(double precision, double precision) from public;
grant execute on function public.set_my_location(double precision, double precision) to authenticated;
