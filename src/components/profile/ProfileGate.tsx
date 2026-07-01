import { colors, fontSize, radius, space } from "@/theme";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Affiché pendant le chargement initial du profil (évite un écran blanc juste
// après le splash, sur un démarrage à froid connecté).
export function ProfileLoading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator />
    </View>
  );
}

// Affiché si le chargement du profil échoue (réseau, etc.) : évite de router à
// tort vers l'onboarding et propose de réessayer.
export function ProfileLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Couldn’t load your profile</Text>
        <Text style={styles.subtitle}>Check your connection and try again.</Text>
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={onRetry}
        >
          <Text style={styles.buttonText}>Retry</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { flex: 1, padding: space.xl },
  content: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.sm },
  title: { fontSize: fontSize.lg, fontWeight: "700" },
  subtitle: { fontSize: fontSize.sub, opacity: 0.6, marginBottom: 16, textAlign: "center" },
  button: {
    height: 52,
    paddingHorizontal: 32,
    borderRadius: radius.field,
    backgroundColor: colors.fillDark,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPressed: { opacity: 0.7 },
  buttonText: { color: colors.textOnDark, fontSize: fontSize.body, fontWeight: "600" },
});
