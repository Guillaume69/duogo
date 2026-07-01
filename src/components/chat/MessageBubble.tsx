import type { ChatMessage } from "@/hooks/useChat";
import { colors, fontSize, opacity, radius, space } from "@/theme";
import { Pressable, StyleSheet, Text, View } from "react-native";

// Bulle d'un message. `mine` = envoyé par moi -> aligné à droite ; sinon à gauche.
// Fond gris dans les deux cas (cf. maquette) : c'est l'alignement qui distingue l'auteur.
// Statut d'envoi optimiste (MES messages) : la bulle est GRISÉE pendant l'envoi puis revient
// NORMALE à la confirmation (aucun élément ajouté -> pas de décalage de la conversation).
// L'échec (rare) est une légende tappable sous la bulle -> retry.
export function MessageBubble({
  item,
  mine,
  onRetry,
}: {
  item: ChatMessage;
  mine: boolean;
  onRetry?: () => void;
}) {
  const sending = mine && item.status === "sending";
  const failed = mine && item.status === "failed";
  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
      <View style={[styles.stack, mine ? styles.stackMine : styles.stackTheirs]}>
        <View
          style={[
            styles.bubble,
            mine ? styles.bubbleMine : styles.bubbleTheirs,
            sending && styles.bubblePending,
          ]}
        >
          <Text style={styles.text}>{item.body}</Text>
        </View>
        {failed ? (
          <Pressable onPress={onRetry} hitSlop={6}>
            <Text style={styles.statusFailed}>Not delivered. Tap to retry.</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", paddingHorizontal: space.xl },
  rowMine: { justifyContent: "flex-end" },
  rowTheirs: { justifyContent: "flex-start" },
  // Colonne bulle + légende d'échec : borne la largeur et aligne la légende sous le bon côté.
  stack: { maxWidth: "78%" },
  stackMine: { alignItems: "flex-end" },
  stackTheirs: { alignItems: "flex-start" },
  bubble: {
    backgroundColor: colors.fill,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  // Coins légèrement différenciés (la « pointe » du côté de l'auteur).
  bubbleMine: { borderBottomRightRadius: radius.field },
  bubbleTheirs: { borderBottomLeftRadius: radius.field },
  // Envoi en cours : bulle grisée, rétablie à la confirmation.
  bubblePending: { opacity: opacity.pending },
  text: { fontSize: fontSize.body, color: colors.text, lineHeight: 21 },
  statusFailed: {
    fontSize: fontSize.label,
    color: colors.danger,
    marginTop: space.xxs,
    paddingHorizontal: space.xs,
  },
});
