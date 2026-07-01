import {
  listMessages,
  markConversationRead,
  sendMessage,
  type Message,
} from "@/data/conversations";
import { supabase } from "@/lib/supabase";
import { toIsoTimestamp } from "@/utils/datetime";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

// Orchestration d'UN fil de chat : chargement (snapshot) + abonnement Realtime (INSERT de
// messages de cette conversation) + envoi + accusé de lecture, avec cleanup au démontage.
// La RLS du serveur Realtime ne pousse qu'aux membres ; on filtre quand même par
// conversation_id côté abonnement (un canal par conversation).
export type ChatStatus = "loading" | "error" | "ready";

// Fusionne des messages en dédupliquant par id (PREMIER vu conservé : un message est
// IMMUABLE -> l'écho Realtime ne doit pas écraser la version déjà en place). Tri
// chronologique stable. Date.parse exige de l'ISO -> les created_at issus du Realtime
// sont normalisés AVANT d'arriver ici (cf. toIsoTimestamp à l'ingestion).
function mergeMessages(prev: Message[], incoming: Message[]): Message[] {
  const byId = new Map(prev.map((m) => [m.id, m]));
  for (const m of incoming) if (!byId.has(m.id)) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => {
    const ta = Date.parse(a.created_at);
    const tb = Date.parse(b.created_at);
    return ta !== tb ? ta - tb : a.id.localeCompare(b.id);
  });
}

export function useChat(conversationId: string, myId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<ChatStatus>("loading");

  // myId lu dans le callback Realtime SANS coupler le cycle de vie de l'abonnement
  // (sinon un changement de myId relancerait l'effet -> re-souscription du même topic).
  const myIdRef = useRef(myId);
  useEffect(() => {
    myIdRef.current = myId;
  }, [myId]);

  // Garde « effet vivant » : ignore tout résultat async après démontage / changement d'id.
  const aliveRef = useRef(true);
  // « On a déjà chargé au moins une fois » : un re-snapshot qui échoue ne doit pas
  // faire repasser un chat fonctionnel en erreur.
  const loadedOkRef = useRef(false);
  // Débounce de l'accusé de lecture : une rafale de messages -> un seul appel RPC.
  const markTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Snapshot (re)chargeable : 1er chargement, abonnement actif (course join/snapshot),
  // retour au premier plan, et bouton « réessayer ». Idempotent (mergeMessages dédupe).
  const loadSnapshot = useCallback(async () => {
    try {
      const initial = await listMessages(conversationId);
      if (!aliveRef.current) return;
      setMessages((prev) => mergeMessages(prev, initial));
      loadedOkRef.current = true;
      setStatus("ready");
    } catch {
      // Erreur seulement si on n'a JAMAIS réussi (sinon on garde le fil déjà affiché).
      if (aliveRef.current && !loadedOkRef.current) setStatus("error");
    }
  }, [conversationId]);

  const scheduleMarkRead = useCallback(() => {
    if (markTimerRef.current) clearTimeout(markTimerRef.current);
    markTimerRef.current = setTimeout(() => {
      void markConversationRead(conversationId).catch(() => {});
    }, 300);
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;
    aliveRef.current = true;
    loadedOkRef.current = false;

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
        if (!aliveRef.current) return;
        // Realtime livre created_at au format Postgres brut (espace, offset court) que
        // Hermes ne parse pas -> on le normalise en ISO avant tri/affichage.
        const incoming: Message = {
          ...payload.new,
          created_at: toIsoTimestamp(payload.new.created_at),
        };
        setMessages((prev) => mergeMessages(prev, [incoming]));
        // Message entrant de l'autre, écran ouvert -> on marque lu (débounce anti-rafale).
        if (incoming.sender_id !== myIdRef.current) scheduleMarkRead();
      },
    );
    // Garantit le JWT côté Realtime pour que la RLS autorise la diffusion.
    void supabase.realtime.setAuth();
    // Re-snapshot quand l'abonnement devient ACTIF : ferme la course join/snapshot, et
    // SUBSCRIBED re-fire à la reconnexion -> comble un trou après une coupure de socket.
    channel.subscribe((subStatus) => {
      if (aliveRef.current && subStatus === "SUBSCRIBED") void loadSnapshot();
    });

    // Chargement immédiat (indépendant du Realtime : le fil s'affiche même si le socket
    // tarde / échoue), puis ouverture -> non-lus à zéro. (IIFE async : le setState de
    // loadSnapshot est différé après await -> pas de setState synchrone dans l'effet.)
    void (async () => {
      await loadSnapshot();
    })();
    void markConversationRead(conversationId).catch(() => {});

    // Retour au premier plan -> re-snapshot (Realtime ne rejoue PAS les events manqués
    // pendant un passage en arrière-plan).
    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") void loadSnapshot();
    });

    return () => {
      aliveRef.current = false;
      if (markTimerRef.current) clearTimeout(markTimerRef.current);
      appStateSub.remove();
      void supabase.removeChannel(channel);
    };
  }, [conversationId, loadSnapshot, scheduleMarkRead]);

  const send = useCallback(
    async (body: string) => {
      const uid = myIdRef.current;
      if (!uid) return;
      const trimmed = body.trim();
      if (!trimmed) return;
      const msg = await sendMessage({
        conversationId,
        senderId: uid,
        body: trimmed,
      });
      setMessages((prev) => mergeMessages(prev, [msg]));
    },
    [conversationId],
  );

  return { messages, status, send, reload: loadSnapshot };
}
