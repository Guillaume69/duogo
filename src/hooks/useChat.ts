import {
  listMessages,
  markConversationRead,
  sendMessage,
  subscribeToMessages,
  type Message,
} from "@/data/conversations";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";

// Orchestration d'UN fil de chat : chargement (snapshot) + abonnement Realtime (INSERT de
// messages de cette conversation) + envoi OPTIMISTE + accusé de lecture, avec cleanup au démontage.
// La RLS du serveur Realtime ne pousse qu'aux membres ; on filtre quand même par
// conversation_id côté abonnement (un canal par conversation).
export type ChatStatus = "loading" | "error" | "ready";

// Statut d'envoi d'un message. Seuls MES messages transitent par "sending"/"failed" (envoi
// optimiste) ; tout ce qui vient du serveur (snapshot / Realtime) est "sent".
export type SendStatus = "sent" | "sending" | "failed";

// Message tel que consommé par l'écran : forme UNIFIÉE des messages confirmés (lignes DB) et
// des messages optimistes (encore en vol / échoués), pour que la liste n'ait qu'un seul type à
// rendre. `id` = id serveur si confirmé, id temporaire si optimiste.
export type ChatMessage = {
  id: string;
  body: string;
  senderId: string;
  createdAt: string;
  status: SendStatus;
};

// Message optimiste : affiché DÈS le tap, avant réponse serveur. Le GRANT colonne interdit au
// client de forger `id`/`created_at` -> on porte un id temporaire local, réconcilié à la
// confirmation en RETIRANT l'optimiste (la vraie ligne entre par la réponse POST de sendMessage,
// puis l'écho Realtime éventuel est dédupé par id serveur). Sur échec : passe "failed" (retry).
type PendingMessage = {
  tempId: string;
  body: string;
  createdAt: string;
  status: "sending" | "failed";
};

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
  // Messages CONFIRMÉS (lignes DB) : snapshot + Realtime + réponse d'un envoi.
  const [serverMessages, setServerMessages] = useState<Message[]>([]);
  // Messages OPTIMISTES (client only) : en vol / échoués, en attente de réconciliation.
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>("loading");

  // Vue unifiée pour l'écran : confirmés (triés chrono) PUIS optimistes (les plus récents, en
  // fin -> bas de l'écran après inversion). L'optimiste garde sa place en bas jusqu'à
  // confirmation, où il est retiré et la vraie ligne prend sa position chrono réelle.
  const messages = useMemo<ChatMessage[]>(() => {
    const confirmed = serverMessages.map(
      (m): ChatMessage => ({
        id: m.id,
        body: m.body,
        senderId: m.sender_id,
        createdAt: m.created_at,
        status: "sent",
      }),
    );
    const optimistic = pending.map(
      (p): ChatMessage => ({
        id: p.tempId,
        body: p.body,
        senderId: myId ?? "",
        createdAt: p.createdAt,
        status: p.status,
      }),
    );
    return [...confirmed, ...optimistic];
  }, [serverMessages, pending, myId]);

  // myId lu dans le callback Realtime SANS coupler le cycle de vie de l'abonnement
  // (sinon un changement de myId relancerait l'effet -> re-souscription du même topic).
  const myIdRef = useRef(myId);
  useEffect(() => {
    myIdRef.current = myId;
  }, [myId]);

  // Miroir synchrone de `pending` pour que `retry` lise le corps du message échoué sans
  // dépendre d'une closure potentiellement périmée ni re-déclencher de rendu.
  const pendingRef = useRef<PendingMessage[]>([]);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  // Compteur d'ids temporaires (unique par montage du hook, suffisant pour dédupliquer les
  // optimistes entre eux ; pas de Date/random).
  const tempIdRef = useRef(0);

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
      setServerMessages((prev) => mergeMessages(prev, initial));
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

    // Abonnement Realtime encapsulé côté data (le hook n'importe pas supabase, cf. AGENTS.md).
    // Les gardes de cycle de vie React (aliveRef) restent ici. onSubscribed re-fire à chaque
    // (re)connexion du canal -> re-snapshot : ferme la course join/snapshot et comble un trou
    // après coupure de socket.
    const unsubscribe = subscribeToMessages(conversationId, {
      onInsert: (incoming) => {
        if (!aliveRef.current) return;
        setServerMessages((prev) => mergeMessages(prev, [incoming]));
        // Message entrant de l'autre, écran ouvert -> on marque lu (débounce anti-rafale).
        if (incoming.sender_id !== myIdRef.current) scheduleMarkRead();
      },
      onSubscribed: () => {
        if (aliveRef.current) void loadSnapshot();
      },
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
      unsubscribe();
    };
  }, [conversationId, loadSnapshot, scheduleMarkRead]);

  // Envoi réseau d'un optimiste + réconciliation. Succès : la vraie ligne entre dans
  // serverMessages ET l'optimiste est retiré (React 18 batch les 2 setState -> une seule passe,
  // pas de clignotement). L'écho Realtime de ce message (même id serveur) sera dédupé. Échec :
  // l'optimiste passe "failed" (le corps reste affiché, réessai possible via `retry`).
  const deliver = useCallback(
    async (tempId: string, uid: string, body: string) => {
      try {
        const msg = await sendMessage({
          conversationId,
          senderId: uid,
          body,
        });
        if (!aliveRef.current) return;
        setServerMessages((prev) => mergeMessages(prev, [msg]));
        setPending((prev) => prev.filter((p) => p.tempId !== tempId));
      } catch {
        if (!aliveRef.current) return;
        setPending((prev) =>
          prev.map((p) =>
            p.tempId === tempId ? { ...p, status: "failed" } : p,
          ),
        );
      }
    },
    [conversationId],
  );

  // Envoi OPTIMISTE : la bulle "sending" est ajoutée SYNCHRONEMENT (l'UI ne fige plus), puis le
  // POST part en arrière-plan. Le trim/garde vide reste (doublon UX assumé de la contrainte base).
  const send = useCallback(
    (body: string) => {
      const uid = myIdRef.current;
      if (!uid) return;
      const trimmed = body.trim();
      if (!trimmed) return;
      tempIdRef.current += 1;
      const tempId = `pending-${tempIdRef.current}`;
      setPending((prev) => [
        ...prev,
        {
          tempId,
          body: trimmed,
          createdAt: new Date().toISOString(),
          status: "sending",
        },
      ]);
      void deliver(tempId, uid, trimmed);
    },
    [deliver],
  );

  // Réessai d'un optimiste échoué (tap sur la bulle "Not delivered"). Repasse "sending" puis
  // relance le même POST. No-op si l'entrée n'est plus là ou n'est pas en échec.
  const retry = useCallback(
    (tempId: string) => {
      const uid = myIdRef.current;
      if (!uid) return;
      const target = pendingRef.current.find((p) => p.tempId === tempId);
      if (!target || target.status !== "failed") return;
      setPending((prev) =>
        prev.map((p) => (p.tempId === tempId ? { ...p, status: "sending" } : p)),
      );
      void deliver(tempId, uid, target.body);
    },
    [deliver],
  );

  return { messages, status, send, retry, reload: loadSnapshot };
}
