-- Brique 6 (3/3) — Flag « matché » sur la fiche personne (différé de la brique 5).
-- get_person expose désormais `conversation_id` : s'il existe une conversation entre nous
-- (= on est matchés), la fiche affiche « Message » (ouvre le chat) au lieu d'« Invite ».
-- find_nearby_people n'est PAS touchée (la LISTE n'a pas d'action « message » directe ;
-- on tape la ligne -> fiche, qui elle connaît le match). Blast radius minimal.
--
-- ⚠ Ajout d'une colonne au RETURNS TABLE -> DROP puis CREATE (Postgres refuse le
-- changement de type de retour via CREATE OR REPLACE). Signature des ARGUMENTS inchangée.

drop function if exists public.get_person(uuid);

create function public.get_person(p_id uuid)
returns table (
  id                   uuid,
  display_name         text,
  avatar_path          text,
  gender               public.gender,
  age                  int,
  city_id              uuid,
  distance_m           int,
  bio                  text,
  activity_ids         uuid[],
  activity_names       text[],
  already_invited      boolean,
  invited_by_them      boolean,
  active_invitation_id uuid,
  conversation_id      uuid                          -- non-null si on est matchés (chat dispo)
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_origin extensions.geography;
  v_city   uuid;
  v_today  date;
begin
  select p.device_location, p.city_id
    into v_origin, v_city
  from public.profiles p
  where p.id = v_uid;

  if v_origin is null or v_city is null then
    return;
  end if;

  select (now() at time zone c.timezone)::date
    into v_today
  from public.cities c
  where c.id = v_city;

  return query
  select
    p.id,
    p.display_name,
    p.avatar_path,
    p.gender,
    extract(year from age(v_today, p.birth_date))::int as age,
    p.city_id,
    public.snapped_distance_m(v_origin, p.device_location) as distance_m,
    p.bio,
    coalesce(acts.ids,   '{}'::uuid[]) as activity_ids,
    coalesce(acts.names, '{}'::text[]) as activity_names,
    coalesce(act.awaiting = p.id,  false) as already_invited,
    coalesce(act.awaiting = v_uid, false) as invited_by_them,
    act.inv_id as active_invitation_id,
    conv.conv_id as conversation_id
  from public.profiles p
  left join lateral (
    select
      array_agg(a.id   order by a.sort_order) as ids,
      array_agg(a.name order by a.sort_order) as names
    from public.profile_activities pa
    join public.activities a on a.id = pa.activity_id
    where pa.profile_id = p.id
  ) acts on true
  -- Invitation ACTIVE entre nous (paire non ordonnée = clé de l'index anti-spam).
  left join lateral (
    select inv.id as inv_id, inv.awaiting_response_from as awaiting
    from public.invitations inv
    where inv.status in ('pending', 'changes_requested')
      and least(inv.sender_id, inv.recipient_id)    = least(v_uid, p.id)
      and greatest(inv.sender_id, inv.recipient_id) = greatest(v_uid, p.id)
    limit 1
  ) act on true
  -- Conversation entre nous (au plus une : index unique sur la paire canonique). Membres
  -- stockés en ordre canonique (user_a < user_b) -> on compare least/greatest.
  left join lateral (
    select cv.id as conv_id
    from public.conversations cv
    where cv.user_a = least(v_uid, p.id)
      and cv.user_b = greatest(v_uid, p.id)
    limit 1
  ) conv on true
  where p.id = p_id
    and p.id <> v_uid
    and p.onboarding_completed is true
    and p.device_location is not null
    and p.city_id = v_city;
end;
$$;

revoke all on function public.get_person(uuid) from public;
grant execute on function public.get_person(uuid) to authenticated;
