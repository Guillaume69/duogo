import { getInboxCount } from "@/data/inbox";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { AppState } from "react-native";

// Compteur d'attention de l'onglet Inbox = nombre d'items qui attendent une action de ma part
// (messages non lus + invitations à répondre + nouveaux matchs jamais ouverts). Défini comme les
// lignes `needs_me` du flux Inbox. `refresh` (RPC get_inbox_count) alimente le compteur quand la
// liste n'est PAS montée : au montage du provider et au retour au premier plan. Quand l'écran
// Inbox EST monté, il pousse directement le compte dérivé de sa liste déjà chargée via `setCount`
// (pas de 2e aller-retour). (Le temps réel / push arrive en brique 8 ; ici, rafraîchissement à la
// demande — suffisant pour le MVP.)
type InboxBadge = {
  count: number;
  refresh: () => Promise<void>;
  setCount: (n: number) => void;
};

const InboxBadgeContext = createContext<InboxBadge | null>(null);

export function InboxBadgeProvider({ children }: PropsWithChildren) {
  const [count, setCount] = useState(0);
  // Garde de séquence : seul le rafraîchissement le plus récent applique son résultat.
  const reqIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const ticket = ++reqIdRef.current;
    try {
      const n = await getInboxCount();
      if (reqIdRef.current === ticket) setCount(n);
    } catch {
      // Silencieux : le badge est un confort, pas un invariant -> on garde l'ancienne valeur.
    }
  }, []);

  useEffect(() => {
    // Fetch initial en IIFE async : le setState de `refresh` tombe après l'await réseau, jamais
    // synchronement dans le corps de l'effet (idiome du repo, cf. useChat -> pas de cascade).
    void (async () => {
      await refresh();
    })();
    // Realtime ne rejoue pas les events manqués en arrière-plan -> on resnapshote au retour.
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  return (
    <InboxBadgeContext.Provider value={{ count, refresh, setCount }}>
      {children}
    </InboxBadgeContext.Provider>
  );
}

// Throw hors du provider (modèle country/auth) : un consommateur sans provider est un bug.
export function useInboxBadge(): InboxBadge {
  const ctx = useContext(InboxBadgeContext);
  if (!ctx) {
    throw new Error("useInboxBadge must be used within an InboxBadgeProvider");
  }
  return ctx;
}
