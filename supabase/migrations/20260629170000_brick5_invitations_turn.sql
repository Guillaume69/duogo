-- Brique 5 (1/5) — Tour de parole des invitations (« à qui de répondre »).
-- Le Modify (contre-proposition) introduit un PING-PONG : le destinataire peut renvoyer
-- la balle à l'expéditeur, qui peut re-modifier, etc. On MATÉRIALISE « à qui c'est de
-- répondre » dans une colonne dédiée plutôt que de la déduire du statut + du sens
-- (ambigu après plusieurs allers-retours). NULL = plus personne (invitation terminée :
-- accepted/declined). Source de vérité unique du « tour » pour respond/modify + l'Inbox.

-- 1. Colonne awaiting_response_from ----------------------------------------
alter table public.invitations
  add column awaiting_response_from uuid references public.profiles (id) on delete cascade;

comment on column public.invitations.awaiting_response_from is
  'Membre dont c''est le tour de répondre (pending/changes_requested). NULL si terminée.';

-- Backfill : les invitations pending existantes attendent leur destinataire.
update public.invitations
  set awaiting_response_from = recipient_id
  where status = 'pending' and awaiting_response_from is null;

-- Lookup « invitations qui m'attendent » (Inbox actionnable). Partiel = états actifs only.
create index invitations_awaiting_idx
  on public.invitations (awaiting_response_from)
  where status in ('pending', 'changes_requested');

-- 2. Anti-spam élargi à changes_requested ---------------------------------
-- En brique 4, « active » = pending uniquement (le commentaire d'origine l'anticipait).
-- Avec Modify, une invitation en changes_requested est TOUJOURS une négociation ouverte
-- -> elle compte dans l'unicité de la paire (sinon on pourrait ouvrir une 2e invitation
-- pendant qu'une contre-proposition est en cours). On recrée l'index unique partiel.
drop index if exists public.invitations_active_pair_uidx;
create unique index invitations_active_pair_uidx
  on public.invitations (least(sender_id, recipient_id), greatest(sender_id, recipient_id))
  where status in ('pending', 'changes_requested');

-- 3. send_invitation : pose le tour initial (destinataire) -----------------
-- Corps identique à la brique 4 ; SEUL ajout : awaiting_response_from = destinataire à la
-- création (c'est à lui de répondre en premier). CREATE OR REPLACE (signature inchangée
-- -> conserve les GRANT ; on les réaffirme en fin pour la traçabilité).
create or replace function public.send_invitation(
  p_recipient_id uuid,
  p_activity_id  uuid,
  p_date         date,
  p_time_slot    public.time_slot default null,
  p_time         time            default null,
  p_location_id  uuid            default null,
  p_message      text            default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_city     uuid;
  v_today    date;
  v_now_time time;
  v_id       uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select p.city_id into v_city
  from public.profiles p
  where p.id = v_uid;

  if v_city is null then
    raise exception 'you must be located in a city to send invitations'
      using errcode = 'P0001';
  end if;

  -- Date ET heure courantes dans le fuseau de la ville (validation « pas dans le passé »).
  select (now() at time zone c.timezone)::date,
         (now() at time zone c.timezone)::time
    into v_today, v_now_time
  from public.cities c where c.id = v_city;

  -- Destinataire VISIBLE par l'appelant (même frontière que le browse).
  if not exists (
    select 1 from public.profiles r
    where r.id = p_recipient_id
      and r.id <> v_uid
      and r.onboarding_completed is true
      and r.device_location is not null
      and r.city_id = v_city
  ) then
    raise exception 'recipient is not available' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.activities a where a.id = p_activity_id) then
    raise exception 'unknown activity' using errcode = 'P0001';
  end if;

  if p_location_id is not null and not exists (
    select 1 from public.locations l
    where l.id = p_location_id and l.city_id = v_city
  ) then
    raise exception 'unknown location' using errcode = 'P0001';
  end if;

  if p_date is null or p_date < v_today then
    raise exception 'invitation date must be today or later'
      using errcode = '22023';
  end if;

  if p_time_slot is not null and p_time is not null then
    raise exception 'choose either a time slot or an exact time, not both'
      using errcode = '22023';
  end if;

  -- Pour AUJOURD'HUI : refuser une heure/un créneau déjà passé (heure locale ville).
  -- (Restauré de la revue brique 4 : ne PAS perdre cette validation au CREATE OR REPLACE.)
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

  begin
    insert into public.invitations (
      sender_id, recipient_id, activity_id, location_id,
      scheduled_date, time_slot, scheduled_time, message,
      awaiting_response_from
    ) values (
      v_uid, p_recipient_id, p_activity_id, p_location_id,
      p_date, p_time_slot, p_time, nullif(btrim(p_message), ''),
      p_recipient_id  -- c'est au destinataire de répondre en premier
    )
    returning id into v_id;
  exception when unique_violation then
    raise exception 'there is already a pending invitation with this person'
      using errcode = '23505';
  end;

  return v_id;
end;
$$;

revoke all on function public.send_invitation(
  uuid, uuid, date, public.time_slot, time, uuid, text
) from public;
grant execute on function public.send_invitation(
  uuid, uuid, date, public.time_slot, time, uuid, text
) to authenticated;
