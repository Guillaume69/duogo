import { fieldStyles } from "@/components/fieldStyles";
import type { LocationStatus } from "@/lib/location";
import { ActivityIndicator, Pressable, Text } from "react-native";

type Props = {
  cityName: string | null;
  status: LocationStatus;
  /** true seulement si une capture a été tentée dans cette session de l'écran. */
  captureAttempted: boolean;
  /** true si une ville a bien été résolue (city_id non null). */
  hasCity: boolean;
  onPress: () => void;
};

// Ligne LOCATION : déclenche la capture GPS au tap, affiche la ville résolue + les
// éventuels hints (permission refusée / erreur / hors zone). Aucune coordonnée ici.
export function LocationField({
  cityName,
  status,
  captureAttempted,
  hasCity,
  onPress,
}: Props) {
  const loading = status === "loading";
  return (
    <>
      <Pressable style={fieldStyles.row} onPress={onPress} disabled={loading}>
        <Text style={cityName ? fieldStyles.rowText : fieldStyles.rowPlaceholder}>
          {loading ? "Locating…" : (cityName ?? "Use my current location")}
        </Text>
        {loading ? (
          <ActivityIndicator />
        ) : (
          <Text style={fieldStyles.chevron}>›</Text>
        )}
      </Pressable>
      {captureAttempted && status === "denied" && (
        <Text style={fieldStyles.hint}>Location permission denied.</Text>
      )}
      {captureAttempted && status === "error" && (
        <Text style={fieldStyles.hint}>Couldn’t get your location.</Text>
      )}
      {captureAttempted && status === "done" && !hasCity && (
        <Text style={fieldStyles.hint}>
          You’re outside our service area for now.
        </Text>
      )}
    </>
  );
}
