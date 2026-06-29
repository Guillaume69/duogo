-- Brique 4 (suite) — Lieux PAR activité.
-- Un lieu sert une ou plusieurs activités (un parc = running/cycling/yoga ; un mall =
-- coffee/cinema…). Liaison M-N location_activities ; find_nearby_locations filtre
-- désormais sur l'activité choisie de l'invitation (le picker « lieu » dépend d'elle).

-- 1. Liaison N-N lieu <-> activité ----------------------------------------
create table public.location_activities (
  location_id uuid not null references public.locations (id) on delete cascade,
  activity_id uuid not null references public.activities (id) on delete cascade,
  primary key (location_id, activity_id)
);

comment on table public.location_activities is
  'Quelles activités peut-on faire dans quel lieu (seedé). Filtre du picker lieu d''une invitation.';

-- Index sur activity_id : « quels lieux pour cette activité » (find_nearby_locations).
create index location_activities_activity_id_idx on public.location_activities (activity_id);

alter table public.location_activities enable row level security;

-- Lecture seule pour les authentifiés (table seedée). Écriture révoquée (durcissement
-- symétrique aux autres référentiels : les default privileges accordent insert/update).
create policy "Location activities are readable by authenticated users"
  on public.location_activities for select to authenticated using (true);

grant select on public.location_activities to authenticated;
revoke insert, update on public.location_activities from authenticated;
grant all on public.location_activities to service_role;

-- 2. Seed des associations -------------------------------------------------
-- Join par nom de lieu (ville Khon Kaen) + slug d'activité — aucun uuid en dur.
-- NB : 'climbing' n'a volontairement aucun lieu seedé -> picker lieu vide pour cette
-- activité (l'utilisateur peut juste laisser « No specific place »).
insert into public.location_activities (location_id, activity_id)
select l.id, a.id
from public.locations l
join public.cities c on c.id = l.city_id and c.slug = 'khon-kaen'
join (values
  ('Bueng Kaen Nakhon',         'running'),
  ('Bueng Kaen Nakhon',         'cycling'),
  ('Bueng Kaen Nakhon',         'hiking'),
  ('Bueng Kaen Nakhon',         'yoga'),
  ('Central Plaza Khon Kaen',   'coffee'),
  ('Central Plaza Khon Kaen',   'cinema'),
  ('Central Plaza Khon Kaen',   'board-games'),
  ('Khon Kaen University',      'running'),
  ('Khon Kaen University',      'tennis'),
  ('Khon Kaen University',      'football'),
  ('Khon Kaen University',      'swimming'),
  ('Fairy Plaza',               'coffee'),
  ('Fairy Plaza',               'cinema'),
  ('Ratchaphruek Park',         'running'),
  ('Ratchaphruek Park',         'cycling'),
  ('Ratchaphruek Park',         'hiking'),
  ('Ratchaphruek Park',         'yoga'),
  ('Khon Kaen National Museum', 'museum'),
  ('Rim Bueng (lakeside)',      'coffee'),
  ('Rim Bueng (lakeside)',      'running'),
  ('Khon Kaen Beer Garden',     'coffee'),
  ('Khon Kaen Beer Garden',     'board-games')
) as m(loc_name, act_slug) on m.loc_name = l.name
join public.activities a on a.slug = m.act_slug;

-- 3. find_nearby_locations : filtre par activité --------------------------
-- Nouvelle signature (ajout p_activity_id en 1er) -> DROP de l'ancienne d'abord (sinon
-- surcharge en double). Renvoie les lieux de MA ville SERVANT l'activité demandée, triés
-- par proximité (distance exacte — lieux publics). `security definer` + search_path=''.
drop function if exists public.find_nearby_locations(int);

create function public.find_nearby_locations(
  p_activity_id uuid,
  p_limit       int default 30
)
returns table (
  id         uuid,
  name       text,
  address    text,
  distance_m int
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
  v_limit  int := least(coalesce(p_limit, 30), 100);
begin
  select p.device_location, p.city_id
    into v_origin, v_city
  from public.profiles p
  where p.id = v_uid;

  -- Sans position/ville, ou sans activité ciblée -> aucun lieu.
  if v_origin is null or v_city is null or p_activity_id is null then
    return;
  end if;

  return query
  select q.id, q.name, q.address, q.distance_m
  from (
    select
      l.id,
      l.name,
      l.address,
      extensions.ST_Distance(v_origin, l.geog)::int as distance_m
    from public.locations l
    where l.city_id = v_city
      and exists (
        select 1
        from public.location_activities la
        where la.location_id = l.id
          and la.activity_id = p_activity_id
      )
  ) q
  order by q.distance_m asc, q.id asc
  limit v_limit;
end;
$$;

revoke all on function public.find_nearby_locations(uuid, int) from public;
grant execute on function public.find_nearby_locations(uuid, int) to authenticated;
