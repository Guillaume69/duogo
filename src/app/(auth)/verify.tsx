import { supabase } from "@/lib/supabase";
import { router, useLocalSearchParams } from "expo-router";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 30;

export default function Verify() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const inputRef = useRef<TextInput>(null);

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [resendError, setResendError] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);

  // Décompte pour le bouton « Renvoyer ».
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  function onChange(text: string) {
    const digits = text.replace(/[^0-9]/g, "").slice(0, CODE_LENGTH);
    setCode(digits);
    setError(false);
    setResendError(false);
    if (digits.length === CODE_LENGTH) {
      verify(digits);
    }
  }

  async function verify(token: string) {
    if (!phone) return;
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: "sms",
    });
    setLoading(false);
    if (error) {
      setError(true);
      setCode("");
      inputRef.current?.focus();
      return;
    }
    // Succès : la session est posée, le guard du layout racine redirige vers (app).
  }

  async function resend() {
    if (cooldown > 0 || !phone) return;
    // Désactive le bouton TOUT DE SUITE (optimiste) : sinon un double-tap pendant
    // que la requête est en vol enverrait deux SMS.
    setCooldown(RESEND_COOLDOWN);
    setError(false);
    setResendError(false);
    setCode("");
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) {
      // Échec : on rouvre la possibilité de réessayer et on le signale
      // distinctement de « Wrong code ».
      setCooldown(0);
      setResendError(true);
    }
  }

  const prettyPhone = phone
    ? parsePhoneNumberFromString(phone)?.formatInternational() ?? phone
    : "";

  return (
    <SafeAreaView style={styles.container}>
      <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
        <Text style={styles.backText}>‹</Text>
      </Pressable>

      <Text style={styles.title}>Verification code</Text>
      <Text style={styles.subtitle}>
        Enter the code sent to{"\n"}
        <Text style={styles.phone}>{prettyPhone}</Text>
      </Text>

      <Pressable style={styles.boxes} onPress={() => inputRef.current?.focus()}>
        {Array.from({ length: CODE_LENGTH }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.box,
              i === code.length && styles.boxActive,
              error && styles.boxError,
            ]}
          >
            <Text style={styles.boxText}>{code[i] ?? ""}</Text>
          </View>
        ))}
        <TextInput
          ref={inputRef}
          style={styles.hiddenInput}
          value={code}
          onChangeText={onChange}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          maxLength={CODE_LENGTH}
          autoFocus
          caretHidden
          editable={!loading}
        />
      </Pressable>

      {error && <Text style={styles.errorText}>Wrong code</Text>}
      {resendError && (
        <Text style={styles.errorText}>Couldn't resend code</Text>
      )}
      {loading && <ActivityIndicator style={styles.loader} />}

      <View style={styles.resendRow}>
        <Text style={styles.resendHint}>Didn't get the code? </Text>
        <Pressable onPress={resend} disabled={cooldown > 0} hitSlop={8}>
          <Text style={[styles.resendLink, cooldown > 0 && styles.resendDisabled]}>
            {cooldown > 0 ? `Resend (${cooldown}s)` : "Resend code"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  back: { marginTop: 8, width: 40 },
  backText: { fontSize: 32, lineHeight: 32 },
  title: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 20,
  },
  phone: { fontWeight: "600", opacity: 1 },
  boxes: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 32,
    gap: 8,
  },
  box: {
    flex: 1,
    aspectRatio: 0.8,
    maxWidth: 52,
    borderWidth: 1,
    borderColor: "#d0d0d0",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  boxActive: { borderColor: "#111", borderWidth: 2 },
  boxError: { borderColor: "#e5484d" },
  boxText: { fontSize: 22, fontWeight: "600", color: "#111" },
  hiddenInput: {
    position: "absolute",
    width: "100%",
    height: "100%",
    opacity: 0,
  },
  errorText: {
    color: "#e5484d",
    fontSize: 13,
    textAlign: "center",
    marginTop: 12,
  },
  loader: { marginTop: 16 },
  resendRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 28,
  },
  resendHint: { fontSize: 14, opacity: 0.6 },
  resendLink: { fontSize: 14, fontWeight: "600", textDecorationLine: "underline" },
  resendDisabled: { opacity: 0.4, textDecorationLine: "none", fontWeight: "400" },
});
