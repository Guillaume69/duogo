import type { Database } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";

// Couche d'accès « inbox unifiée ». Une seule RPC `get_inbox` (security definer) fusionne les
// conversations (matchs) et les invitations qui attendent une action de ma part en une liste
// homogène, triée côté base (mon tour d'abord, puis récence). Le compteur d'attention (badge de
// l'onglet) = `get_inbox_count`, défini comme le nombre de lignes `needs_me` de cette même liste
// -> une seule source de vérité, pas de prédicat dupliqué.

// Une ligne du flux Inbox, dérivée du type généré (zéro `as`). Le générateur type les colonnes
// d'un RETURNS TABLE en non-null ; or `last_message_body` (invitation / conversation vierge) et
// `other_avatar_path` (membre sans photo) sont NULL au runtime -> on resserre honnêtement les deux
// (garde `!== null` / tolérance du null obligatoire côté UI).
type RawInboxItem = Database["public"]["Functions"]["get_inbox"]["Returns"][number];
export type InboxItem = Omit<RawInboxItem, "last_message_body" | "other_avatar_path"> & {
  last_message_body: string | null;
  other_avatar_path: string | null;
};

// Mon flux Inbox unifié (matchs + invitations qui m'attendent), trié côté base.
export async function listInbox(): Promise<InboxItem[]> {
  const { data, error } = await supabase.rpc("get_inbox");
  if (error) throw error;
  return data ?? [];
}

// Nombre d'items qui attendent une action de ma part (alimente le badge de l'onglet Inbox).
export async function getInboxCount(): Promise<number> {
  const { data, error } = await supabase.rpc("get_inbox_count");
  if (error) throw error;
  return data ?? 0;
}
