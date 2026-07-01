import { colors, fontSize, radius, space } from "@/theme";
import SendIcon from "@expo/material-symbols/send.xml";
import { Host, Icon } from "@expo/ui";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

// Borne du corps (alignée sur la contrainte base char_length <= 2000) — UX seulement, la
// base reste propriétaire de l'invariant (doublon assumé).
const MAX_MESSAGE_LENGTH = 2000;

// Barre de composition d'un message (bas du chat). Champ multiligne + bouton d'envoi natif.
// Envoi OPTIMISTE : au tap, on vide le champ IMMÉDIATEMENT et on délègue l'envoi (la bulle
// "sending" apparaît côté liste, cf. useChat/MessageBubble). Le composer ne suit donc plus
// l'état d'envoi (plus de gel de l'UI) ; en cas d'échec, c'est la bulle qui propose le réessai.
// Vider tout de suite ferme aussi la fenêtre de double-envoi : le 2e tap voit un champ vide.
export function ChatComposer({
  onSend,
  bottomInset,
}: {
  onSend: (body: string) => void;
  // Safe-area de repos (constante), portée en paddingBottom du composer. Clavier ouvert, le
  // conteneur parent (écran chat) la soustrait de son paddingBottom animé (dérivé de la
  // SharedValue clavier) -> pas de double comptage, pas de gap au-dessus du clavier. Jamais
  // togglé côté composer.
  bottomInset: number;
}) {
  const [text, setText] = useState("");
  const canSend = text.trim().length > 0;

  function handleSend() {
    const body = text.trim();
    if (!body) return;
    setText(""); // vidé tout de suite : l'envoi est optimiste (la bulle apparaît côté liste)
    onSend(body);
  }

  return (
    <View style={[styles.wrap, { paddingBottom: bottomInset + space.sm }]}>
      <View style={styles.bar}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Message…"
          placeholderTextColor={colors.textFaint}
          maxLength={MAX_MESSAGE_LENGTH}
          multiline
        />
        <Pressable
          style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!canSend}
          hitSlop={12}
        >
          {/* Host = vue native @expo/ui : neutralisée (pointerEvents none) pour qu'elle
              n'avale pas le touch -> tout le tap tombe sur le Pressable (cf. FilterButton). */}
          <View pointerEvents="none">
            <Host matchContents>
              <Icon
                name={{ ios: "arrow.up", android: SendIcon }}
                size={22}
                color={colors.textOnDark}
              />
            </Host>
          </View>
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
  bar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: space.sm,
    // Padding latéral resserré (< padding d'écran) : plus de largeur pour l'input + le bouton.
    paddingHorizontal: space.md,
  },
  input: {
    flex: 1,
    minHeight: 44,
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
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.fillDark,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: colors.disabled },
});
