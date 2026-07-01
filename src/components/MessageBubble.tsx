import type { Message } from "@/data/conversations";
import { colors, fontSize, radius, space } from "@/theme";
import { StyleSheet, Text, View } from "react-native";

// Bulle d'un message. `mine` = envoyé par moi -> aligné à droite ; sinon à gauche.
// Fond gris dans les deux cas (cf. maquette) : c'est l'alignement qui distingue l'auteur.
export function MessageBubble({
  message,
  mine,
}: {
  message: Message;
  mine: boolean;
}) {
  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <Text style={styles.text}>{message.body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", paddingHorizontal: space.xl },
  rowMine: { justifyContent: "flex-end" },
  rowTheirs: { justifyContent: "flex-start" },
  bubble: {
    maxWidth: "78%",
    backgroundColor: colors.fill,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  // Coins légèrement différenciés (la « pointe » du côté de l'auteur).
  bubbleMine: { borderBottomRightRadius: radius.field },
  bubbleTheirs: { borderBottomLeftRadius: radius.field },
  text: { fontSize: fontSize.body, color: colors.text, lineHeight: 21 },
});
