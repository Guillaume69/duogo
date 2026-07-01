-- Brique 6 (2/3) — Lecture des conversations + accusés de lecture.
-- Trois RPC `security definer` (lecture du profil de l'AUTRE membre, ou écriture sur
-- conversations dont le client n'a pas le GRANT). Comme partout : la RPC court-circuite la
-- RLS, donc on FILTRE explicitement sur l'appelant (membre) — l'oubli fuiterait tout.
--   • get_my_conversations() : liste Chats (autre membre, activité, dernier message, non lus).
--   • get_conversation(id)   : en-tête du chat + carte d'invitation épinglée.
--   • mark_messages_read(id) : avance mon pointeur de lecture (remet les non-lus à 0).
--
-- La LISTE des messages d'une conversation ne passe PAS par une RPC : le client lit
-- directement public.messages via PostgREST + RLS (membre) — cas simple « mes données ».

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ get_my_conversations — la liste Chats                                       ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Une ligne par conversation dont je suis membre, enrichie pour la liste : l'AUTRE membre
-- (nom/avatar), l'activité de l'invitation d'origine, le dernier message (corps + de qui +
-- quand) et mon compteur de non-lus. Triée : conversation la plus fraîche d'abord.
create or replace function public.get_my_conversations()
returns table (
  id                uuid,                          -- id de la conversation
  other_id          uuid,
  other_name        text,
  other_avatar_path text,
  activity_name     text,
  last_message_body text,                          -- null si aucun message encore
  last_message_at   timestamptz,                   -- null si aucun message
  last_message_mine boolean,                        -- le dernier message est-il de MOI
  unread_count      int,                           -- messages de l'autre non encore lus
  created_at        timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  return query
  select
    c.id,
    other.id,
    other.display_name,
    other.avatar_path,
    a.name,
    lm.body,
    lm.created_at,
    coalesce(lm.sender_id = v_uid, false),
    coalesce(unread.n, 0)::int,
    c.created_at
  from public.conversations c
  join public.profiles other
    on other.id = case when c.user_a = v_uid then c.user_b else c.user_a end
  -- L'activité provient de l'invitation d'origine (figée : une invitation acceptée n'est
  -- plus modifiable). join inner : une conversation a toujours son invitation + activité.
  join public.invitations inv on inv.id = c.invitation_id
  join public.activities a on a.id = inv.activity_id
  -- Dernier message (le plus récent). left join lateral : null si conversation vierge.
  left join lateral (
    select m.body, m.created_at, m.sender_id
    from public.messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) lm on true
  -- Non-lus : messages de l'AUTRE postérieurs à MON pointeur de lecture. Plancher sur
  -- c.created_at quand le pointeur est null (jamais lu) -> compte tout depuis le match.
  left join lateral (
    select count(*) as n
    from public.messages m
    where m.conversation_id = c.id
      and m.sender_id <> v_uid
      and m.created_at > coalesce(
        case when c.user_a = v_uid then c.user_a_last_read_at else c.user_b_last_read_at end,
        c.created_at
      )
  ) unread on true
  where v_uid in (c.user_a, c.user_b)             -- ⚠ filtre OBLIGATOIRE (RLS court-circuitée)
  order by coalesce(c.last_message_at, c.created_at) desc;
end;
$$;

revoke all on function public.get_my_conversations() from public;
grant execute on function public.get_my_conversations() to authenticated;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ get_conversation — en-tête du chat + carte d'invitation épinglée            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Détail d'UNE conversation dont je suis membre (sinon 0 ligne -> « indisponible »).
-- Renvoie l'autre membre (en-tête) + le résumé de l'invitation d'origine (carte épinglée
-- en haut du fil). Pas de coordonnées (cohérent avec le reste de l'app).
create or replace function public.get_conversation(p_id uuid)
returns table (
  id                uuid,
  other_id          uuid,
  other_name        text,
  other_avatar_path text,
  invitation_id     uuid,
  activity_name     text,
  location_name     text,
  scheduled_date    date,
  time_slot         public.time_slot,
  scheduled_time    time,
  created_at        timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  return query
  select
    c.id,
    other.id,
    other.display_name,
    other.avatar_path,
    inv.id,
    a.name,
    l.name,
    inv.scheduled_date,
    inv.time_slot,
    inv.scheduled_time,
    c.created_at
  from public.conversations c
  join public.profiles other
    on other.id = case when c.user_a = v_uid then c.user_b else c.user_a end
  join public.invitations inv on inv.id = c.invitation_id
  join public.activities a on a.id = inv.activity_id
  left join public.locations l on l.id = inv.location_id
  where c.id = p_id
    and v_uid in (c.user_a, c.user_b);            -- ⚠ membre seulement
end;
$$;

revoke all on function public.get_conversation(uuid) from public;
grant execute on function public.get_conversation(uuid) to authenticated;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ mark_messages_read — avance MON pointeur de lecture                         ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Le client n'a pas le GRANT UPDATE sur conversations (révoqué en brique 5) -> on passe
-- par cette RPC. Met le pointeur du MEMBRE appelant à now() ; no-op si non membre (le
-- WHERE ne matche pas). Idempotent. Appelée à l'ouverture du chat et à l'arrivée de
-- messages quand l'écran est au premier plan.
create or replace function public.mark_messages_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  update public.conversations
    set user_a_last_read_at = case when user_a = v_uid then now() else user_a_last_read_at end,
        user_b_last_read_at = case when user_b = v_uid then now() else user_b_last_read_at end
  where id = p_conversation_id
    and v_uid in (user_a, user_b);
end;
$$;

revoke all on function public.mark_messages_read(uuid) from public;
grant execute on function public.mark_messages_read(uuid) to authenticated;
