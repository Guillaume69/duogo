-- Brique 2 (durcissement) — retire des privilèges INSERT/UPDATE accordés par
-- mégarde aux référentiels via les DEFAULT PRIVILEGES posés en brique 1
-- (`api_role_grants` : `alter default privileges ... grant select, insert, update`).
-- Les tables créées APRÈS en héritent automatiquement. Ce n'est PAS exploitable
-- aujourd'hui (aucune policy RLS d'écriture sur ces tables -> deny par défaut), mais
-- on garde le modèle « deux couches » honnête : le GRANT explicite doit être la
-- SEULE écriture permise (sinon un futur ajout de policy permissive ouvrirait une
-- brèche en pensant que les grants bornent déjà).

-- cities / activities : référentiels en LECTURE SEULE côté client.
revoke insert, update on public.cities from authenticated;
revoke insert, update on public.activities from authenticated;

-- profile_activities : on n'autorise que select/insert/delete (PK composite, pas
-- d'UPDATE voulu) -> on retire l'UPDATE hérité des default privileges.
revoke update on public.profile_activities from authenticated;
