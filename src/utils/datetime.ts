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

// Normalise un timestamp Postgres BRUT en ISO strict parsable par Hermes. Le serveur
// Realtime livre `timestamptz` au format brut « 2026-06-30 12:34:56.789012+00 » (ESPACE au
// lieu de 'T', fraction à 6 chiffres, offset court) — que le moteur Hermes (Expo) refuse
// (-> Invalid Date / NaN), alors que PostgREST renvoie déjà de l'ISO « …T…+00:00 ». On
// homogénéise donc les created_at venus du Realtime avant tout tri/affichage. Chaîne non
// reconnue (déjà ISO, ou inattendue) -> renvoyée telle quelle (on ne casse rien).
export function toIsoTimestamp(ts: string): string {
  const m = ts.match(
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.(\d+))?([+-]\d{2})(?::?(\d{2}))?$/,
  );
  if (!m) return ts;
  const [, date, time, frac = "0", offHours, offMinutes = "00"] = m;
  const millis = (frac + "000").slice(0, 3);
  return `${date}T${time}.${millis}${offHours}:${offMinutes}`;
}

// Temps relatif court pour les listes (« now », « 5m ago », « 4h ago », « 3d ago »,
// « 2w ago »). Au-delà de ~1 mois, on bascule sur la date longue (« Jun 30, 2026 »).
// Sert à la liste Chats (horodatage du dernier message).
export function formatRelativeShort(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return formatDateLong(new Date(iso));
}

// Deux instants tombent-ils le MÊME jour LOCAL ? (séparateurs de jour dans le chat.)
export function isSameLocalDay(isoA: string, isoB: string): boolean {
  const a = new Date(isoA);
  const b = new Date(isoB);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Libellé d'un séparateur de jour dans le chat : « Today » / « Yesterday », sinon la
// date (avec l'année si différente de l'année courante). Tout en heure LOCALE.
export function formatDayLabel(iso: string): string {
  const now = new Date();
  const nowIso = now.toISOString();
  if (isSameLocalDay(iso, nowIso)) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameLocalDay(iso, yesterday.toISOString())) return "Yesterday";
  const date = new Date(iso);
  return date.getFullYear() === now.getFullYear()
    ? formatDateDisplay(date) // « Mon, Jun 30 »
    : formatDateLong(date); // « Jun 30, 2025 »
}

// Créneaux (enum DB) + libellés EN affichés. Valeurs issues des types générés.
export const TIME_SLOT_VALUES = Constants.public.Enums.time_slot;
export const TIME_SLOT_LABELS: Record<Enums<"time_slot">, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};
