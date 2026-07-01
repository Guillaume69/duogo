import type { Database, Enums } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";

// Couche d'accès « conversations » (le chat du match). La LISTE des conversations et le
// détail d'en-tête passent par des RPC enrichies (security definer, jamais de coords) ;
// la LISTE des messages et l'ENVOI passent en DIRECT par PostgREST + RLS (cas simple
// « mes données » d'AGENTS.md) ; le pointeur de lecture par une RPC (pas de GRANT update).

// Un message tel que stocké (type généré, zéro `as`). Immuable (ni édition ni suppression).
export type Message = Database["public"]["Tables"]["messages"]["Row"];

// Une ligne de la liste Chats. Le générateur type les colonnes d'un RETURNS TABLE en
// non-null ; or `last_message_*` sont NULL tant qu'aucun message n'a été échangé -> on
// resserre honnêtement (garde `!== null` obligatoire côté UI).
type RawConversationListItem =
  Database["public"]["Functions"]["get_my_conversations"]["Returns"][number];
export type ConversationListItem = Omit<
  RawConversationListItem,
  "last_message_body" | "last_message_at"
> & {
  last_message_body: string | null;
  last_message_at: string | null;
};

// L'en-tête d'un chat + le résumé de l'invitation épinglée. Nullables au runtime resserrés :
// `location_name` (lieu optionnel), et le couple `time_slot` XOR `scheduled_time` (l'un des
// deux est toujours null). avatar_path nullable toléré non-null (seulement affiché).
type RawConversationDetail =
  Database["public"]["Functions"]["get_conversation"]["Returns"][number];
export type ConversationDetail = Omit<
  RawConversationDetail,
  "location_name" | "time_slot" | "scheduled_time"
> & {
  location_name: string | null;
  time_slot: Enums<"time_slot"> | null;
  scheduled_time: string | null;
};

// Mes conversations (matchs), enrichies (autre membre, activité, dernier message, non lus),
// triées côté base : la plus fraîche d'abord.
export async function listMyConversations(): Promise<ConversationListItem[]> {
  const { data, error } = await supabase.rpc("get_my_conversations");
  if (error) throw error;
  return data ?? [];
}

// Détail d'UNE conversation dont je suis membre. 0 ligne (non membre / inexistante) -> null.
export async function getConversation(
  id: string,
): Promise<ConversationDetail | null> {
  const { data, error } = await supabase.rpc("get_conversation", { p_id: id });
  if (error) throw error;
  return data?.[0] ?? null;
}

// Les `limit` messages les plus RÉCENTS d'une conversation, remis en ordre CHRONOLOGIQUE
// (ancien -> récent) pour l'affichage (FlashList `startRenderingFromBottom`). RLS : membre
// seulement. Pagination « charger plus ancien » : différée (les fils du MVP sont courts).
export async function listMessages(
  conversationId: string,
  limit = 50,
): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).slice().reverse();
}

// Envoie un message (INSERT direct, gardé par la policy RLS : sender = moi ET membre) et
// renvoie la ligne créée. Le corps est trimé ici pour l'UX ; la base re-valide (non vide,
// borné). L'écho Realtime de ce message (même id) sera dédupliqué côté hook.
export async function sendMessage(input: {
  conversationId: string;
  senderId: string;
  body: string;
}): Promise<Message> {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: input.conversationId,
      sender_id: input.senderId,
      body: input.body.trim(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Avance MON pointeur de lecture sur la conversation (non-lus -> 0). RPC car le client
// n'a pas le GRANT update sur conversations. No-op si je n'en suis pas membre.
export async function markConversationRead(
  conversationId: string,
): Promise<void> {
  const { error } = await supabase.rpc("mark_messages_read", {
    p_conversation_id: conversationId,
  });
  if (error) throw error;
}
