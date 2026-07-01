import { colors, fontSize, radius, space } from "@/theme";
import SendIcon from "@expo/material-symbols/send.xml";
import { Host, Icon } from "@expo/ui";
import { useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
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
}: {
  onSend: (body: string) => Promise<void>;
  // Safe-area de repos (constante), portée en paddingBottom du composer. Clavier ouvert, le
  // conteneur parent (écran chat) la soustrait de son paddingBottom animé (dérivé de la
  // SharedValue clavier) -> pas de double comptage, pas de gap au-dessus du clavier. Jamais
  // togglé côté composer.
  bottomInset: number;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  // Garde SYNCHRONE anti-double-envoi : `sending` (état React) n'est vrai qu'au re-render
  // suivant, donc deux taps dans le même tick le liraient tous deux à false et enverraient
  // deux fois (message immuable + dédup par id serveur distinct -> doublon irrémédiable). La
  // ref ferme la fenêtre dès le 1er appel. `sending` reste pour l'UI (bouton désactivé).
  const sendingRef = useRef(false);
  const canSend = text.trim().length > 0 && !sending;

  async function handleSend() {
    if (sendingRef.current || !canSend) return;
    sendingRef.current = true;
    setSending(true);
    setFailed(false);
    try {
      await onSend(text);
      setText(""); // succès seulement
    } catch {
      setFailed(true); // on garde le texte saisi pour permettre un réessai
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  return (
    <View style={[styles.wrap, { paddingBottom: bottomInset + space.sm }]}>
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
    borderRadius: radius.pill,
    backgroundColor: colors.fillDark,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: colors.disabled },
});
