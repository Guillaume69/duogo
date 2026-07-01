import { warmSignedAvatarUrls } from "@/data/avatars";
import { listInbox, type InboxItem } from "@/data/inbox";
import { useCallback, useRef, useState } from "react";

// Orchestration du flux Inbox unifié (matchs + invitations qui m'attendent). Il remplace le couple
// de hooks de liste de la brique 6 (chats + invitations). Même contrat que useInbox : pas de
// chargement au montage (l'écran déclenche via useFocusEffect), garde de séquence anti-périmé,
// "error" seulement au 1er chargement (un refresh échoué garde la liste, sans flash). L'écran ne
// fait que consommer cet état.
export type InboxFeedStatus = "loading" | "error" | "ready";

export function useInboxFeed() {
  const [status, setStatus] = useState<InboxFeedStatus>("loading");
  const [items, setItems] = useState<InboxItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const loadedOnceRef = useRef(false);

  // Compteur de séquence : seul le chargement le plus récent applique son résultat.
  const reqIdRef = useRef(0);
  const runLoad = useCallback(async () => {
    const ticket = ++reqIdRef.current;
    if (!loadedOnceRef.current) setStatus("loading");
    let list: InboxItem[];
    try {
      list = await listInbox();
    } catch {
      if (reqIdRef.current === ticket && !loadedOnceRef.current) setStatus("error");
      return;
    }
    // Pré-signature des avatars = confort SECONDAIRE : erreur ignorée. Prédicat typé (pas
    // `filter(Boolean)`, qui ne narrow pas) -> string[] honnête depuis `string | null`.
    await warmSignedAvatarUrls(
      list.map((i) => i.other_avatar_path).filter((p): p is string => p !== null),
    ).catch(() => {});
    if (reqIdRef.current !== ticket) return; // résultat périmé -> ignoré
    setItems(list);
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

  return { status, items, refreshing, onRefresh, reload };
}
