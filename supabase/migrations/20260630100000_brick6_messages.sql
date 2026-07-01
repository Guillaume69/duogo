-- Brique 6 (1/3) — Messages + temps réel (le chat d'une conversation).
-- « La conversation EST le match » : les messages se rattachent à une conversation
-- (créée à l'acceptation d'une invitation, cf. brique 5). Ici on pose :
--   • la table `messages` (RLS membres ; ÉCRITURE CLIENT DIRECTE via PostgREST + RLS —
--     c'est le cas ~80 % « l'utilisateur agit sur ses données, règle simple » d'AGENTS.md,
--     pas besoin de RPC) ;
--   • la dénormalisation `conversations.last_message_at` (tri de la liste Chats) maintenue
--     par TRIGGER (la base possède l'invariant) ;
--   • les pointeurs de lecture PAR MEMBRE (non lus / badge « Your Turn ») ;
--   • l'ajout de `messages` à la publication `supabase_realtime` (push WAL -> client).

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ conversations : dénormalisations pour la liste Chats                        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- last_message_at : null tant qu'aucun message ; sert au TRI de la liste (récents en
-- haut). Maintenu par trigger sur l'insertion d'un message (jamais écrit par le client).
alter table public.conversations
  add column last_message_at timestamptz;

-- Pointeurs « jusqu'où chaque membre a lu ». En ordre canonique (user_a < user_b), donc
-- une colonne par membre (pas de table d'appartenance pour 2 membres). Null = jamais lu
-- -> on plancher sur created_at au calcul des non-lus (cf. get_my_conversations, 2/3).
-- Mis à jour seulement via la RPC mark_messages_read (aucune écriture client sur la table).
alter table public.conversations
  add column user_a_last_read_at timestamptz,
  add column user_b_last_read_at timestamptz;

-- Tri de la liste Chats : conversation la plus « fraîche » d'abord. coalesce(last_message_at,
-- created_at) -> on indexe les deux colonnes, l'expression est résolue côté requête.
create index conversations_last_message_idx
  on public.conversations (last_message_at desc nulls last);

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ messages                                                                   ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
create table public.messages (
  id uuid primary key default gen_random_uuid(),

  -- La conversation à laquelle le message appartient. on delete cascade : supprimer la
  -- conversation purge ses messages (cohérent).
  conversation_id uuid not null references public.conversations (id) on delete cascade,

  -- L'auteur. Doit être un MEMBRE de la conversation (vérifié par la policy INSERT).
  sender_id uuid not null references public.profiles (id) on delete cascade,

  -- Corps du message. Invariant possédé par la BASE : non vide (après trim) et borné.
  -- Le client trime/valide aussi, mais pour l'UX seulement (doublon assumé).
  body text not null check (char_length(btrim(body)) between 1 and 2000),

  -- Pas d'updated_at : un message est IMMUABLE (ni édition ni suppression au MVP).
  created_at timestamptz not null default now()
);

comment on table public.messages is
  'Messages d''une conversation (= chat du match). Immuables. Realtime via supabase_realtime.';

-- Index unique de tri/pagination : récupérer une conversation par ordre chronologique
-- (asc) ET trouver le dernier message (scan arrière) -> un seul btree composite suffit.
create index messages_conversation_created_idx
  on public.messages (conversation_id, created_at);

-- ── Trigger : à chaque message inséré, on rafraîchit last_message_at de la conversation.
-- (Cet UPDATE déclenche aussi conversations_touch_updated_at -> updated_at suit.)
create or replace function public.bump_conversation_last_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations
    set last_message_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_bump_conversation
  after insert on public.messages
  for each row
  execute function public.bump_conversation_last_message();

-- ── RLS : lecture + écriture réservées aux deux membres de la conversation.
alter table public.messages enable row level security;

-- Lecture : je vois les messages d'une conversation dont je suis membre. (S'applique AUSSI
-- au Realtime : un changement n'est poussé qu'aux abonnés qui passent cette policy.)
create policy "Messages are visible to conversation members"
  on public.messages for select to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (select auth.uid()) in (c.user_a, c.user_b)
    )
  );

-- Écriture : j'écris EN MON NOM (sender_id = moi) dans une conversation dont je suis
-- membre. La paire (sender = moi) + (membre) défend « pas d'usurpation, pas d'intrusion ».
create policy "Members send messages as themselves"
  on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (select auth.uid()) in (c.user_a, c.user_b)
    )
  );

-- Contrôle d'accès en deux couches (cf. AGENTS.md) : GRANT de table + policy RLS.
-- authenticated : select + insert seulement. On RÉVOQUE l'update accordé par défaut
-- (api_role_grants) -> message immuable. Pas de delete accordé (jamais par défaut).
grant select, insert on public.messages to authenticated;
revoke update on public.messages from authenticated;
grant all on public.messages to service_role;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ Realtime : pousser les INSERT de messages aux abonnés (filtrés par RLS)     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Ajoute la table à la publication WAL lue par le serveur Realtime. On s'abonne côté
-- client à postgres_changes INSERT (filtre conversation_id) ; la RLS SELECT ci-dessus
-- décide qui reçoit. (REPLICA IDENTITY par défaut suffit : un INSERT porte toujours la
-- ligne complète ; on ne s'abonne pas aux UPDATE/DELETE.)
alter publication supabase_realtime add table public.messages;
