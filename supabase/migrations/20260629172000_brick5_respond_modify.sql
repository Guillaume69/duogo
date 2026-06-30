-- Brique 5 (3/5) — Répondre / Modifier une invitation (transitions d'état).
-- Deux RPC `security definer` (aucune écriture client directe sur invitations) :
--   • respond_invitation(id, accept) : accepte (-> crée la conversation) ou refuse.
--   • modify_invitation(id, …)       : contre-proposition (-> changes_requested + renvoie
--                                       la balle à l'autre membre).
-- Toutes deux verrouillent l'invitation (FOR UPDATE) et n'autorisent que le membre DONT
-- C'EST LE TOUR (awaiting_response_from), ce qui gère le ping-pong du Modify proprement.

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ respond_invitation                                                         ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Renvoie l'id de la conversation créée à l'acceptation, NULL au refus.
create or replace function public.respond_invitation(
  p_invitation_id uuid,
  p_accept        boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_inv  public.invitations;
  v_conv uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Verrou pessimiste : sérialise accept/decline concurrents sur la même invitation
  -- (pas de double-accept -> pas de double conversation).
  select * into v_inv
  from public.invitations
  where id = p_invitation_id
  for update;

  if not found then
    raise exception 'invitation not found' using errcode = 'P0002';
  end if;

  -- Seul le membre dont c'est le tour répond (couvre le sender après un changes_requested
  -- du destinataire). awaiting NULL (terminée) -> `is distinct from` -> personne ne peut.
  if v_inv.awaiting_response_from is distinct from v_uid then
    raise exception 'it is not your turn to respond to this invitation'
      using errcode = 'P0001';
  end if;

  if v_inv.status not in ('pending', 'changes_requested') then
    raise exception 'this invitation can no longer be answered'
      using errcode = 'P0001';
  end if;

  if p_accept then
    update public.invitations
      set status = 'accepted', awaiting_response_from = null
      where id = p_invitation_id;

    -- Le match = la conversation. UNE seule par paire (index unique sur user_a,user_b) :
    -- si la paire est DÉJÀ matchée (ex. re-invitation après un match — l'anti-spam ne
    -- couvre pas 'accepted'), on RÉUTILISE la conversation existante au lieu d'en créer
    -- une 2e. Membres en ordre canonique (least < greatest) -> respecte canonical_order.
    insert into public.conversations (invitation_id, user_a, user_b)
    values (
      p_invitation_id,
      least(v_inv.sender_id, v_inv.recipient_id),
      greatest(v_inv.sender_id, v_inv.recipient_id)
    )
    on conflict (user_a, user_b) do nothing
    returning id into v_conv;

    -- Conflit (conversation déjà existante pour la paire) -> on renvoie la sienne.
    if v_conv is null then
      select c.id into v_conv
      from public.conversations c
      where c.user_a = least(v_inv.sender_id, v_inv.recipient_id)
        and c.user_b = greatest(v_inv.sender_id, v_inv.recipient_id);
    end if;

    return v_conv;
  else
    update public.invitations
      set status = 'declined', awaiting_response_from = null
      where id = p_invitation_id;
    return null;
  end if;
end;
$$;

revoke all on function public.respond_invitation(uuid, boolean) from public;
grant execute on function public.respond_invitation(uuid, boolean) to authenticated;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ modify_invitation (contre-proposition)                                     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Réécrit les détails (activité/date/heure/lieu/message), passe en changes_requested et
-- renvoie le tour à l'AUTRE membre. Mêmes validations que send_invitation (activité/lieu
-- dans ma ville, date >= aujourd'hui en heure locale, créneau XOR heure). Renvoie l'id.
create or replace function public.modify_invitation(
  p_invitation_id uuid,
  p_activity_id   uuid,
  p_date          date,
  p_time_slot     public.time_slot default null,
  p_time          time            default null,
  p_location_id   uuid            default null,
  p_message       text            default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_inv      public.invitations;
  v_city     uuid;
  v_today    date;
  v_now_time time;
  v_other    uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into v_inv
  from public.invitations
  where id = p_invitation_id
  for update;

  if not found then
    raise exception 'invitation not found' using errcode = 'P0002';
  end if;

  if v_inv.awaiting_response_from is distinct from v_uid then
    raise exception 'it is not your turn to modify this invitation'
      using errcode = 'P0001';
  end if;

  if v_inv.status not in ('pending', 'changes_requested') then
    raise exception 'this invitation can no longer be modified'
      using errcode = 'P0001';
  end if;

  -- Ma ville + date locale (mêmes règles que send_invitation).
  select p.city_id into v_city from public.profiles p where p.id = v_uid;
  if v_city is null then
    raise exception 'you must be located in a city' using errcode = 'P0001';
  end if;
  select (now() at time zone c.timezone)::date,
         (now() at time zone c.timezone)::time
    into v_today, v_now_time
  from public.cities c where c.id = v_city;

  if not exists (select 1 from public.activities a where a.id = p_activity_id) then
    raise exception 'unknown activity' using errcode = 'P0001';
  end if;
  if p_location_id is not null and not exists (
    select 1 from public.locations l where l.id = p_location_id and l.city_id = v_city
  ) then
    raise exception 'unknown location' using errcode = 'P0001';
  end if;
  if p_date is null or p_date < v_today then
    raise exception 'invitation date must be today or later' using errcode = '22023';
  end if;
  if p_time_slot is not null and p_time is not null then
    raise exception 'choose either a time slot or an exact time, not both'
      using errcode = '22023';
  end if;

  -- Pour AUJOURD'HUI : refuser une heure/un créneau déjà passé (heure locale ville),
  -- comme send_invitation (cohérence des deux chemins d'écriture).
  if p_date = v_today then
    if p_time is not null and p_time < v_now_time then
      raise exception 'invitation time must be in the future' using errcode = '22023';
    end if;
    if p_time_slot = 'morning' and v_now_time >= time '12:00' then
      raise exception 'this time slot has already passed today' using errcode = '22023';
    elsif p_time_slot = 'afternoon' and v_now_time >= time '18:00' then
      raise exception 'this time slot has already passed today' using errcode = '22023';
    end if;
  end if;

  -- Contre-proposition : on renvoie la balle à l'AUTRE membre.
  v_other := case when v_uid = v_inv.sender_id then v_inv.recipient_id else v_inv.sender_id end;

  update public.invitations
    set activity_id            = p_activity_id,
        location_id            = p_location_id,
        scheduled_date         = p_date,
        time_slot              = p_time_slot,
        scheduled_time         = p_time,
        message                = nullif(btrim(p_message), ''),
        status                 = 'changes_requested',
        awaiting_response_from = v_other
    where id = p_invitation_id;

  return p_invitation_id;
end;
$$;

revoke all on function public.modify_invitation(
  uuid, uuid, date, public.time_slot, time, uuid, text
) from public;
grant execute on function public.modify_invitation(
  uuid, uuid, date, public.time_slot, time, uuid, text
) to authenticated;
