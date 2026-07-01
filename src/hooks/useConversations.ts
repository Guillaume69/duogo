import { warmSignedAvatarUrls } from "@/data/avatars";
import {
  listMyConversations,
  type ConversationListItem,
} from "@/data/conversations";
import { useCallback, useRef, useState } from "react";

// Orchestration de la liste Chats (segment « Chats » de l'Inbox). Même contrat que
// useInbox : pas de chargement au montage (le consommateur déclenche via useFocusEffect),
// garde de séquence anti-périmé, "error" seulement au 1er chargement (un refresh échoué
// garde la liste). L'écran ne fait que consommer cet état.
export type ConversationsStatus = "loading" | "error" | "ready";

export function useConversations() {
  const [status, setStatus] = useState<ConversationsStatus>("loading");
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const loadedOnceRef = useRef(false);

  const reqIdRef = useRef(0);
  const runLoad = useCallback(async () => {
    const ticket = ++reqIdRef.current;
    // Au 1er chargement (y compris « réessayer » après un échec), on montre le spinner
    // plein écran ; les rechargements ultérieurs (focus) restent silencieux.
    if (!loadedOnceRef.current) setStatus("loading");
    let list: ConversationListItem[];
    try {
      list = await listMyConversations();
    } catch {
      if (reqIdRef.current === ticket && !loadedOnceRef.current) setStatus("error");
      return;
    }
    // Pré-signature des avatars = confort SECONDAIRE : erreur ignorée.
    await warmSignedAvatarUrls(
      list.map((c) => c.other_avatar_path).filter(Boolean),
    ).catch(() => {});
    if (reqIdRef.current !== ticket) return; // résultat périmé -> ignoré
    setConversations(list);
    setStatus("ready");
    loadedOnceRef.current = true;
  }, []);

  const reload = useCallback(async () => {
    await runLoad();
  }, [runLoad]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await runLoad();
    setRefreshing(false);
  }, [runLoad]);

  return { status, conversations, refreshing, onRefresh, reload };
}
