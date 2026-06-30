import { warmSignedAvatarUrls } from "@/data/avatars";
import { listMyInvitations, type InboxInvitation } from "@/data/invitations";
import { useCallback, useRef, useState } from "react";

// Orchestration de l'Inbox : charge mes invitations (reçues + envoyées) et expose de quoi
// rendre les deux écrans (onglet reçues + écran « Invitation Sent »), qui FILTRENT par
// `direction`. L'écran ne fait que consommer cet état. Même garde de séquence anti-périmé
// que useNearbyPeople. "error" n'est posée qu'au 1er chargement (un rechargement au focus
// qui échoue garde la liste précédente, sans flash).
export type InboxStatus = "loading" | "error" | "ready";

export function useInbox() {
  const [status, setStatus] = useState<InboxStatus>("loading");
  const [invitations, setInvitations] = useState<InboxInvitation[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const loadedOnceRef = useRef(false);

  // Compteur de séquence : seul le chargement le plus récent applique son résultat.
  const reqIdRef = useRef(0);
  const runLoad = useCallback(async () => {
    const ticket = ++reqIdRef.current;
    let list: InboxInvitation[];
    try {
      list = await listMyInvitations();
    } catch {
      // Échec : on ne montre l'erreur qu'au 1er chargement (sinon on garde la liste).
      if (reqIdRef.current === ticket && !loadedOnceRef.current) setStatus("error");
      return;
    }
    // Pré-signature des avatars = confort, SECONDAIRE : erreur ignorée.
    await warmSignedAvatarUrls(
      list.map((i) => i.other_avatar_path).filter(Boolean),
    ).catch(() => {});
    if (reqIdRef.current !== ticket) return; // résultat périmé -> ignoré
    setInvitations(list);
    setStatus("ready");
    loadedOnceRef.current = true;
  }, []);

  // Pas de chargement au montage : les écrans déclenchent le 1er chargement ET les
  // rechargements via useFocusEffect(reload) — évite un double-fetch initial (le focus
  // se produit aussi au montage). Contrat : tout consommateur appelle reload() au focus.
  const reload = useCallback(async () => {
    await runLoad();
  }, [runLoad]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await runLoad();
    setRefreshing(false);
  }, [runLoad]);

  return { status, invitations, refreshing, onRefresh, reload };
}
