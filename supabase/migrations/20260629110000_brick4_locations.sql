-- Brique 4 (1/3) — Lieux de rendez-vous.
-- Table de RÉFÉRENCE (seedée, lecture seule côté client) : des lieux publics par
-- ville qu'on peut proposer comme point de rendez-vous d'une invitation (champ
-- OPTIONNEL). Archi multi-ville (FK city_id), comme cities/activities.
--
-- Les coordonnées d'un lieu PUBLIC ne sont PAS sensibles (≠ position d'un user) ;
-- on suit néanmoins la convention « pas de geography au client » (EWKB illisible) :
-- la couche data ne sélectionne jamais `geog`, et la RPC find_nearby_locations ne
-- renvoie qu'une distance. La distance lieu↔appelant ne révèle que la position de
-- l'appelant À LUI-MÊME -> pas d'anti-trilatération nécessaire ici (cf. people).

-- 1. Table -----------------------------------------------------------------
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities (id),
  name text not null check (char_length(name) between 1 and 120),
  -- Adresse libre affichée sous le nom dans le picker (facultative).
  address text check (address is null or char_length(address) <= 200),
  -- Point géographique du lieu. ⚠ JAMAIS sélectionné par le client (cf. en-tête) ;
  -- seule la RPC le lit pour calculer une distance.
  geog extensions.geography(point, 4326) not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.locations is
  'Lieux de rendez-vous (seedés) par ville. Proposés en option dans une invitation.';

-- Index spatial GiST sur geog. ⚠ NON utilisé par le tri de find_nearby_locations :
-- `order by ST_Distance` n'est PAS du KNN (seul `geog <-> origin` exploite l'index),
-- donc le tri fait un seq scan + sort — acceptable vu le très faible nombre de lieux
-- par ville. Conservé pour de futurs filtres spatiaux (ST_DWithin/&&, brique 7).
create index locations_geog_gist on public.locations using gist (geog);
-- Index d'égalité : filtre intra-ville systématique.
create index locations_city_id_idx on public.locations (city_id);

alter table public.locations enable row level security;

-- Lecture seule pour les authentifiés ; aucune écriture client (table seedée).
-- Comme cities, le GRANT SELECT porte sur toutes les colonnes mais la couche data
-- n'extrait jamais `geog` (illisible côté client). Brique 7 (All locations) réutilise.
create policy "Locations are readable by authenticated users"
  on public.locations for select to authenticated using (true);

grant select on public.locations to authenticated;
grant all on public.locations to service_role;

-- 2. Seed (Khon Kaen) ------------------------------------------------------
-- Quelques lieux publics connus de Khon Kaen. Coordonnées APPROXIMATIVES (données
-- de seed) ; center = ST_MakePoint(longitude, latitude) — lng EN PREMIER, SRID 4326.
-- Rattachés à la seule ville seedée du MVP via son slug (pas d'uuid en dur).
insert into public.locations (city_id, name, address, geog, sort_order)
select c.id, v.name, v.address,
       extensions.ST_SetSRID(extensions.ST_MakePoint(v.lng, v.lat), 4326)::extensions.geography,
       v.sort_order
from public.cities c
cross join (values
  ('Bueng Kaen Nakhon',        'Lakeside park, Mueang Khon Kaen', 102.8487, 16.4197, 10),
  ('Central Plaza Khon Kaen',  'Si Chan Rd, Mueang Khon Kaen',    102.8160, 16.4436, 20),
  ('Khon Kaen University',     'Mittraphap Rd',                   102.8237, 16.4742, 30),
  ('Fairy Plaza',              'Klang Mueang Rd',                 102.8350, 16.4360, 40),
  ('Ratchaphruek Park',        'Mueang Khon Kaen',                102.8300, 16.4480, 50),
  ('Khon Kaen National Museum','Lang Sun Ratchakan Rd',           102.8400, 16.4390, 60),
  ('Rim Bueng (lakeside)',     'Bueng Kaen Nakhon north shore',   102.8470, 16.4250, 70),
  ('Khon Kaen Beer Garden',    'Na Mueang Rd',                    102.8330, 16.4320, 80)
) as v(name, address, lng, lat, sort_order)
where c.slug = 'khon-kaen';

-- 3. RPC find_nearby_locations --------------------------------------------
-- Liste les lieux de MA ville, triés par proximité de ma position. `security definer` :
-- lit device_location de l'appelant (que le client ne peut pas lire) pour calculer la
-- distance, et ne renvoie QUE la distance (pas le geog). search_path='' -> qualifié.
-- Distance EXACTE (lieux publics, pas de position d'autrui) — cf. en-tête.
create or replace function public.find_nearby_locations(
  p_limit int default 30
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

  -- Appelant non géolocalisé ou hors zone -> aucun lieu (il ne peut pas inviter).
  if v_origin is null or v_city is null then
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
  ) q
  order by q.distance_m asc, q.id asc   -- tri stable malgré d'éventuels ex æquo
  limit v_limit;
end;
$$;

revoke all on function public.find_nearby_locations(int) from public;
grant execute on function public.find_nearby_locations(int) to authenticated;
