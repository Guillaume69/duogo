import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Home() {
  const { session } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const phone = session?.user.phone ? `+${session.user.phone}` : null;

  async function signOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    // La redirection vers (auth) est gérée par le guard du layout racine.
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Connecté ✅</Text>
        <Text style={styles.subtitle}>Bienvenue sur DuoGo</Text>
        {phone && <Text style={styles.phone}>{phone}</Text>}
      </View>

      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={signOut}
        disabled={signingOut}
      >
        <Text style={styles.buttonText}>
          {signingOut ? "Déconnexion…" : "Se déconnecter"}
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "space-between",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  title: { fontSize: 28, fontWeight: "700" },
  subtitle: { fontSize: 16, opacity: 0.6 },
  phone: { fontSize: 18, fontWeight: "600", marginTop: 8 },
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
