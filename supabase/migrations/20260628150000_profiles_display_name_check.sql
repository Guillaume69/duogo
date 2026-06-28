-- Brique 1 (correctif) — Durcir le CHECK de `display_name`.
--
-- Le CHECK initial (migration profiles) ne bornait que char_length(display_name) entre
-- 2 et 30. Via un appel PostgREST DIRECT (hors validation client), un utilisateur connecté
-- pouvait donc stocker un pseudo composé d'espaces ("  "), entouré d'espaces, ou contenant
-- des retours-ligne / caractères de contrôle — affiché tel quel aux autres (browse, brique 3).
-- La validation client (onboarding) ne suffit pas : la base est la vraie frontière de confiance.

alter table public.profiles
  drop constraint profiles_display_name_check;

alter table public.profiles
  add constraint profiles_display_name_check
  check (
    display_name is null
    or (
      -- pas d'espaces en bord : la valeur stockée est déjà « propre »
      display_name = btrim(display_name)
      -- longueur en points de code (cohérent avec la validation client)
      and char_length(display_name) between 2 and 30
      -- aucun caractère de contrôle (retours-ligne, tabulations, etc.)
      and display_name !~ '[[:cntrl:]]'
    )
  );
