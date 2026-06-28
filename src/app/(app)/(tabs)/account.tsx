import { useAuth } from "@/lib/auth";
import { useProfile } from "@/lib/profile";
import { supabase } from "@/lib/supabase";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Onglet Account : profil en lecture seule + déconnexion.
// L'édition du profil arrivera en brique 2.
export default function AccountScreen() {
  const { session } = useAuth();
  const { profile } = useProfile();
  const [signingOut, setSigningOut] = useState(false);

  // profile est normalement non-null ici (l'onglet n'est montable qu'avec un
  // display_name défini), mais on reste défensif.
  const displayName = profile?.display_name ?? "";
  const phone = session?.user.phone ? `+${session.user.phone}` : null;

  async function signOut() {
    setSigningOut(true);
    // signOut() renvoie { error } (il ne throw PAS) : sur échec réseau la session
    // locale n'est pas vidée et le guard ne redirige pas -> on réactive le bouton,
    // sinon il resterait bloqué sur « Signing out… ».
    const { error } = await supabase.auth.signOut();
    if (error) setSigningOut(false);
    // Succès : le guard du layout racine démonte (app) et route vers (auth).
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.name}>{displayName}</Text>
        {phone && <Text style={styles.phone}>{phone}</Text>}
      </View>

      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={signOut}
        disabled={signingOut}
      >
        <Text style={styles.buttonText}>
          {signingOut ? "Signing out…" : "Sign out"}
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "space-between" },
  header: { marginTop: 16, gap: 4 },
  name: { fontSize: 28, fontWeight: "700" },
  phone: { fontSize: 16, opacity: 0.6 },
  button: {
    height: 52,
    borderRadius: 12,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPressed: { opacity: 0.7 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
