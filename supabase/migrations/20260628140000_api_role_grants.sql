-- Brique 1 (correctif) — Privilèges de table pour les rôles API.
--
-- Constat : sur CE projet, les nouvelles tables du schéma `public` ne reçoivent PAS
-- automatiquement les privilèges DML pour `authenticated` / `service_role` (seuls
-- REFERENCES / TRIGGER / TRUNCATE étaient accordés par défaut). Conséquence : le rôle
-- `authenticated` se prend un « 42501 permission denied for table » AVANT même que la
-- RLS ne s'applique — un GRANT de table et une policy RLS sont DEUX couches distinctes :
--   accès autorisé  ==  (le rôle a le GRANT de table)  ET  (une policy RLS passe).
--
-- On rétablit donc le comportement standard Supabase : les rôles API peuvent ATTEINDRE
-- les tables, et la **RLS reste le seul vrai contrôle d'accès** (deny par défaut s'il
-- n'existe pas de policy). L'app étant 100 % authentifiée, on n'accorde RIEN à `anon`.

-- 1. Table existante `profiles` (créée avant ce correctif).
--    On accorde exactement ce que reflètent ses policies : select / insert / update
--    (pas de delete pour `authenticated` ; la suppression passe par service_role/cascade).
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.profiles to service_role;

-- 2. Tables FUTURES du schéma public (créées par `postgres` via les migrations).
--    `authenticated` : DML courant (la RLS de chaque table filtrera réellement).
--    `service_role`  : tous droits (usage serveur/admin, contourne la RLS).
--    Le delete reste accordé à la demande, par table, quand une policy DELETE existe.
alter default privileges in schema public
  grant select, insert, update on tables to authenticated;
alter default privileges in schema public
  grant all on tables to service_role;
