import { setMyLocation, type ResolvedCity } from "@/data/profiles";
import * as Location from "expo-location";
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type PropsWithChildren,
} from "react";

// État transverse de la géoloc. On NE capture PAS au montage (pas de prompt de
// permission à l'ouverture de l'app) : `capture()` est déclenché à la demande
// (bouton « Use my current location » dans Edit profile).
export type LocationStatus = "idle" | "loading" | "denied" | "error" | "done";

type LocationContextValue = {
  status: LocationStatus;
  /** Dernière ville résolue (jamais les coordonnées). */
  city: ResolvedCity | null;
  /**
   * Demande la permission foreground, lit le GPS une fois, écrit la position via
   * la RPC `set_my_location` (qui dérive city_id côté serveur) et renvoie la ville
   * résolue. Renvoie null si permission refusée ou erreur.
   */
  capture: () => Promise<ResolvedCity | null>;
};

const LocationContext = createContext<LocationContextValue | null>(null);

export function LocationProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<LocationStatus>("idle");
  const [city, setCity] = useState<ResolvedCity | null>(null);

  const capture = useCallback(async () => {
    setStatus("loading");
    try {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) {
        setStatus("denied");
        return null;
      }
      // Timeout de sécurité : getCurrentPositionAsync peut traîner indéfiniment si
      // le GPS est indisponible -> on borne à 15 s (sinon on resterait en "loading").
      let timer: ReturnType<typeof setTimeout> | undefined;
      const pos = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error("location timeout")), 15000);
        }),
      ]);
      if (timer) clearTimeout(timer);
      // La RPC ne renvoie QUE { cityId, cityName } — jamais les coordonnées.
      const resolved = await setMyLocation(
        pos.coords.latitude,
        pos.coords.longitude,
      );
      setCity(resolved);
      setStatus("done");
      return resolved;
    } catch {
      setStatus("error");
      return null;
    }
  }, []);

  return (
    <LocationContext.Provider value={{ status, city, capture }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) {
    throw new Error("useLocation doit être utilisé dans un LocationProvider");
  }
  return ctx;
}
