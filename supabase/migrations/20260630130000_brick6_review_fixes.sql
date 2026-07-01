-- Brique 6 — Correctifs de revue adversariale.

-- 1) messages : created_at et id ne doivent PAS être écrits par le client.
-- L'écriture des messages est client-directe (PostgREST + RLS). Or le GRANT INSERT était au
-- niveau TABLE (20260630100000) + hérité des default privileges (20260628140000), donc
-- `authenticated` pouvait fournir created_at/id. La policy WITH CHECK ne borne que sender_id
-- et la contrainte CHECK que body : un membre pouvait forger created_at (ex. '2099-…') et
-- ainsi épingler sa conversation en haut de la liste de l'autre (trigger -> last_message_at,
-- tri get_my_conversations) ou rendre un message « furtif » (jamais compté en non-lu).
-- Correctif (règle AGENTS.md « champ non modifiable -> GRANT de colonne ») : on retire
-- l'INSERT de table et on le redonne RESTREINT aux colonnes légitimes. id/created_at
-- retombent sur leurs DEFAULT (gen_random_uuid / now()), server-only.
revoke insert on public.messages from authenticated;
grant insert (conversation_id, sender_id, body) on public.messages to authenticated;
-- SELECT déjà accordé en 20260630100000 (nécessaire au RETURNING de .select() + au Realtime).

-- 2) Index conversations_last_message_idx (sur last_message_at seul) : inutile en lecture.
-- Le seul tri (get_my_conversations) est `order by coalesce(last_message_at, created_at)
-- desc` après un filtre d'appartenance (servi par les index user_a/user_b) -> un btree de
-- colonne simple ne sert ni ce filtre ni cette clé de tri (expression coalesce). Il était
-- pourtant entretenu à CHAQUE message (le trigger met à jour la colonne indexée). La liste
-- Chats trie un petit ensemble par utilisateur (tri en mémoire suffisant) -> on le retire.
drop index if exists public.conversations_last_message_idx;
