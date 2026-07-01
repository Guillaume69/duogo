import { colors, fontSize, radius, space } from "@/theme";
import SendIcon from "@expo/material-symbols/send.xml";
import { Host, Icon } from "@expo/ui";
import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
} from "react-native";

// Borne du corps (alignée sur la contrainte base char_length <= 2000) — UX seulement, la
// base reste propriétaire de l'invariant (doublon assumé).
const MAX_MESSAGE_LENGTH = 2000;

// Barre de composition d'un message (bas du chat). Champ multiligne + bouton d'envoi natif.
// En cas d'échec d'envoi, le texte est conservé (réessai) et une erreur est affichée ; le
// texte n'est effacé qu'au succès.
export function ChatComposer({
  onSend,
  bottomInset,
  onLayout,
}: {
  onSend: (body: string) => Promise<void>;
  // Safe-area de repos (constante) : à l'ouverture du clavier, le KeyboardStickyView parent
  // l'absorbe via son offset `opened` -> pas de double comptage, pas de gap. Jamais togglé.
  bottomInset: number;
  // Mesure de la hauteur pleine du composer, réservée en bas du fil de messages par l'écran.
  onLayout: (e: LayoutChangeEvent) => void;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const canSend = text.trim().length > 0 && !sending;

  async function handleSend() {
    if (!canSend) return;
    setSending(true);
    setFailed(false);
    try {
      await onSend(text);
      setText(""); // succès seulement
    } catch {
      setFailed(true); // on garde le texte saisi pour permettre un réessai
    } finally {
      setSending(false);
    }
  }

  return (
    <View
      onLayout={onLayout}
      style={[styles.wrap, { paddingBottom: bottomInset + space.sm }]}
    >
      {failed ? (
        <Text style={styles.error}>Couldn’t send. Check your connection and try again.</Text>
      ) : null}
      <View style={styles.bar}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={(t) => {
            setText(t);
            if (failed) setFailed(false);
          }}
          placeholder="Message…"
          placeholderTextColor={colors.textFaint}
          maxLength={MAX_MESSAGE_LENGTH}
          multiline
        />
        <Pressable
          style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!canSend}
          hitSlop={8}
        >
          <Host matchContents>
            <Icon
              name={{ ios: "arrow.up", android: SendIcon }}
              size={20}
              color={colors.textOnDark}
            />
          </Host>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    backgroundColor: colors.surface,
  },
  error: {
    color: colors.danger,
    fontSize: fontSize.hint,
    paddingHorizontal: space.xl,
    paddingBottom: space.sm,
  },
  bar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: space.sm,
    paddingHorizontal: space.xl,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: colors.fill,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.sm,
    fontSize: fontSize.body,
    color: colors.text,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.fillDark,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: colors.disabled },
});
