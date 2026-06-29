import type { Enums } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";

// Couche d'accès « invitations ». La création passe par la RPC `security definer`
// send_invitation (validations + anti-spam côté base) ; aucun INSERT client direct.

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
