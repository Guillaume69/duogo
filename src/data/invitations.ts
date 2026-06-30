import type { Database, Enums } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";

// Couche d'accès « invitations ». Toute écriture passe par une RPC `security definer`
// (send_invitation / respond_invitation / modify_invitation) ; aucun INSERT/UPDATE client
// direct. La lecture de l'Inbox passe par des RPC enrichies (jamais de coordonnées).

// Une ligne de l'Inbox (liste reçues/envoyées), dérivée du type généré (zéro `as`).
export type InboxInvitation =
  Database["public"]["Functions"]["get_my_invitations"]["Returns"][number];

// Le détail enrichi d'une invitation (carte + distances). Le générateur type les colonnes
// d'un RETURNS TABLE en non-null, or les DISTANCES sont nullables au runtime (appelant ou
// lieu sans position connue) : on resserre honnêtement -> garde `!== null` obligatoire côté
// UI (même motif que data/locations.ts pour `address`). Idem avatar/champs texte nullables
// que pour les personnes (cf. data/people.ts), tolérés non-null car seulement affichés.
type RawInvitationDetail =
  Database["public"]["Functions"]["get_invitation"]["Returns"][number];
export type InvitationDetail = Omit<
  RawInvitationDetail,
  "other_distance_m" | "location_distance_m"
> & {
  other_distance_m: number | null;
  location_distance_m: number | null;
};

// Données nécessaires pour composer une invitation. Les champs « quand » suivent le
// modèle base : date requise, et créneau XOR heure précise (les deux peuvent être nuls).
export type SendInvitationInput = {
  recipientId: string;
  activityId: string;
  date: string; // 'YYYY-MM-DD' (date locale de la ville)
  timeSlot: Enums<"time_slot"> | null;
  time: string | null; // 'HH:MM:SS' ou null
  locationId: string | null;
  message: string | null;
};

// Crée l'invitation et renvoie son id. Lève en cas d'échec (validation serveur,
// anti-spam…). ⚠ Tableaux/valeurs nulles -> `undefined` pour laisser le DEFAULT SQL
// (null) s'appliquer plutôt que d'envoyer explicitement null.
export async function sendInvitation(input: SendInvitationInput): Promise<string> {
  const { data, error } = await supabase.rpc("send_invitation", {
    p_recipient_id: input.recipientId,
    p_activity_id: input.activityId,
    p_date: input.date,
    p_time_slot: input.timeSlot ?? undefined,
    p_time: input.time ?? undefined,
    p_location_id: input.locationId ?? undefined,
    p_message: input.message ?? undefined,
  });
  if (error) throw error;
  if (!data) throw new Error("send_invitation returned no id");
  return data;
}

// Mes invitations (reçues + envoyées), enrichies (nom/avatar de l'autre, activité, lieu,
// sens, « mon tour »). Triées côté base : mon tour d'abord, puis plus récentes.
export async function listMyInvitations(): Promise<InboxInvitation[]> {
  const { data, error } = await supabase.rpc("get_my_invitations");
  if (error) throw error;
  return data ?? [];
}

// Détail d'UNE invitation dont je suis membre. 0 ligne (non membre / inexistante) -> null.
export async function getInvitation(id: string): Promise<InvitationDetail | null> {
  const { data, error } = await supabase.rpc("get_invitation", { p_id: id });
  if (error) throw error;
  return data?.[0] ?? null;
}

// Répond à une invitation dont c'est mon tour. À l'acceptation, la base crée la
// conversation (le match) et renvoie son id ; au refus, renvoie null. Lève en cas
// d'échec (pas mon tour, déjà répondue…) -> mappé via les helpers ci-dessous.
export async function respondInvitation(input: {
  invitationId: string;
  accept: boolean;
}): Promise<string | null> {
  const { data, error } = await supabase.rpc("respond_invitation", {
    p_invitation_id: input.invitationId,
    p_accept: input.accept,
  });
  if (error) throw error;
  return data ?? null;
}

// Données d'une contre-proposition (mêmes champs que l'envoi). ⚠ Valeurs nulles ->
// `undefined` pour laisser le DEFAULT SQL (null) s'appliquer (cf. sendInvitation).
export type ModifyInvitationInput = {
  invitationId: string;
  activityId: string;
  date: string; // 'YYYY-MM-DD'
  timeSlot: Enums<"time_slot"> | null;
  time: string | null; // 'HH:MM:SS' ou null
  locationId: string | null;
  message: string | null;
};

// Modifie une invitation dont c'est mon tour (contre-proposition) et renvoie son id.
// La base repasse l'invitation en changes_requested et renvoie la balle à l'autre membre.
export async function modifyInvitation(
  input: ModifyInvitationInput,
): Promise<string> {
  const { data, error } = await supabase.rpc("modify_invitation", {
    p_invitation_id: input.invitationId,
    p_activity_id: input.activityId,
    p_date: input.date,
    p_time_slot: input.timeSlot ?? undefined,
    p_time: input.time ?? undefined,
    p_location_id: input.locationId ?? undefined,
    p_message: input.message ?? undefined,
  });
  if (error) throw error;
  if (!data) throw new Error("modify_invitation returned no id");
  return data;
}

// Détecte un SQLSTATE précis sans assertion de type : après le garde `"code" in e`,
// `e.code` est accessible (narrowing TS), comparé à la string.
function hasPgCode(e: unknown, code: string): boolean {
  if (typeof e !== "object" || e === null) return false;
  return "code" in e && e.code === code;
}

// Anti-spam : une invitation pending existe déjà entre les deux (quel que soit le sens).
export function isDuplicateInvitationError(e: unknown): boolean {
  return hasPgCode(e, "23505");
}

// Date/heure invalide (déjà passée). send_invitation lève 22023 pour une date ou une
// heure/un créneau du jour déjà révolu. Le client garantit l'exclusivité créneau/heure,
// donc un 22023 ici signifie toujours « planning dans le passé » (jamais « les deux »).
export function isPastScheduleInvitationError(e: unknown): boolean {
  return hasPgCode(e, "22023");
}

// Invitation introuvable (id inconnu ou supprimée). respond/modify lèvent P0002.
export function isInvitationNotFoundError(e: unknown): boolean {
  return hasPgCode(e, "P0002");
}

// Conflit d'état : ce n'est pas mon tour, ou l'invitation ne peut plus être traitée
// (déjà acceptée/refusée, l'autre a répondu entre-temps…). respond/modify lèvent P0001.
export function isInvitationConflictError(e: unknown): boolean {
  return hasPgCode(e, "P0001");
}
