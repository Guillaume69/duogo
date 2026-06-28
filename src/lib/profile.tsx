import { fetchProfile, upsertDisplayName, type Profile } from "@/data/profiles";
import { useAuth } from "@/lib/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";

type ProfileContextValue = {
  profile: Profile | null;
  /** true tant que le profil initial n'est pas résolu. */
  loading: boolean;
  /** true si le chargement du profil a échoué (réseau, etc.). */
  error: boolean;
  /** Relance le chargement du profil (après une erreur). */
  reload: () => void;
  /** Renseigne/MAJ le pseudo ; rafraîchit l'état local au succès, lève sinon. */
  setDisplayName: (name: string) => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // Incrémenté par reload() pour relancer l'effet de chargement.
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setError(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    (async () => {
      try {
        const data = await fetchProfile(userId);
        if (cancelled) return;
        // data peut légitimement être null (ligne pas encore créée) -> onboarding.
        setProfile(data);
      } catch {
        // Échec de chargement : on NE confond PAS avec « pas de profil », sinon on
        // renverrait à tort un utilisateur déjà inscrit vers l'onboarding.
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, reloadKey]);

  const setDisplayName = useCallback(
    async (name: string) => {
      if (!userId) return;
      // upsertDisplayName lève en cas d'échec -> propagé à l'appelant (onboarding).
      const updated = await upsertDisplayName(userId, name);
      setProfile(updated);
    },
    [userId],
  );

  return (
    <ProfileContext.Provider
      value={{ profile, loading, error, reload, setDisplayName }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error("useProfile doit être utilisé dans un ProfileProvider");
  }
  return ctx;
}
