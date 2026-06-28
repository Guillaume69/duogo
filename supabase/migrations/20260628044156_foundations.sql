-- Brique 0 — Fondations techniques.
-- Pose les briques transverses réutilisées par toutes les migrations suivantes :
-- extension géospatiale, types énumérés et helper de timestamp. Aucune table ici.

-- PostGIS : distances réelles (ST_DWithin), colonnes geography. Installé dans le
-- schéma `extensions` (recommandation Supabase), pas dans `public`.
create extension if not exists postgis with schema extensions;

-- Enums métier. Énumérés plutôt que du texte libre : contrainte d'intégrité côté
-- base + types générés stricts côté client (zéro `as`). Extensibles via
-- `alter type ... add value` (non bloquant).

-- Genre du profil.
create type public.gender as enum ('male', 'female', 'other');

-- Créneau approximatif d'une invitation (alternative à une heure précise).
create type public.time_slot as enum ('morning', 'afternoon', 'evening');

-- Cycle de vie d'une invitation. `changes_requested` est prévu dès maintenant
-- (feature « Modify », brique 8) pour éviter une migration d'enum cassante plus tard.
create type public.invitation_status as enum (
  'pending',
  'accepted',
  'declined',
  'changes_requested'
);

-- Plateforme d'un token de push (un device = une plateforme).
create type public.push_platform as enum ('ios', 'android');

-- Helper de trigger : met à jour `updated_at` à chaque UPDATE.
-- `search_path = ''` fige la résolution de noms (durcissement recommandé par le
-- linter Supabase) ; `now()` reste résolu via pg_catalog.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
