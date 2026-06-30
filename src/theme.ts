// Design tokens — source de vérité des valeurs de style (couleurs, tailles de
// police, rayons, espacements). Les composants référencent ces tokens au lieu de
// répéter des magic numbers (`#111`, `fontSize: 16`…).
//
// ⚠ Ce n'est PAS un design custom : on reste sur le stock des 2 OS / max d'éléments
// natifs. C'est juste « ne pas dupliquer les valeurs » -> cohérence + reskin facile
// quand on fera le vrai design plus tard.

export const colors = {
  // Texte
  text: "#111", // texte principal
  textOnDark: "#fff", // texte sur fond sombre
  textMuted: "#8a8a8e", // labels de section
  textFaint: "#9aa0a6", // placeholders
  textMeta: "#444", // ligne méta (âge · genre · ville)
  // Fonds / remplissages
  surface: "#fff", // fond des écrans / champs
  fill: "#eceef2", // pills/chips non sélectionnés (gris clair)
  fillStrong: "#c9ccd2", // chips mises en avant (activités en commun) — gris plus foncé
  fillDark: "#111", // remplissages sombres (boutons, pills sélectionnées)
  fillPlaceholder: "#e3e3e6", // fond avatar sans image
  // Bordures / séparateurs
  border: "#d0d0d0", // bordures de champ
  borderSubtle: "#d3d5db", // bordures de pills
  divider: "#e3e3e6", // séparateurs / hairlines
  chevron: "#c4c4c6", // chevrons ›
  disabled: "#c4c4c4", // bouton désactivé
  // Accents
  accent: "#208AEF", // liens / accent
  danger: "#e5484d", // erreurs
  // Statuts d'invitation (badges) — texte blanc sur chacun.
  success: "#1f8a4c", // accepté (vert)
  warning: "#9a8f1e", // changements demandés (olive)
} as const;

export const fontSize = {
  label: 12, // labels de section (NAME, GENDER…)
  hint: 13, // hints / messages d'erreur
  chip: 14, // texte des pills
  sub: 15, // sous-titres / liens / méta
  body: 16, // champs / valeurs / boutons
  lg: 20, // titres secondaires
  chevron: 22, // chevron ›
  xl: 26, // nom de profil
  xxl: 28, // titres d'écran (onboarding)
} as const;

export const radius = {
  field: 12, // inputs / lignes / boutons
  pill: 20, // chips / pills
} as const;

export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 14,
  xl: 24, // padding d'écran
} as const;
