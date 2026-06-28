-- Brique 2 — Référentiels géo & activités.
-- Tables de RÉFÉRENCE (seedées, lecture seule côté client) : villes et catalogue
-- d'activités, + la liaison N-N profil <-> activités (centres d'intérêt).

-- 1. cities ----------------------------------------------------------------
-- Référentiel des villes. Archi multi-ville DÈS le départ (FK city_id partout) ;
-- le MVP n'en seede qu'une. `center` (geography) sert à rattacher un GPS à la
-- ville la plus proche (cf. RPC set_my_location, migration profils).
create table public.cities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  -- ISO 3166-1 alpha-2 (ex. 'FR'). Borné à 2 caractères.
  country_code text not null check (char_length(country_code) = 2),
  center extensions.geography(point, 4326) not null,
  created_at timestamptz not null default now()
);

comment on table public.cities is
  'Référentiel des villes (seedé). Matching intra-ville via city_id ; center = point pour rattacher un GPS.';

-- Index spatial : rattachement GPS -> ville (ST_DWithin/ST_Distance).
create index cities_center_gist on public.cities using gist (center);

alter table public.cities enable row level security;

-- Lecture seule pour les authentifiés ; aucune écriture client (table seedée).
create policy "Cities are readable by authenticated users"
  on public.cities for select to authenticated using (true);

grant select on public.cities to authenticated;
grant all on public.cities to service_role;

-- Seed : 1 ville pour le MVP (archi multi-ville prête). À CHANGER si besoin —
-- center = ST_MakePoint(longitude, latitude) (lng EN PREMIER), SRID 4326.
insert into public.cities (name, slug, country_code, center)
values (
  'Khon Kaen', 'khon-kaen', 'TH',
  extensions.ST_SetSRID(extensions.ST_MakePoint(102.8360, 16.4419), 4326)::extensions.geography
);

-- 2. activities ------------------------------------------------------------
-- Catalogue d'activités (seedé). Sert aux centres d'intérêt du profil et à la
-- découverte (briques 3 & 7). `sort_order` fige l'ordre d'affichage.
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.activities is
  'Catalogue d''activités (seedé). Intérêts du profil + surface de découverte.';

alter table public.activities enable row level security;

create policy "Activities are readable by authenticated users"
  on public.activities for select to authenticated using (true);

grant select on public.activities to authenticated;
grant all on public.activities to service_role;

-- Seed : un petit panel d'activités pour démarrer (élargissable plus tard).
insert into public.activities (slug, name, sort_order) values
  ('coffee',      'Coffee',       10),
  ('running',     'Running',      20),
  ('tennis',      'Tennis',       30),
  ('climbing',    'Climbing',     40),
  ('hiking',      'Hiking',       50),
  ('cycling',     'Cycling',      60),
  ('board-games', 'Board games',  70),
  ('cinema',      'Cinema',       80),
  ('museum',      'Museum',       90),
  ('yoga',        'Yoga',        100),
  ('swimming',    'Swimming',    110),
  ('football',    'Football',    120);

-- 3. profile_activities (liaison N-N) --------------------------------------
-- Centres d'intérêt d'un profil. PK composite -> pas de doublon.
create table public.profile_activities (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  activity_id uuid not null references public.activities (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, activity_id)
);

-- Index sur activity_id : « qui pratique cette activité » (découverte, brique 7).
create index profile_activities_activity_id_idx on public.profile_activities (activity_id);

alter table public.profile_activities enable row level security;

-- Lecture : authentifiés (afficher les intérêts d'autrui au browse).
create policy "Profile activities are readable by authenticated users"
  on public.profile_activities for select to authenticated using (true);

-- Insertion/suppression : uniquement SES propres liaisons (pas d'UPDATE -> on
-- ajoute/retire des lignes). `(select auth.uid())` wrappé pour la perf.
create policy "Users add their own activities"
  on public.profile_activities for insert to authenticated
  with check ((select auth.uid()) = profile_id);

create policy "Users remove their own activities"
  on public.profile_activities for delete to authenticated
  using ((select auth.uid()) = profile_id);

grant select, insert, delete on public.profile_activities to authenticated;
grant all on public.profile_activities to service_role;
