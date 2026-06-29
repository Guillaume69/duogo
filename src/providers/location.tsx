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

// Résultat discriminé de capture() : on distingue le REFUS de permission d'une
// erreur transitoire (timeout GPS, réseau) -> l'appelant affiche le bon écran
// (« autorise la localisation » vs « réessaie »), sans confondre les deux.
export type CaptureResult =
  | { ok: true; city: ResolvedCity }
  | { ok: false; reason: "denied" | "error" };

type LocationContextValue = {
  status: LocationStatus;
  /** Dernière ville résolue (jamais les coordonnées). */
  city: ResolvedCity | null;
  /**
   * Demande la permission foreground, lit le GPS une fois, écrit la position via
   * la RPC `set_my_location` (qui dérive city_id côté serveur) et renvoie la ville
   * résolue. En cas d'échec, distingue permission refusée (`denied`) et erreur
   * transitoire (`error`).
   */
  capture: () => Promise<CaptureResult>;
};

const LocationContext = createContext<LocationContextValue | null>(null);

export function LocationProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<LocationStatus>("idle");
  const [city, setCity] = useState<ResolvedCity | null>(null);

  const capture = useCallback(async (): Promise<CaptureResult> => {
    setStatus("loading");
    try {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) {
        setStatus("denied");
        return { ok: false, reason: "denied" };
      }
      // D'abord la DERNIÈRE position connue (cache OS, instantané) : suffisant pour
      // un matching à l'échelle de la ville, et ça évite d'attendre un fix GPS frais.
      let pos = await Location.getLastKnownPositionAsync({
        maxAge: 5 * 60 * 1000, // ≤ 5 min
        requiredAccuracy: 1000, // ≤ 1 km
      });
      if (!pos) {
        // Pas de position récente en cache -> fix GPS (plus lent). Timeout de
        // sécurité : getCurrentPositionAsync peut traîner indéfiniment si le GPS
        // est indisponible -> on borne à 15 s (sinon on resterait en "loading").
        // `finally` : on nettoie le timer SUR LES DEUX chemins (succès ET rejet).
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          pos = await Promise.race([
            Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            }),
            new Promise<never>((_resolve, reject) => {
              timer = setTimeout(() => reject(new Error("location timeout")), 15000);
            }),
          ]);
        } finally {
          if (timer) clearTimeout(timer);
        }
      }
      // La RPC ne renvoie QUE { cityId, cityName } — jamais les coordonnées.
      const resolved = await setMyLocation(
        pos.coords.latitude,
        pos.coords.longitude,
      );
      setCity(resolved);
      setStatus("done");
      return { ok: true, city: resolved };
    } catch {
      setStatus("error");
      return { ok: false, reason: "error" };
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
