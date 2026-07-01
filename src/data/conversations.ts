import type { Database, Enums } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";
import { toIsoTimestamp } from "@/utils/datetime";

// Couche d'accès « conversations » (le chat du match). Le détail d'en-tête d'un chat passe par
// une RPC enrichie (security definer, jamais de coords) ; la LISTE des messages et l'ENVOI
// passent en DIRECT par PostgREST + RLS (cas simple « mes données » d'AGENTS.md) ; le pointeur
// de lecture par une RPC (pas de GRANT update). La LISTE des conversations, elle, est désormais
// fournie par le flux unifié get_inbox (cf. src/data/inbox.ts, brique 6.5).

// Un message tel que stocké (type généré, zéro `as`). Immuable (ni édition ni suppression).
export type Message = Database["public"]["Tables"]["messages"]["Row"];

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

// Détail d'UNE conversation dont je suis membre. 0 ligne (non membre / inexistante) -> null.
export async function getConversation(
  id: string,
): Promise<ConversationDetail | null> {
  const { data, error } = await supabase.rpc("get_conversation", { p_id: id });
  if (error) throw error;
  return data?.[0] ?? null;
}

// Les `limit` messages les plus RÉCENTS d'une conversation, remis en ordre CHRONOLOGIQUE
// (ancien -> récent). L'écran chat re-inverse pour sa liste `inverted`. RLS : membre
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

// Abonnement Realtime aux nouveaux messages d'UNE conversation (INSERT). Encapsule toute
// l'infra Supabase (canal, auth, cleanup) pour que le hook consommateur n'importe pas
// `supabase` ni ne connaisse les tables (couche data = seule frontière DB). La RLS SELECT
// serveur ne pousse qu'aux membres ; on filtre en plus par `conversation_id` (un canal par
// conversation). `created_at` arrive au format Postgres brut (que Hermes ne parse pas) -> on
// le normalise en ISO ici, à la frontière data. `onSubscribed` re-fire à chaque (re)connexion
// du canal -> l'appelant s'en sert pour re-snapshoter (course join/snapshot, trou après
// coupure de socket). Renvoie la fonction de désabonnement (à appeler au cleanup).
export function subscribeToMessages(
  conversationId: string,
  handlers: {
    onInsert: (message: Message) => void;
    onSubscribed: () => void;
  },
): () => void {
  const channel = supabase.channel(`messages:${conversationId}`);
  channel.on<Message>(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "messages",
      filter: `conversation_id=eq.${conversationId}`,
    },
    (payload) => {
      handlers.onInsert({
        ...payload.new,
        created_at: toIsoTimestamp(payload.new.created_at),
      });
    },
  );
  // Garantit le JWT côté Realtime pour que la RLS autorise la diffusion.
  void supabase.realtime.setAuth();
  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") handlers.onSubscribed();
  });
  return () => {
    void supabase.removeChannel(channel);
  };
}
