import { useProfile } from "@/lib/profile";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Onboarding() {
  const { setDisplayName } = useProfile();
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Aligné sur le CHECK SQL (char_length entre 2 et 30) : on compte les POINTS DE
  // CODE et non les unités UTF-16, sinon un emoji (length 2, char_length 1) passerait
  // côté client mais violerait la contrainte côté base.
  const trimmed = username.trim();
  const length = [...trimmed].length;
  const valid = length >= 2 && length <= 30;

  async function save() {
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    try {
      // Succès : le guard de (app)/_layout démonte cet écran et route vers les
      // onglets — inutile de remettre `saving` à false.
      await setDisplayName(trimmed);
    } catch (e) {
      // L'erreur réelle part en console pour le debug ; l'utilisateur voit un
      // message générique (on n'expose pas les détails Postgres dans l'UI).
      console.error("setDisplayName failed", e);
      setError("Something went wrong. Please try again.");
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Choose a username</Text>
          <Text style={styles.subtitle}>This is how other people will see you.</Text>

          <TextInput
            style={styles.input}
            value={username}
            onChangeText={(t) => {
              setUsername(t);
              setError(null);
            }}
            placeholder="Username"
            placeholderTextColor="#9aa0a6"
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={30}
            returnKeyType="done"
            onSubmitEditing={save}
            editable={!saving}
          />
          {error && <Text style={styles.error}>{error}</Text>}
        </View>

        <Pressable
          style={[styles.button, (!valid || saving) && styles.buttonDisabled]}
          onPress={save}
          disabled={!valid || saving}
        >
          <Text style={styles.buttonText}>{saving ? "Saving…" : "Continue"}</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: "center", gap: 8 },
  title: { fontSize: 28, fontWeight: "700" },
  subtitle: { fontSize: 15, opacity: 0.6, marginBottom: 16 },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: "#d0d0d0",
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#111",
  },
  error: { color: "#e5484d", fontSize: 13, marginTop: 8 },
  button: {
    height: 52,
    borderRadius: 12,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: { backgroundColor: "#c4c4c4" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
