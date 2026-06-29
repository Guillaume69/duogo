-- Brique 4 (revue) — corrections issues de la revue adversariale :
--   (#1)  locations : durcissement des privilèges (symétrie cities/activities/invitations).
--   (#9)  send_invitation : refuser une invitation pour AUJOURD'HUI à une heure/un créneau
--         déjà passé (la version initiale ne validait que la date, pas l'heure du jour).

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ (#1) locations : révoquer l'écriture héritée des default privileges         ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Comme cities/activities (cf. 20260628170000_brick2_hardening) et invitations
-- (20260629120000), la table de référence `locations` ne doit pas garder le
-- select/insert/update accordé AUTOMATIQUEMENT à authenticated par les default
-- privileges (20260628140000). Non exploitable aujourd'hui (RLS = SELECT only, deny
-- par défaut), mais on garde le modèle « GRANT de table ET policy RLS » honnête.
revoke insert, update on public.locations from authenticated;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ (#9) send_invitation : validation de l'heure pour une invitation du jour    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- CREATE OR REPLACE (signature + type de retour inchangés -> conserve les GRANTs).
-- Ajout : si la date = aujourd'hui (fuseau de la ville), on refuse une heure précise
-- déjà passée et un créneau déjà révolu (matin après midi, après-midi après 18 h ;
-- le soir reste valable jusqu'à minuit local). Le reste est identique à l'original.
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
  v_uid       uuid := (select auth.uid());
  v_city      uuid;
  v_today     date;
  v_now_time  time;
  v_id        uuid;
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

  -- Date ET heure courantes dans le fuseau de la ville (servent à valider « pas dans le passé »).
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

  -- Date dans le futur (ou aujourd'hui), en date LOCALE de la ville.
  if p_date is null or p_date < v_today then
    raise exception 'invitation date must be today or later'
      using errcode = '22023';  -- invalid_parameter_value
  end if;

  -- Créneau XOR heure précise (re-vérifié ; le CHECK de table le garantit aussi).
  if p_time_slot is not null and p_time is not null then
    raise exception 'choose either a time slot or an exact time, not both'
      using errcode = '22023';
  end if;

  -- Pour AUJOURD'HUI : refuser une heure/un créneau déjà passé (heure locale ville).
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

  -- Insertion. L'index unique partiel anti-spam lève unique_violation (23505) s'il
  -- existe déjà une invitation pending entre les deux (peu importe le sens).
  begin
    insert into public.invitations (
      sender_id, recipient_id, activity_id, location_id,
      scheduled_date, time_slot, scheduled_time, message
    ) values (
      v_uid, p_recipient_id, p_activity_id, p_location_id,
      p_date, p_time_slot, p_time, nullif(btrim(p_message), '')
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
