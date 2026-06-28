import { flagEmoji } from "@/lib/countries";
import { useCountry } from "@/lib/country";
import { supabase } from "@/lib/supabase";
import { router } from "expo-router";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Login() {
  const { country } = useCountry();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(
    () => parsePhoneNumberFromString(input, country.code),
    [input, country.code],
  );
  const isValid = parsed?.isValid() ?? false;
  const showInvalid = input.trim().length > 0 && !isValid;

  async function onContinue() {
    if (!parsed || !isValid) return;
    Keyboard.dismiss();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ phone: parsed.number });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push({ pathname: "/verify", params: { phone: parsed.number } });
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Log in or sign up</Text>

      <View style={[styles.inputRow, showInvalid && styles.inputRowError]}>
        <Pressable style={styles.countryButton} onPress={() => router.push("/country")}>
          <Text style={styles.flag}>{flagEmoji(country.code)}</Text>
          <Text style={styles.dial}>+{country.dial}</Text>
          <Text style={styles.chevron}>▾</Text>
        </Pressable>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={(t) => {
            setInput(t);
            setError(null);
          }}
          placeholder="Your phone number"
          placeholderTextColor="#9aa0a6"
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          autoFocus
          maxLength={20}
        />
      </View>

      {showInvalid && <Text style={styles.errorText}>Invalid number</Text>}
      {error && <Text style={styles.errorText}>{error}</Text>}

      <Text style={styles.helper}>We'll text you a verification code.</Text>

      <View style={styles.whatsappRow}>
        <Switch value={false} disabled />
        <Text style={styles.whatsappLabel}>Send code via WhatsApp (soon)</Text>
      </View>

      <View style={styles.spacer} />

      <Pressable
        style={[styles.button, (!isValid || loading) && styles.buttonDisabled]}
        onPress={onContinue}
        disabled={!isValid || loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Continue</Text>
        )}
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  title: { fontSize: 28, fontWeight: "700", marginTop: 16, marginBottom: 24 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d0d0d0",
    borderRadius: 12,
    height: 56,
    paddingHorizontal: 12,
    gap: 8,
  },
  inputRowError: { borderColor: "#e5484d" },
  countryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingRight: 8,
    borderRightWidth: 1,
    borderRightColor: "#e0e0e0",
    height: "100%",
  },
  flag: { fontSize: 22 },
  dial: { fontSize: 16, fontWeight: "600" },
  chevron: { fontSize: 12, opacity: 0.5 },
  input: { flex: 1, fontSize: 16, height: "100%", color: "#111" },
  errorText: { color: "#e5484d", fontSize: 13, marginTop: 8 },
  helper: { fontSize: 13, opacity: 0.55, marginTop: 12 },
  whatsappRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 20,
    opacity: 0.5,
  },
  whatsappLabel: { fontSize: 14 },
  spacer: { flex: 1 },
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
