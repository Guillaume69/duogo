-- Brique 6.5 — Inbox unifiée (un fil par personne).
-- Jusqu'ici l'Inbox était éclatée en 3 sources (chats / invitations reçues / envoyées) avec une
-- frontière `incoming/outgoing` bancale (une invitation renvoyée via Modify « rebondissait » entre
-- deux écrans). On unifie : l'axe de rangement devient « ça m'attend, oui/non ».
--   • get_inbox()       : UN flux homogène = conversations (matchs) ∪ invitations qui m'attendent.
--   • get_inbox_count() : le compteur d'attention du badge = les lignes `needs_me` de ce flux.
-- Comme les RPC sœurs (get_my_conversations / get_my_invitations), `security definer` (on lit le
-- profil de l'AUTRE membre) + FILTRE explicite sur l'appelant (la RPC court-circuite la RLS).

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ get_inbox — le flux unifié                                                 ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Une ligne par « fil » :
--   • kind='conversation' : tous mes matchs. state ∈ {msg_unread, match_new, msg_read}.
--   • kind='invitation'   : les invitations ACTIVES dont c'est MON tour (reçue en attente, ou
--     contre-proposition renvoyée vers moi). state ∈ {invite_in, invite_changes}.
--     Les invitations où j'attends L'AUTRE vivent dans l'écran « Sent » (pas ici).
-- « Une ligne par personne » : une invitation active n'est émise que si la paire n'a PAS encore de
--   conversation (sinon elle serait déjà épinglée dans le chat -> pas de doublon de ligne).
-- `needs_me` = ce qui appelle une action de ma part : conversation jamais ouverte (pointeur NULL)
--   OU non-lus > 0 ; toute invitation qui m'attend. Tri : mon tour d'abord, puis récence.
create or replace function public.get_inbox()
returns table (
  kind              text,        -- 'conversation' | 'invitation'
  state             text,        -- msg_unread | match_new | msg_read | invite_in | invite_changes
  target_id         uuid,        -- conversation.id (-> chat) | invitation.id (-> détail)
  other_id          uuid,
  other_name        text,
  other_avatar_path text,
  activity_name     text,
  last_message_body text,        -- null pour une invitation / une conversation vierge
  last_message_mine boolean,     -- false pour une invitation
  unread_count      int,         -- 0 pour une invitation
  needs_me          boolean,     -- appelle une action de ma part (pilote le badge)
  sort_ts           timestamptz  -- clé de tri/affichage (dernier message | updated_at de l'invit.)
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
  select * from (
    -- ── Conversations (matchs) : enrichies comme get_my_conversations, + kind/state/needs_me.
    select
      'conversation'::text                                     as kind,
      case
        when coalesce(unread.n, 0) > 0 then 'msg_unread'
        when lm.body is null           then 'match_new'
        else                                'msg_read'
      end                                                      as state,
      c.id                                                     as target_id,
      other.id                                                 as other_id,
      other.display_name                                       as other_name,
      other.avatar_path                                        as other_avatar_path,
      a.name                                                   as activity_name,
      lm.body                                                  as last_message_body,
      coalesce(lm.sender_id = v_uid, false)                    as last_message_mine,
      coalesce(unread.n, 0)::int                               as unread_count,
      -- Jamais ouverte (pointeur NULL) OU non-lus : dans les deux cas ça m'attend. Celui qui a
      -- accepté est entré dans le chat (mark_messages_read au montage) -> pointeur posé -> exclu.
      (
        (case when c.user_a = v_uid then c.user_a_last_read_at
                                    else c.user_b_last_read_at end) is null
        or coalesce(unread.n, 0) > 0
      )                                                        as needs_me,
      coalesce(c.last_message_at, c.created_at)                as sort_ts
    from public.conversations c
    join public.profiles other
      on other.id = case when c.user_a = v_uid then c.user_b else c.user_a end
    -- L'activité provient de l'invitation d'origine (figée). join inner : toujours présente.
    join public.invitations inv on inv.id = c.invitation_id
    join public.activities a on a.id = inv.activity_id
    left join lateral (
      select m.body, m.created_at, m.sender_id
      from public.messages m
      where m.conversation_id = c.id
      order by m.created_at desc
      limit 1
    ) lm on true
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
    where v_uid in (c.user_a, c.user_b)            -- ⚠ filtre OBLIGATOIRE (RLS court-circuitée)

    union all

    -- ── Invitations ACTIVES dont c'est MON tour, tant que la paire n'a pas de conversation.
    select
      'invitation'::text                                       as kind,
      case when i.status = 'changes_requested'
           then 'invite_changes' else 'invite_in' end          as state,
      i.id                                                     as target_id,
      other.id                                                 as other_id,
      other.display_name                                       as other_name,
      other.avatar_path                                        as other_avatar_path,
      a.name                                                   as activity_name,
      null::text                                               as last_message_body,
      false                                                    as last_message_mine,
      0                                                        as unread_count,
      true                                                     as needs_me,
      i.updated_at                                             as sort_ts
    from public.invitations i
    join public.profiles other
      on other.id = case when i.sender_id = v_uid then i.recipient_id else i.sender_id end
    join public.activities a on a.id = i.activity_id
    where i.awaiting_response_from = v_uid          -- c'est à MOI de répondre (implique membre)
      and i.status in ('pending', 'changes_requested')
      -- « Une ligne par personne » : pas de doublon si la paire est déjà matchée (2e invitation
      -- éventuelle -> déjà épinglée dans le chat). Paire non ordonnée (least/greatest).
      and not exists (
        select 1 from public.conversations c
        where c.user_a = least(i.sender_id, i.recipient_id)
          and c.user_b = greatest(i.sender_id, i.recipient_id)
      )
  ) feed
  order by feed.needs_me desc, feed.sort_ts desc;   -- mon tour d'abord, puis le plus frais
end;
$$;

revoke all on function public.get_inbox() from public;
grant execute on function public.get_inbox() to authenticated;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ get_inbox_count — le compteur d'attention (badge de l'onglet Inbox)         ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Défini SUR get_inbox() -> une seule source de vérité (« combien de lignes m'attendent »),
-- pas de prédicat `needs_me` dupliqué. security definer imbriqué : auth.uid() reste l'appelant.
create or replace function public.get_inbox_count()
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.get_inbox() where needs_me;
$$;

revoke all on function public.get_inbox_count() from public;
grant execute on function public.get_inbox_count() to authenticated;
