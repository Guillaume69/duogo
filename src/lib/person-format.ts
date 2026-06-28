// Formatters PURS partagés par les surfaces « personne » (PersonRow, fiche détail).
// Une seule source de vérité pour la distance et la ligne méta -> pas de dérive.

// Distance déjà GROSSIÈRE côté serveur (snap grille ~1 km + arrondi 500 m) -> on la
// présente en km approximatifs. Jamais de précision fine (anti-trilatération).
export function formatDistance(meters: number): string {
  if (meters < 1000) return "< 1 km";
  return `~${Math.round(meters / 1000)} km`;
}

// Ligne méta « ville · âge · ~distance ». Les parties absentes (ex. ville inconnue)
// sont omises. Jamais de coordonnées — uniquement la distance grossière.
export function formatPersonMeta(
  cityName: string | null | undefined,
  age: number,
  distanceM: number,
): string {
  return [cityName, `${age}`, formatDistance(distanceM)]
    .filter(Boolean)
    .join("  ·  ");
}
