import { Constants, type Enums } from "@/lib/database.types";

// Helpers date/heure partagés. Deux familles :
//   • format pour la BASE : 'YYYY-MM-DD' (colonne date) / 'HH:MM:SS' (colonne time),
//     en composantes LOCALES (jamais UTC : un new Date('YYYY-MM-DD') décale d'un fuseau).
//   • format d'AFFICHAGE : libellés conviviaux en anglais (UI verrouillée en anglais).

// Date -> 'YYYY-MM-DD' (composantes locales). Source unique aussi pour la date de
// naissance (cf. profile-fields.formatBirthDate qui délègue ici).
export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Date -> 'HH:MM:SS' (composantes locales ; secondes à 00).
export function formatLocalTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}:00`;
}

// Affichage convivial d'une date (ex. « Mon, Jun 30 »). Locale figée en-US :
// l'UI est verrouillée en anglais (≠ locale device qui pourrait rendre du thaï).
export function formatDateDisplay(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// Affichage long avec l'année (ex. « Jun 10, 2024 »). Utilisé sur la carte d'invitation
// (le sens « événement à une date précise » mérite l'année, ≠ liste compacte).
export function formatDateLong(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Parse une date 'YYYY-MM-DD' de la BASE en Date LOCALE (minuit local). On NE passe PAS
// par new Date('YYYY-MM-DD') qui interprète en UTC et décale d'un fuseau.
export function parseLocalDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Parse une heure 'HH:MM[:SS]' de la BASE en Date LOCALE (aujourd'hui à cette heure ;
// seuls les composants heure/minute comptent pour l'affichage et le re-pick).
export function parseLocalTime(value: string): Date {
  const [h, m] = value.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

// Affichage convivial d'une heure (ex. « 6:30 PM »).
export function formatTimeDisplay(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// Créneaux (enum DB) + libellés EN affichés. Valeurs issues des types générés.
export const TIME_SLOT_VALUES = Constants.public.Enums.time_slot;
export const TIME_SLOT_LABELS: Record<Enums<"time_slot">, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};
