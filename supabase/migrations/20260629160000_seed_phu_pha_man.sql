-- Seed DEV — ville de test « Phu Pha Man » (là où se trouve l'appareil de dev).
-- But : pouvoir tester l'app avec le VRAI GPS (sans forcer la position). Centre = la
-- position réelle du device ; on y déplace les profils de test et on seede des lieux.
-- ⚠ Données de DEV (un seul environnement). center = ST_MakePoint(lng, lat), SRID 4326.

-- 1. Ville centrée sur la position réelle ----------------------------------
insert into public.cities (name, slug, country_code, center, timezone)
values (
  'Phu Pha Man', 'phu-pha-man', 'TH',
  extensions.ST_SetSRID(extensions.ST_MakePoint(101.9130, 16.6665), 4326)::extensions.geography,
  'Asia/Bangkok'
);

-- 2. Lieux près de la position (offsets ~0.5–2 km) -------------------------
insert into public.locations (city_id, name, address, geog, sort_order)
select c.id, v.name, v.address,
       extensions.ST_SetSRID(extensions.ST_MakePoint(v.lng, v.lat), 4326)::extensions.geography,
       v.sort_order
from public.cities c
cross join (values
  ('Phu Pha Man Town Center',     'Mueang Phu Pha Man',  101.9130, 16.6665, 10),
  ('Doi Coffee House',            'Main Rd',             101.9190, 16.6705, 20),
  ('Community Sports Field',      'School Rd',           101.9060, 16.6715, 30),
  ('Phu Pha Man National Park',  'Park entrance',       101.9310, 16.6545, 40),
  ('Riverside Walk',             'Riverside',           101.9080, 16.6585, 50),
  ('Phu Pha Man Public Pool',    'Sports complex',      101.9220, 16.6755, 60),
  ('Community Hall',             'Town Hall Rd',        101.9020, 16.6625, 70)
) as v(name, address, lng, lat, sort_order)
where c.slug = 'phu-pha-man';

-- Associations lieu <-> activité (join par nom + slug ; cf. migration 150000).
insert into public.location_activities (location_id, activity_id)
select l.id, a.id
from public.locations l
join public.cities c on c.id = l.city_id and c.slug = 'phu-pha-man'
join (values
  ('Phu Pha Man Town Center',    'coffee'),
  ('Phu Pha Man Town Center',    'board-games'),
  ('Doi Coffee House',           'coffee'),
  ('Community Sports Field',      'running'),
  ('Community Sports Field',      'football'),
  ('Community Sports Field',      'tennis'),
  ('Phu Pha Man National Park',  'hiking'),
  ('Phu Pha Man National Park',  'running'),
  ('Phu Pha Man National Park',  'cycling'),
  ('Phu Pha Man National Park',  'climbing'),
  ('Riverside Walk',             'running'),
  ('Riverside Walk',             'cycling'),
  ('Riverside Walk',             'yoga'),
  ('Phu Pha Man Public Pool',    'swimming'),
  ('Community Hall',             'cinema'),
  ('Community Hall',             'board-games')
) as m(loc_name, act_slug) on m.loc_name = l.name
join public.activities a on a.slug = m.act_slug;

-- 3. Déplacer les profils de test vers Phu Pha Man -------------------------
-- On re-pointe UNIQUEMENT les comptes de test (email seed+…@duogo.test) : city_id +
-- device_location dispersés en grille ~ autour de la position (distances 0.5–2 km).
-- onboarding_completed (colonne générée) reste vrai (city_id non nul) -> découvrables.
-- Réversible : il suffira d'un UPDATE inverse (ou re-pointer vers khon-kaen) plus tard.
with seeded as (
  select p.id, row_number() over (order by p.display_name) - 1 as rn
  from public.profiles p
  join auth.users u on u.id = p.id
  where u.email like 'seed+%@duogo.test'
)
update public.profiles p
set city_id = (select c.id from public.cities c where c.slug = 'phu-pha-man'),
    device_location = extensions.ST_SetSRID(
      extensions.ST_MakePoint(
        101.9130 + ((s.rn % 4) - 1.5) * 0.010,   -- dispersion longitude (~±1.5 km)
        16.6665 + ((s.rn / 4) - 1.0) * 0.010      -- dispersion latitude
      ), 4326)::extensions.geography
from seeded s
where s.id = p.id;
