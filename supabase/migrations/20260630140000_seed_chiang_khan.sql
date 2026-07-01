-- Seed DEV — ville de test « Chiang Khan » (Loei, TH ; là où se trouve l'appareil de dev).
-- But : tester l'app avec le VRAI GPS sur place. Centre = vieux Chiang Khan (walking
-- street / bord du Mékong). On y déplace les profils de test et on seede des lieux.
-- ⚠ Données de DEV (un seul environnement). center = ST_MakePoint(lng, lat), SRID 4326.
-- Chiang Khan est à ~140 km de Phu Pha Man / Khon Kaen -> aucun chevauchement de rayon.

-- 1. Ville centrée sur le vieux Chiang Khan -------------------------------
insert into public.cities (name, slug, country_code, center, timezone)
values (
  'Chiang Khan', 'chiang-khan', 'TH',
  extensions.ST_SetSRID(extensions.ST_MakePoint(101.6664, 17.8889), 4326)::extensions.geography,
  'Asia/Bangkok'
);

-- 2. Lieux près du centre (offsets ~0.5–4 km) ----------------------------
insert into public.locations (city_id, name, address, geog, sort_order)
select c.id, v.name, v.address,
       extensions.ST_SetSRID(extensions.ST_MakePoint(v.lng, v.lat), 4326)::extensions.geography,
       v.sort_order
from public.cities c
cross join (values
  ('Chiang Khan Walking Street', 'Chai Khong Rd',      101.6650, 17.8895, 10),
  ('Chiang Khan Coffee House',   'Soi 9, Chai Khong',  101.6675, 17.8910, 20),
  ('Mekong Riverside Walk',      'Riverside',          101.6640, 17.8920, 30),
  ('Kaeng Khut Khu Rapids',      'Ban Noi',            101.6970, 17.8700, 40),
  ('Phu Thok Viewpoint',         'Phu Thok',           101.6520, 17.8800, 50),
  ('Community Sports Field',      'School Rd',          101.6700, 17.8850, 60),
  ('Riverside Public Pool',      'Sports complex',     101.6620, 17.8870, 70)
) as v(name, address, lng, lat, sort_order)
where c.slug = 'chiang-khan';

-- Associations lieu <-> activité (join par nom + slug ; cf. migration 150000).
insert into public.location_activities (location_id, activity_id)
select l.id, a.id
from public.locations l
join public.cities c on c.id = l.city_id and c.slug = 'chiang-khan'
join (values
  ('Chiang Khan Walking Street', 'coffee'),
  ('Chiang Khan Walking Street', 'board-games'),
  ('Chiang Khan Walking Street', 'cinema'),
  ('Chiang Khan Coffee House',   'coffee'),
  ('Mekong Riverside Walk',      'running'),
  ('Mekong Riverside Walk',      'cycling'),
  ('Mekong Riverside Walk',      'yoga'),
  ('Kaeng Khut Khu Rapids',      'hiking'),
  ('Kaeng Khut Khu Rapids',      'running'),
  ('Kaeng Khut Khu Rapids',      'cycling'),
  ('Phu Thok Viewpoint',         'hiking'),
  ('Phu Thok Viewpoint',         'climbing'),
  ('Phu Thok Viewpoint',         'running'),
  ('Community Sports Field',      'running'),
  ('Community Sports Field',      'football'),
  ('Community Sports Field',      'tennis'),
  ('Riverside Public Pool',      'swimming')
) as m(loc_name, act_slug) on m.loc_name = l.name
join public.activities a on a.slug = m.act_slug;

-- 3. Déplacer les profils de test vers Chiang Khan -----------------------
-- On re-pointe UNIQUEMENT les comptes de test (email seed+…@duogo.test) : city_id +
-- device_location dispersés en grille ~ autour du centre (distances 0.5–2.5 km).
-- onboarding_completed (colonne générée) reste vrai (city_id non nul) -> découvrables.
-- Réversible : UPDATE inverse (ou re-pointer vers phu-pha-man / khon-kaen) plus tard.
with seeded as (
  select p.id, row_number() over (order by p.display_name) - 1 as rn
  from public.profiles p
  join auth.users u on u.id = p.id
  where u.email like 'seed+%@duogo.test'
)
update public.profiles p
set city_id = (select c.id from public.cities c where c.slug = 'chiang-khan'),
    device_location = extensions.ST_SetSRID(
      extensions.ST_MakePoint(
        101.6664 + ((s.rn % 4) - 1.5) * 0.010,   -- dispersion longitude (~±1.5 km)
        17.8889 + ((s.rn / 4) - 1.0) * 0.010      -- dispersion latitude
      ), 4326)::extensions.geography
from seeded s
where s.id = p.id;
