import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";

type AuthState = {
  session: Session | null;
  /** true tant que la session initiale n'est pas résolue. */
  loading: boolean;
};

const AuthContext = createContext<AuthState>({ session: null, loading: true });

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Session courante au démarrage (restaurée depuis AsyncStorage).
    // `finally` garantit qu'on sort du splash même si la lecture échoue (sinon
    // `loading` resterait true et l'app serait bloquée sur le splash à vie).
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => setSession(null))
      .finally(() => setLoading(false));

    // Mises à jour : login, logout, refresh de token.
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
