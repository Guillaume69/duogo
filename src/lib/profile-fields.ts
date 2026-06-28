import { Constants, type Enums } from "@/lib/database.types";

// Helpers partagés entre Edit profile et Account pour les champs de profil.

// Valeurs d'enum issues des types générés (zéro valeur en dur) + libellés EN affichés.
export const GENDER_VALUES = Constants.public.Enums.gender;
// L'enum DB reste `male`/`female`/`other` ; seul l'affichage de `other` change.
export const GENDER_LABELS: Record<Enums<"gender">, string> = {
  male: "Male",
  female: "Female",
  other: "Prefer not to say",
};

// 'YYYY-MM-DD' (colonne `date`) -> Date locale. On reconstruit par composants pour
// éviter le décalage de fuseau d'un `new Date("YYYY-MM-DD")` (interprété en UTC).
export function parseBirthDate(value: string | null): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

// Date -> 'YYYY-MM-DD' (format de la colonne `date`), en composantes locales.
export function formatBirthDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Âge révolu à partir d'une date de naissance 'YYYY-MM-DD'.
export function computeAge(value: string): number | null {
  const birth = parseBirthDate(value);
  if (!birth) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}
