-- Brique 1 — Table `profiles` (squelette).
-- Identité minimale d'un utilisateur : une ligne par compte auth.users, créée
-- automatiquement à l'inscription (trigger), complétée à l'onboarding via
-- `display_name`. Les champs riches (genre, date de naissance, ville, avatar,
-- géoloc…) arrivent en brique 2. Voir la note `onboarding_completed` en bas.

-- 1. Table -----------------------------------------------------------------

create table public.profiles (
  -- Clé primaire = l'id du compte auth. `on delete cascade` : supprimer le
  -- compte supprime le profil (suppression de compte propre, sans orphelins).
  id uuid primary key references auth.users (id) on delete cascade,

  -- Pseudo affiché. NULL tant que l'onboarding n'est pas fait ; c'est CE champ
  -- qui sert de drapeau « onboarding terminé » en brique 1 (cf. note plus bas).
  -- Borne de longueur 2..30 ; le garde `is null` autorise l'état pré-onboarding
  -- (un CHECK passe quand son expression vaut NULL, mais on l'écrit explicitement).
  display_name text
    check (display_name is null or char_length(display_name) between 2 and 30),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Profil applicatif (1:1 avec auth.users). display_name est renseigné à l''onboarding.';

-- 2. updated_at automatique ------------------------------------------------
-- Réutilise le helper public.touch_updated_at() posé en brique 0.

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row
  execute function public.touch_updated_at();

-- 3. Création auto du profil à l'inscription -------------------------------
-- `security definer` : la fonction s'exécute avec les droits de son propriétaire
-- (postgres) et CONTOURNE donc la RLS — indispensable, car au moment du signup
-- il n'y a pas de session applicative pour satisfaire une policy d'INSERT.
-- `set search_path = ''` fige la résolution de noms (durcissement linter Supabase) ;
-- `now()`/types restent résolus via pg_catalog. Tout objet est donc schéma-qualifié.
-- `on conflict do nothing` : idempotent si la ligne existe déjà.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- 4. RLS -------------------------------------------------------------------
-- Active la RLS : sans policy, tout accès est refusé par défaut.
alter table public.profiles enable row level security;

-- Lecture : tout utilisateur authentifié peut lire tous les profils
-- (nécessaire pour parcourir les gens, brique 3). `to authenticated` exclut anon.
-- ⚠ Quand les colonnes sensibles (GPS) arriveront en brique 2, les masquer via des
-- GRANT au niveau COLONNE — la RLS filtre des lignes, pas des colonnes.
create policy "Profiles are readable by authenticated users"
  on public.profiles
  for select
  to authenticated
  using (true);

-- Insertion : uniquement sa propre ligne. En pratique le trigger crée déjà la
-- ligne (en tant que definer) ; cette policy est de la défense en profondeur
-- pour un éventuel insert côté client.
create policy "Users can insert their own profile"
  on public.profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = id);

-- Mise à jour : uniquement sa propre ligne (onboarding, édition du profil).
-- `(select auth.uid())` est wrappé pour la perf (initplan mis en cache).
create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Pas de policy DELETE : la suppression directe par le client est interdite.
-- La suppression du compte (auth.users) cascade vers profiles, exécutée côté
-- admin/service_role (qui contourne la RLS) via le `on delete cascade` ci-dessus.
