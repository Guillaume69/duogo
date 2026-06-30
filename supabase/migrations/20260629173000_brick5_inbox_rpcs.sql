-- Brique 5 (4/5) — Lecture de l'Inbox.
-- Deux RPC `security definer` qui ENRICHISSENT les invitations de l'appelant avec le
-- profil de l'autre membre (nom, avatar), l'activité, le lieu, le SENS (incoming/outgoing)
-- et « est-ce mon tour » (awaiting_me). `security definer` car on lit le profil de l'autre
-- (display_name/avatar_path) en s'affranchissant des subtilités RLS ; on FILTRE donc
-- explicitement sur l'appelant (sender_id OU recipient_id = moi) — la RPC court-circuite
-- la RLS, l'oubli de ce filtre fuiterait toutes les invitations.
--
--   • get_my_invitations() : liste (Inbox reçues + écran Sent). Léger (pas de distance).
--   • get_invitation(id)   : détail d'UNE invitation (carte + deep-link), enrichi des
--                            distances (personne snappée anti-trilatération ; lieu exact).

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ get_my_invitations                                                         ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
create or replace function public.get_my_invitations()
returns table (
  id                uuid,
  direction         text,                          -- 'incoming' (reçue) | 'outgoing' (envoyée)
  status            public.invitation_status,
  awaiting_me       boolean,                        -- c'est à MOI de répondre
  other_id          uuid,
  other_name        text,
  other_avatar_path text,
  activity_id       uuid,
  activity_name     text,
  location_id       uuid,
  location_name     text,
  scheduled_date    date,
  time_slot         public.time_slot,
  scheduled_time    time,
  message           text,
  created_at        timestamptz,
  updated_at        timestamptz
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
    i.id,
    case when i.sender_id = v_uid then 'outgoing' else 'incoming' end,
    i.status,
    coalesce(i.awaiting_response_from = v_uid, false),
    other.id,
    other.display_name,
    other.avatar_path,
    a.id,
    a.name,
    l.id,
    l.name,
    i.scheduled_date,
    i.time_slot,
    i.scheduled_time,
    i.message,
    i.created_at,
    i.updated_at
  from public.invitations i
  join public.profiles other
    on other.id = case when i.sender_id = v_uid then i.recipient_id else i.sender_id end
  join public.activities a on a.id = i.activity_id
  left join public.locations l on l.id = i.location_id
  where i.sender_id = v_uid or i.recipient_id = v_uid     -- ⚠ filtre OBLIGATOIRE (RLS court-circuitée)
  order by coalesce(i.awaiting_response_from = v_uid, false) desc,  -- mon tour en premier
           i.updated_at desc;
end;
$$;

revoke all on function public.get_my_invitations() from public;
grant execute on function public.get_my_invitations() to authenticated;

-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ get_invitation                                                             ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Détail d'UNE invitation dont je suis membre (sinon 0 ligne -> « indisponible »).
-- Distances calculées comme ailleurs : personne = snappée (anti-trilatération) ; lieu =
-- exacte (lieu PUBLIC, pas une position d'autrui). Coordonnées jamais renvoyées.
create or replace function public.get_invitation(p_id uuid)
returns table (
  id                  uuid,
  direction           text,
  status              public.invitation_status,
  awaiting_me         boolean,
  other_id            uuid,
  other_name          text,
  other_avatar_path   text,
  other_city_name     text,
  other_distance_m    int,
  activity_id         uuid,
  activity_name       text,
  location_id         uuid,
  location_name       text,
  location_address    text,
  location_distance_m int,
  scheduled_date      date,
  time_slot           public.time_slot,
  scheduled_time      time,
  message             text,
  created_at          timestamptz,
  updated_at          timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_origin extensions.geography;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select p.device_location into v_origin
  from public.profiles p where p.id = v_uid;

  return query
  select
    i.id,
    case when i.sender_id = v_uid then 'outgoing' else 'incoming' end,
    i.status,
    coalesce(i.awaiting_response_from = v_uid, false),
    other.id,
    other.display_name,
    other.avatar_path,
    oc.name,
    case when v_origin is not null and other.device_location is not null
         then public.snapped_distance_m(v_origin, other.device_location) end,
    a.id,
    a.name,
    l.id,
    l.name,
    l.address,
    case when v_origin is not null and l.geog is not null
         then extensions.ST_Distance(v_origin, l.geog)::int end,
    i.scheduled_date,
    i.time_slot,
    i.scheduled_time,
    i.message,
    i.created_at,
    i.updated_at
  from public.invitations i
  join public.profiles other
    on other.id = case when i.sender_id = v_uid then i.recipient_id else i.sender_id end
  left join public.cities oc on oc.id = other.city_id
  join public.activities a on a.id = i.activity_id
  left join public.locations l on l.id = i.location_id
  where i.id = p_id
    and (i.sender_id = v_uid or i.recipient_id = v_uid);   -- ⚠ membre seulement
end;
$$;

revoke all on function public.get_invitation(uuid) from public;
grant execute on function public.get_invitation(uuid) to authenticated;
