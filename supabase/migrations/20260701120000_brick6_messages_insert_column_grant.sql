-- Brique 6 — Durcissement : restreindre l'INSERT client sur `messages` aux colonnes légitimes.
--
-- La migration 20260630100000 accordait `grant select, insert on public.messages` : un GRANT de
-- TABLE, donc portant sur TOUTES les colonnes. Le client pouvait donc fournir lui-même `id` et
-- surtout `created_at` (le `with check` de la policy INSERT ne les borne pas, et un `default` est
-- écrasable si la colonne est insérable). Un client forgé pouvait ainsi antidater/postdater un
-- message et fausser des données DÉRIVÉES de `created_at` :
--   • le tri du fil (index (conversation_id, created_at)) ;
--   • `conversations.last_message_at`, maintenu par le trigger bump_conversation_last_message
--     (`= new.created_at`) -> épingler une conversation en tête de liste de l'autre membre ;
--   • le compteur de non-lus (get_my_conversations compare `created_at` aux pointeurs de lecture)
--     -> un message antidaté sous le dernier `last_read_at` n'apparaîtrait pas comme non lu.
--
-- Remède idiomatique AGENTS.md (« GRANT de colonne = l'outil pour champ non modifiable ») : on
-- révoque l'INSERT de table et on le ré-accorde au niveau COLONNE, limité à ce que le client a le
-- droit d'écrire. `id` et `created_at` retombent alors sur leurs defaults serveur
-- (gen_random_uuid(), now()) et ne sont plus forgeables. La policy RLS INSERT (sender = moi ET
-- membre) reste la frontière de LIGNES ; ceci ferme la frontière de COLONNES. SELECT inchangé.
revoke insert on public.messages from authenticated;
grant insert (conversation_id, sender_id, body) on public.messages to authenticated;
